import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Download, ArrowLeft, CheckCircle2 } from "lucide-react";
import { generateBadgeQR, generateBadgePDF, downloadBlob } from "@/lib/qr";

const Schema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(120),
  email: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  category: z.enum(["vip", "visiteur", "exposant"]),
  organization: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  amount: z.coerce.number().nonnegative("Montant invalide").max(10_000_000),
  payment_method: z.string().trim().max(40).optional().or(z.literal("")),
});

const presets = { vip: 5000, visiteur: 3000, exposant: 0 };

export default function NewParticipant() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; cat: string; org?: string | null; qr: string; ref: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    category: "visiteur" as "vip" | "visiteur" | "exposant",
    organization: "",
    notes: "",
    amount: 3000,
    payment_method: "Espèces",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invitation", {
        body: parsed.data,
      });
      if (error) throw error;
      const qr = await generateBadgeQR(data.qr_payload);
      setDone({
        name: form.full_name,
        cat: form.category,
        org: form.organization,
        qr,
        ref: data.invitation.id,
      });
      toast.success("Invitation créée");
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!done) return;
    const pdf = await generateBadgePDF({
      qrDataUrl: done.qr,
      fullName: done.name,
      category: done.cat,
      organization: done.org,
      reference: done.ref,
    });
    downloadBlob(pdf, `badge-${done.name.replace(/\s+/g, "-")}.pdf`);
  }

  if (done) {
    return (
      <AdminShell>
        <div className="max-w-md mx-auto animate-scale-in">
          <Card className="p-8 text-center shadow-elegant">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success mb-4">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Invitation créée</h2>
            <p className="text-sm text-muted-foreground mb-6">{done.name}</p>
            <div className="bg-white p-4 rounded-xl border border-border inline-block mb-6">
              <img src={done.qr} alt="QR" className="w-56 h-56" />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={download} size="lg" className="bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold">
                <Download className="h-4 w-4 mr-2" />Télécharger le badge PDF
              </Button>
              <Button variant="outline" onClick={() => { setDone(null); setForm({ ...form, full_name: "", email: "", phone: "", organization: "", notes: "" }); }}>
                Créer un autre invité
              </Button>
              <Button variant="ghost" onClick={() => nav("/admin/participants")}>Voir la liste</Button>
            </div>
          </Card>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />Retour
      </Button>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-display font-bold mb-1">Nouvelle invitation</h1>
        <p className="text-sm text-muted-foreground mb-6">Le QR code premium est généré automatiquement</p>

        <Card className="p-6 shadow-card">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nom complet *</Label>
                <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: any) => {
                    update("category", v);
                    update("amount", presets[v as keyof typeof presets]);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vip">VIP — 5 000 XAF</SelectItem>
                    <SelectItem value="visiteur">Visiteur — 3 000 XAF</SelectItem>
                    <SelectItem value="exposant">Exposant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Input value={form.organization} onChange={(e) => update("organization", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Montant payé (XAF)</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => update("amount", Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Mode paiement</Label>
                <Input value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={busy} size="lg" className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer l'invitation
            </Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
