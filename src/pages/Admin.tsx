import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Ticket, CheckCircle2, Wallet, Plus, ArrowRight, Crown, UserCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  total: number;
  present: number;
  vip: number;
  visiteur: number;
  exposant: number;
  revenue: number;
};

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, vip: 0, visiteur: 0, exposant: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [partsRes, invRes, txRes] = await Promise.all([
      supabase.from("participants").select("category"),
      supabase.from("invitations").select("status"),
      supabase.from("transactions").select("amount"),
    ]);
    const parts = partsRes.data ?? [];
    const invs = invRes.data ?? [];
    const txs = txRes.data ?? [];
    setStats({
      total: parts.length,
      present: invs.filter((i) => i.status === "utilise").length,
      vip: parts.filter((p) => p.category === "vip").length,
      visiteur: parts.filter((p) => p.category === "visiteur").length,
      exposant: parts.filter((p) => p.category === "exposant").length,
      revenue: txs.reduce((s, t) => s + Number(t.amount), 0),
    });
    setLoading(false);
  }

  const cards = [
    { label: "Invités enregistrés", value: stats.total, icon: Users, tone: "primary" as const },
    { label: "Présents", value: stats.present, icon: CheckCircle2, tone: "success" as const },
    { label: "Invitations émises", value: stats.total, icon: Ticket, tone: "primary" as const },
    { label: "Recettes (XAF)", value: stats.revenue.toLocaleString("fr-FR"), icon: Wallet, tone: "accent" as const },
  ];

  const cats = [
    { label: "VIP", value: stats.vip, icon: Crown, color: "text-accent" },
    { label: "Visiteurs", value: stats.visiteur, icon: UserCheck, color: "text-primary" },
    { label: "Exposants", value: stats.exposant, icon: Building2, color: "text-primary-glow" },
  ];

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de la foire</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold">
          <Link to="/admin/participants/new"><Plus className="h-4 w-4 mr-2" />Nouvelle invitation</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 shadow-card border-border/60">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{c.label}</div>
                <div className="text-3xl font-display font-bold mt-2">
                  {loading ? "—" : c.value}
                </div>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                c.tone === "accent" && "bg-gradient-gold text-accent-foreground",
                c.tone === "success" && "bg-success/10 text-success",
                c.tone === "primary" && "bg-primary/10 text-primary",
              )}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {cats.map((c) => (
          <Card key={c.label} className="p-5 shadow-card border-border/60">
            <div className="flex items-center gap-3">
              <c.icon className={cn("h-8 w-8", c.color)} />
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-display font-bold">{c.value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 shadow-card border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg">Gérer les participants</h3>
            <p className="text-sm text-muted-foreground">Liste, recherche, téléchargement des badges</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/participants">Ouvrir <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>
      </Card>
    </AdminShell>
  );
}
