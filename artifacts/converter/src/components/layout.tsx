import { Link, useLocation } from "wouter";
import { useClerk, useUser, Show } from "@clerk/react";
import {
  FileDown, History, FilePlus2, Scissors, Archive, Lock, ChevronDown,
  RotateCw, ImageIcon, ImagePlus, Stamp, LockOpen, ScanText,
  Presentation, TableProperties, LogIn, LogOut, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface NavTool {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

interface NavCategory {
  heading: string;
  tools: NavTool[];
}

const PDF_CATEGORIES: NavCategory[] = [
  {
    heading: "Organize",
    tools: [
      { href: "/merge",    label: "Merge PDFs",    icon: FilePlus2,   color: "text-primary" },
      { href: "/split",    label: "Split PDF",     icon: Scissors,    color: "text-orange-500" },
      { href: "/rotate",   label: "Rotate PDF",    icon: RotateCw,    color: "text-blue-500" },
    ],
  },
  {
    heading: "Convert",
    tools: [
      { href: "/pdf-to-jpg",   label: "PDF → JPG",        icon: ImageIcon,       color: "text-pink-500" },
      { href: "/jpg-to-pdf",   label: "Images → PDF",     icon: ImagePlus,       color: "text-indigo-500" },
      { href: "/pdf-to-pptx",  label: "PDF → PowerPoint", icon: Presentation,    color: "text-orange-500" },
      { href: "/pptx-to-pdf",  label: "PowerPoint → PDF", icon: Presentation,    color: "text-red-500" },
      { href: "/pdf-to-xlsx",  label: "PDF → Excel",      icon: TableProperties, color: "text-green-600" },
      { href: "/xlsx-to-pdf",  label: "Excel → PDF",      icon: TableProperties, color: "text-emerald-600" },
    ],
  },
  {
    heading: "Optimize",
    tools: [
      { href: "/compress", label: "Compress PDF", icon: Archive,   color: "text-green-600" },
      { href: "/ocr",      label: "OCR PDF",      icon: ScanText,  color: "text-teal-600" },
    ],
  },
  {
    heading: "Security",
    tools: [
      { href: "/protect",   label: "Protect PDF",   icon: Lock,     color: "text-purple-600" },
      { href: "/unlock",    label: "Unlock PDF",    icon: LockOpen, color: "text-cyan-500" },
      { href: "/watermark", label: "Watermark PDF", icon: Stamp,    color: "text-amber-500" },
    ],
  },
];

const ALL_TOOLS: NavTool[] = PDF_CATEGORIES.flatMap((c) => c.tools);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const initial = user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
            {initial.toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-foreground max-w-[120px] truncate hidden sm:block">
          {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border bg-card shadow-lg py-1 z-50">
          <div className="px-4 py-2.5 border-b">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses?.[0]?.emailAddress}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut({ redirectUrl: basePath || "/" }); }}
            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPdfTool = ALL_TOOLS.some((t) => location === t.href);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
                location === "/" ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              Converter
            </Link>

            {/* PDF Tools dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                  isPdfTool ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                PDF Tools
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-lg border bg-card shadow-lg py-1.5 z-50 max-h-[80vh] overflow-y-auto">
                  {PDF_CATEGORIES.map((cat, ci) => (
                    <div key={cat.heading}>
                      {ci > 0 && <div className="h-px bg-border mx-2 my-1" />}
                      <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat.heading}
                      </p>
                      {cat.tools.map(({ href, label, icon: Icon, color }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDropdownOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors",
                            location === href && "bg-muted font-medium",
                          )}
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", color)} />
                          {label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/history"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                location === "/history" ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              <History className="w-4 h-4" />
              History
            </Link>

            {/* Auth */}
            <div className="ml-1 pl-1 border-l">
              <Show when="signed-in">
                <UserMenu />
              </Show>
              <Show when="signed-out">
                <Link href="/sign-in">
                  <Button size="sm" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </Button>
                </Link>
              </Show>
            </div>
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
