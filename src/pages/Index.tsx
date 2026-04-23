import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LayoutDashboard,
  ScanLine,
  ShieldCheck,
  LogIn,
  LogOut,
  ArrowRight,
} from "lucide-react";

const Index = () => {
  const { user, isAdmin, isAgent, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
                <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/auth"); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Connexion</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent))_0%,transparent_50%)]" />
        <div className="container relative py-20 md:py-28 animate-fade-in">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs uppercase tracking-widest font-semibold mb-6">
              <ShieldCheck className="h-3 w-3" /> Foire Ambassade du Gabon
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-[1.05] mb-6">
              Contrôle d'accès <span className="text-accent">premium</span><br />
              par INOV E-TECH
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl">
              Génération d'invitations sécurisées, scan QR temps réel et synchronisation cloud.
              Une expérience digne d'un événement officiel.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent-glow shadow-gold">
                <Link to="/admin">
                  <LayoutDashboard className="h-5 w-5 mr-2" />
                  Tableau de bord Admin
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/scan">
                  <ScanLine className="h-5 w-5 mr-2" />
                  Scanner agent
                </Link>
              </Button>
              {!user && (
                <Button asChild size="lg" variant="outline" className="border-accent/40 text-accent hover:bg-accent/10">
                  <Link to="/auth">
                    Connexion
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="container py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
            Trois modules. Une seule plateforme.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Architecture pensée pour la fiabilité terrain et la traçabilité totale.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: LayoutDashboard,
              title: "Module Admin",
              desc: "Gestion des invités, transactions et statistiques en temps réel.",
              tone: "primary",
            },
            {
              icon: ScanLine,
              title: "Module Agent",
              desc: "Scanner QR mobile avec retour visuel immédiat (vert / rouge).",
              tone: "accent",
            },
            {
              icon: ShieldCheck,
              title: "Sécurité",
              desc: "QR codes signés HMAC, rôles granulaires, RLS Postgres.",
              tone: "primary",
            },
          ].map((m) => (
            <Card
              key={m.title}
              className="p-6 shadow-card hover:shadow-elegant transition-smooth border-border/60 group"
            >
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
                  m.tone === "accent"
                    ? "bg-gradient-gold text-accent-foreground shadow-gold"
                    : "bg-gradient-primary text-primary-foreground"
                }`}
              >
                <m.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="container text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} INOV E-TECH .L — Tous droits réservés
        </div>
      </footer>
    </div>
  );
};

export default Index;
