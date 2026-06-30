import { useEffect, useRef } from "react";
import {
  ClerkProvider, SignIn, SignUp, Show,
  useClerk, useAuth,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch, Route, useLocation, Router as WouterRouter, Redirect,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "./components/layout";
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

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#1d4ed8",
    colorForeground: "#0f172a",
    colorMutedForeground: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f8fafc",
    colorInputForeground: "#0f172a",
    colorNeutral: "#e2e8f0",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-slate-100",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-semibold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "text-slate-700 font-medium",
    formFieldLabel: "text-slate-700 text-sm font-medium",
    footerActionLink: "text-blue-600 hover:text-blue-700 font-medium",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-blue-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-slate-700",
    logoBox: "mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-slate-200 bg-white hover:bg-slate-50",
    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-medium",
    formFieldInput: "border-slate-200 bg-slate-50 text-slate-900",
    footerAction: "bg-slate-50",
    dividerLine: "bg-slate-200",
    alert: "bg-red-50 border-red-100",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

/** Redirect to /sign-in when the user is not authenticated. */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;          // avoid flash
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Home is always public — shows landing for signed-out, converter for signed-in */}
        <Route path="/" component={Home} />

        {/* Every tool and history page requires sign-in */}
        <Route path="/history">
          <ProtectedRoute component={History} />
        </Route>
        <Route path="/merge">
          <ProtectedRoute component={Merge} />
        </Route>
        <Route path="/split">
          <ProtectedRoute component={Split} />
        </Route>
        <Route path="/compress">
          <ProtectedRoute component={Compress} />
        </Route>
        <Route path="/protect">
          <ProtectedRoute component={Protect} />
        </Route>
        <Route path="/rotate">
          <ProtectedRoute component={Rotate} />
        </Route>
        <Route path="/pdf-to-jpg">
          <ProtectedRoute component={PdfToJpg} />
        </Route>
        <Route path="/jpg-to-pdf">
          <ProtectedRoute component={JpgToPdf} />
        </Route>
        <Route path="/watermark">
          <ProtectedRoute component={Watermark} />
        </Route>
        <Route path="/unlock">
          <ProtectedRoute component={Unlock} />
        </Route>
        <Route path="/ocr">
          <ProtectedRoute component={Ocr} />
        </Route>
        <Route path="/pdf-to-pptx">
          <ProtectedRoute component={PdfToPptx} />
        </Route>
        <Route path="/pdf-to-xlsx">
          <ProtectedRoute component={PdfToXlsx} />
        </Route>
        <Route path="/pptx-to-pdf">
          <ProtectedRoute component={PptxToPdf} />
        </Route>
        <Route path="/xlsx-to-pdf">
          <ProtectedRoute component={XlsxToPdf} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to ConvertSync" } },
        signUp: { start: { title: "Get started free", subtitle: "Create your ConvertSync account" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={Router} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
