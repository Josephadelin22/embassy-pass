import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AdminPlaceholder() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Accueil</Link>
          </Button>
        </div>
      </header>
      <main className="container py-16 animate-fade-in">
        <Card className="p-12 text-center max-w-2xl mx-auto shadow-elegant">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-gold shadow-gold mb-6">
            <Construction className="h-8 w-8 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-3">Tableau de bord Admin</h1>
          <p className="text-muted-foreground">
            Étape 2 — Gestion des invités, génération QR et statistiques.
          </p>
        </Card>
      </main>
    </div>
  );
}
