import { Layout } from "./components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import History from "@/pages/history";
import Merge from "@/pages/merge";
import Split from "@/pages/split";
import Compress from "@/pages/compress";
import Protect from "@/pages/protect";
import Rotate from "@/pages/rotate";
import PdfToJpg from "@/pages/pdf-to-jpg";
import JpgToPdf from "@/pages/jpg-to-pdf";
import Watermark from "@/pages/watermark";
import Unlock from "@/pages/unlock";
import Ocr from "@/pages/ocr";
import PdfToPptx from "@/pages/pdf-to-pptx";
import PdfToXlsx from "@/pages/pdf-to-xlsx";
import PptxToPdf from "@/pages/pptx-to-pdf";
import XlsxToPdf from "@/pages/xlsx-to-pdf";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/history" component={History} />
        <Route path="/merge" component={Merge} />
        <Route path="/split" component={Split} />
        <Route path="/compress" component={Compress} />
        <Route path="/protect" component={Protect} />
        <Route path="/rotate" component={Rotate} />
        <Route path="/pdf-to-jpg" component={PdfToJpg} />
        <Route path="/jpg-to-pdf" component={JpgToPdf} />
        <Route path="/watermark" component={Watermark} />
        <Route path="/unlock" component={Unlock} />
        <Route path="/ocr" component={Ocr} />
        <Route path="/pdf-to-pptx" component={PdfToPptx} />
        <Route path="/pdf-to-xlsx" component={PdfToXlsx} />
        <Route path="/pptx-to-pdf" component={PptxToPdf} />
        <Route path="/xlsx-to-pdf" component={XlsxToPdf} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
