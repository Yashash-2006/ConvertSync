import { Link, useLocation } from "wouter";
import { FileDown, History, FilePlus2, Scissors, Archive, Lock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const PDF_TOOLS = [
  { href: "/merge", label: "Merge PDFs", icon: FilePlus2, color: "text-primary" },
  { href: "/split", label: "Split PDF", icon: Scissors, color: "text-orange-500" },
  { href: "/compress", label: "Compress PDF", icon: Archive, color: "text-green-600" },
  { href: "/protect", label: "Protect PDF", icon: Lock, color: "text-purple-600" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPdfTool = PDF_TOOLS.some((t) => location === t.href);

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
            {/* Converter */}
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
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border bg-card shadow-lg py-1 z-50">
                  {PDF_TOOLS.map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDropdownOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors",
                        location === href && "bg-muted font-medium",
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", color)} />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
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
