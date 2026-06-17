import { Link, useLocation } from "wouter";
import { FileDown, History, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto max-w-5xl h-16 flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground group-hover:scale-105 transition-transform">
              <FileDown className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">ConvertSync</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link 
              href="/" 
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                location === "/" ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Converter</span>
              </div>
            </Link>
            <Link 
              href="/history" 
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                location === "/history" ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>History</span>
              </div>
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="py-6 border-t bg-card text-center text-sm text-muted-foreground">
        <p>Built for clarity and speed.</p>
      </footer>
    </div>
  );
}
