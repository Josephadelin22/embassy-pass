import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, Users, ScanLine, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, isAgent } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const links = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/participants", label: "Participants", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Watermark logo en arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      >
        <img
          src={inovLogo}
          alt=""
          className="w-[60vmin] max-w-[700px] opacity-[0.035] select-none"
        />
      </div>
      <div className="relative z-10">
      <header className="border-b border-border/60 bg-card/90 backdrop-blur sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16 gap-6">
          <Link to="/"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = loc.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-smooth flex items-center gap-2",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {isAgent && (
              <Button asChild variant="outline" size="sm">
                <Link to="/scan"><ScanLine className="h-4 w-4 mr-2" />Scanner</Link>
              </Button>
            )}
            <span className="hidden lg:inline text-xs text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); nav("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="md:hidden border-t border-border/60 flex">
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <Link key={l.to} to={l.to}
                className={cn(
                  "flex-1 text-center py-2.5 text-xs font-medium flex items-center justify-center gap-1.5",
                  active ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                )}>
                <l.icon className="h-3.5 w-3.5" /> {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="container py-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
