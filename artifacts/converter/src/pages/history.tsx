import { useListConversions, useGetConversionStats, useDeleteConversion, getListConversionsQueryKey, getGetConversionStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, File, Download, Trash2, ArrowRight, Activity, CheckCircle2, AlertCircle, FileDigit } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function History() {
  const { data: conversions, isLoading: isLoadingList } = useListConversions();
  const { data: stats, isLoading: isLoadingStats } = useGetConversionStats();
  const deleteConversion = useDeleteConversion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteConversion.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListConversionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetConversionStatsQueryKey() });
        toast({
          title: "Deleted",
          description: "Conversion record removed.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete record.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Conversion History</h1>
        <p className="text-muted-foreground">View your recent conversions and download results.</p>
      </div>

      {isLoadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-primary text-primary-foreground border-none flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-primary-foreground/80">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalConversions}</p>
          </Card>
          <Card className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Success Rate</span>
            </div>
            <p className="text-3xl font-bold">
              {stats.totalConversions > 0 ? Math.round((stats.successCount / stats.totalConversions) * 100) : 0}%
            </p>
          </Card>
          <Card className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <FileDigit className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Data Processed</span>
            </div>
            <p className="text-3xl font-bold">{formatBytes(stats.totalBytesProcessed, 1)}</p>
          </Card>
          <Card className="p-4 flex flex-col justify-center">
             <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <p className="text-3xl font-bold">{stats.failureCount}</p>
          </Card>
        </div>
      ) : null}

      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-6 py-4 font-medium">File Details</th>
                <th className="px-6 py-4 font-medium">Conversion</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoadingList ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4"><Skeleton className="h-12 w-full" /></td>
                  </tr>
                ))
              ) : conversions?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No conversions yet. Go to the home page to start converting files.
                  </td>
                </tr>
              ) : conversions?.map((conv) => (
                <tr key={conv.id} className="bg-card hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md text-primary shrink-0">
                        {conv.originalFormat === 'pdf' ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[200px]" title={conv.originalFilename}>{conv.originalFilename}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(conv.fileSizeBytes)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="uppercase">{conv.originalFormat}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="uppercase text-primary">{conv.targetFormat}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {formatDate(conv.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    {conv.status === 'completed' && <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Completed</Badge>}
                    {conv.status === 'pending' && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Processing</Badge>}
                    {conv.status === 'failed' && <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-none">Failed</Badge>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {conv.status === 'completed' && (
                        <Button size="sm" variant="secondary" asChild>
                          <a href={`/api/conversions/${conv.id}/download`} download>
                            <Download className="w-4 h-4 mr-1" /> Save
                          </a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(conv.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
