import { useEffect, useMemo, useState, useRef } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Plus, Search, Download, Upload, QrCode, CheckCircle2, Clock, Image as ImageIcon, FileDown, Trash2, Loader2 } from "lucide-react";
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
import { generateBadgeQR, generateBadgePDF, downloadBlob, downloadDataUrl } from "@/lib/qr";
import { toast } from "sonner";
import { exportCsv, parseCsv } from "@/lib/csv";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  category: "vip" | "visiteur" | "exposant";
  organization: string | null;
  invitation: { id: string; uuid_secret: string; signature: string; status: string } | null;
};

type CategoryFilter = "all" | "vip" | "visiteur" | "exposant";
type StatusFilter = "all" | "actif" | "utilise";

const catColor: Record<string, string> = {
  vip: "bg-gradient-gold text-accent-foreground",
  visiteur: "bg-primary/10 text-primary",
  exposant: "bg-primary-glow/15 text-primary-glow",
};

export default function Participants() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("participants")
      .select("id, full_name, email, phone, category, organization, invitations(id, uuid_secret, signature, status)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, invitation: r.invitations?.[0] ?? null })));
    setLoading(false);
  }

  const counts = useMemo(() => ({
    all: rows.length,
    vip: rows.filter((r) => r.category === "vip").length,
    visiteur: rows.filter((r) => r.category === "visiteur").length,
    exposant: rows.filter((r) => r.category === "exposant").length,
    actif: rows.filter((r) => r.invitation?.status !== "utilise").length,
    utilise: rows.filter((r) => r.invitation?.status === "utilise").length,
  }), [rows]);

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    const matchesSearch = !s || (
      r.full_name.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      r.phone?.toLowerCase().includes(s) ||
      r.organization?.toLowerCase().includes(s)
    );

    const matchesCategory = category === "all" || r.category === category;
    const invitationStatus = r.invitation?.status === "utilise" ? "utilise" : "actif";
    const matchesStatus = status === "all" || invitationStatus === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  async function buildQr(r: Row) {
    if (!r.invitation) throw new Error("Pas d'invitation");
    const payload = `${r.invitation.uuid_secret}.${r.invitation.signature}`;
    return generateBadgeQR(payload);
  }

  async function downloadPdf(r: Row) {
    if (!r.invitation) return toast.error("Pas d'invitation");
    setBusy(`${r.id}-pdf`);
    try {
      const qr = await buildQr(r);
      const pdf = await generateBadgePDF({
        qrDataUrl: qr,
        fullName: r.full_name,
        category: r.category,
        organization: r.organization,
        reference: r.invitation.id,
      });
      downloadBlob(pdf, `badge-${r.full_name.replace(/\s+/g, "-")}.pdf`);
    } catch {
      toast.error("Erreur génération badge PDF");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPng(r: Row) {
    if (!r.invitation) return toast.error("Pas d'invitation");
    setBusy(`${r.id}-png`);
    try {
      const qr = await buildQr(r);
      downloadDataUrl(qr, `badge-${r.full_name.replace(/\s+/g, "-")}.png`);
    } catch {
      toast.error("Erreur génération badge PNG");
    } finally {
      setBusy(null);
    }
  }

  async function deleteParticipant(r: Row) {
    setBusy(`${r.id}-del`);
    try {
      if (r.invitation) {
        const { error: e1 } = await supabase.from("invitations").delete().eq("id", r.invitation.id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase.from("participants").delete().eq("id", r.id);
      if (e2) throw e2;
      toast.success(`${r.full_name} supprimé`);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression");
    } finally {
      setBusy(null);
    }
  }

  function handleExportCsv() {
    const data = filtered.map(r => ({
      full_name: r.full_name,
      email: r.email || "",
      phone: r.phone || "",
      category: r.category,
      organization: r.organization || "",
      is_used: r.invitation?.status === "utilise" ? "Oui" : "Non",
    }));
    exportCsv(data, `participants-${category}-${status}.csv`);
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const data = await parseCsv(file);
      if (!data || data.length === 0) throw new Error("Fichier vide ou invalide");
      
      setImportProgress({ current: 0, total: data.length });
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row.full_name) {
          errorCount++;
          continue;
        }

        try {
          const payload = {
            full_name: row.full_name,
            email: row.email || "",
            phone: row.phone || "",
            category: ["vip", "visiteur", "exposant"].includes(row.category?.toLowerCase()) ? row.category.toLowerCase() : "visiteur",
            organization: row.organization || "",
            notes: row.notes || "Importé par CSV",
            amount: Number(row.amount) || 0,
            payment_method: row.payment_method || "",
          };

          const { error } = await supabase.functions.invoke("create-invitation", {
            body: payload,
          });

          if (error) throw error;
          successCount++;
        } catch (err) {
          console.error("Erreur import ligne", i + 1, err);
          errorCount++;
        }
        
        setImportProgress({ current: i + 1, total: data.length });
      }

      toast.success(`Import terminé : ${successCount} succès, ${errorCount} erreurs`);
      void load();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'importation");
    } finally {
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Participants</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} résultat{filtered.length > 1 ? "s" : ""} sur {rows.length}</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCsv} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importProgress !== null}>
            {importProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {importProgress ? `${importProgress.current}/${importProgress.total}` : "Importer CSV"}
          </Button>
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button asChild className="bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold">
            <Link to="/admin/participants/new"><Plus className="h-4 w-4 mr-2" />Nouvel invité</Link>
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4 shadow-card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, téléphone, organisation..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", `Toutes (${counts.all})`],
              ["vip", `VIP (${counts.vip})`],
              ["visiteur", `Visiteurs (${counts.visiteur})`],
              ["exposant", `Exposants (${counts.exposant})`],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={category === value ? "default" : "outline"}
                onClick={() => setCategory(value as CategoryFilter)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["all", `Tous les statuts (${counts.all})`],
              ["actif", `En attente (${counts.actif})`],
              ["utilise", `Présents (${counts.utilise})`],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={status === value ? "secondary" : "outline"}
                onClick={() => setStatus(value as StatusFilter)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun participant trouvé avec ces filtres.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4 hover:bg-muted/30 transition-smooth">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{r.full_name}</span>
                    <Badge className={catColor[r.category]}>{r.category.toUpperCase()}</Badge>
                    {r.invitation?.status === "utilise" ? (
                      <Badge variant="outline" className="border-success text-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Présent
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />En attente
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {[r.email, r.phone, r.organization].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || !r.invitation}
                    onClick={() => void downloadPng(r)}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    {busy === `${r.id}-png` ? "..." : "PNG"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || !r.invitation}
                    onClick={() => void downloadPdf(r)}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    {busy === `${r.id}-pdf` ? "..." : "PDF"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {busy === `${r.id}-del` ? "..." : "Supprimer"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cet invité ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action supprimera définitivement <strong>{r.full_name}</strong> ainsi que son invitation et son QR code. Cette opération est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void deleteParticipant(r)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
