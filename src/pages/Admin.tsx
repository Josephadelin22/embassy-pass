import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Ticket, CheckCircle2, Wallet, Plus, ArrowRight, Crown, UserCheck, Building2, RefreshCw, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Stats = {
  total: number;
  present: number;
  vip: number;
  visiteur: number;
  exposant: number;
  revenue: number;
};

type RegenerationBatch = {
  batchId: string;
  regeneratedAt: string;
  adminId: string;
  count: number;
};

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, vip: 0, visiteur: 0, exposant: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [qrHistory, setQrHistory] = useState<RegenerationBatch[]>([]);
  const [resetting, setResetting] = useState(false);

  async function resetSystem() {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-system");
      if (error) throw error;
      toast.success("Système réinitialisé à zéro");
      await load();
      await loadQrHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  }

  async function regenerateAll() {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-qrs", {
        body: { only_active: true },
      });
      if (error) throw error;
      toast.success(`${data?.updated ?? 0} QR régénérés. Lot ${String(data?.batch_id ?? "").slice(0, 8)} enregistré.`);
      await loadQrHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la régénération");
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => { void load(); void loadQrHistory(); }, []);

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

  async function loadQrHistory() {
    const { data, error } = await supabase
      .from("qr_signature_history")
      .select("regeneration_batch_id, regenerated_at, admin_id")
      .order("regenerated_at", { ascending: false })
      .limit(250);
    if (error) return;

    const grouped = new Map<string, RegenerationBatch>();
    for (const row of data ?? []) {
      const existing = grouped.get(row.regeneration_batch_id);
      if (existing) existing.count += 1;
      else grouped.set(row.regeneration_batch_id, {
        batchId: row.regeneration_batch_id,
        regeneratedAt: row.regenerated_at,
        adminId: row.admin_id,
        count: 1,
      });
    }
    setQrHistory(Array.from(grouped.values()).slice(0, 5));
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
  }

  const cards = [
    { label: "Invités enregistrés", value: stats.total, icon: Users, tone: "primary" as const },
    { label: "Présents", value: stats.present, icon: CheckCircle2, tone: "success" as const },
    { label: "Invitations émises", value: stats.total, icon: Ticket, tone: "primary" as const },
    { label: "Recettes (RWF)", value: stats.revenue.toLocaleString("fr-FR"), icon: Wallet, tone: "accent" as const },
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

      <Card className="p-6 shadow-card border-border/60 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-lg">Gérer les participants</h3>
            <p className="text-sm text-muted-foreground">Liste, recherche, téléchargement des badges</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/participants">Ouvrir <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>
      </Card>

      <Card className="p-6 shadow-card border-border/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-lg">Régénérer tous les QR codes</h3>
            <p className="text-sm text-muted-foreground">
              Crée de nouvelles signatures pour toutes les invitations actives. Les anciens badges seront définitivement invalides — pensez à retélécharger et redistribuer les nouveaux PDF/PNG.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={regenerating}>
                <RefreshCw className={cn("h-4 w-4 mr-2", regenerating && "animate-spin")} />
                {regenerating ? "Régénération..." : "Régénérer en masse"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la régénération</AlertDialogTitle>
                <AlertDialogDescription>
                  Tous les QR actifs seront remplacés. Les anciens badges déjà imprimés ou envoyés ne fonctionneront plus. Les invitations déjà utilisées (présents) ne sont pas modifiées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={regenerateAll}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      <Card className="p-6 shadow-card border-border/60 mt-4 bg-destructive/5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-lg text-destructive">Réinitialisation complète</h3>
            <p className="text-sm text-muted-foreground">
              Supprime TOUS les participants, invitations et scans. Cette opération est irréversible.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={resetting}>
                <RefreshCw className={cn("h-4 w-4 mr-2", resetting && "animate-spin")} />
                {resetting ? "Réinitialisation..." : "Réinitialiser le système"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">ATTENTION : Réinitialisation totale</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous ABSOLUMENT sûr ? Cette action va supprimer tous les invités, tous les scans effectués et toutes les transactions. Il n'y a aucun moyen de revenir en arrière.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={resetSystem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmer la suppression totale
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      <Card className="p-6 shadow-card border-border/60 mt-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-lg">Historique des régénérations QR</h3>
            <div className="mt-3 space-y-2">
              {qrHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun lot régénéré pour le moment.</p>
              ) : qrHistory.map((batch) => (
                <div key={batch.batchId} className="rounded-lg border border-border/60 px-3 py-2 text-sm flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">Lot {batch.batchId.slice(0, 8)} · {batch.count} QR</span>
                  <span className="text-muted-foreground">{formatDateTime(batch.regeneratedAt)} · Admin {batch.adminId.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}
