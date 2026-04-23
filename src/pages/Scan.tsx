import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Camera, CameraOff, RotateCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ScanStatus = "valid" | "duplicate" | "invalid" | "revoked" | "error";

type ScanResult = {
  status: ScanStatus;
  participant?: { full_name: string; category: string; organization: string | null } | null;
  first_scan_at?: string | null;
  reason?: string;
};

const COOLDOWN_MS = 2500;

// --- Audio + haptic feedback ---
let audioCtx: AudioContext | null = null;
function ctx() {
  if (!audioCtx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    audioCtx = new AC();
  }
  return audioCtx;
}
function beep(freq: number, duration = 0.18, type: OscillatorType = "sine", gain = 0.15) {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  } catch {/* ignore */}
}
function feedback(status: ScanStatus) {
  const v = (p: number | number[]) => navigator.vibrate?.(p);
  if (status === "valid") { beep(880, 0.12, "sine", 0.18); setTimeout(() => beep(1320, 0.18, "sine", 0.18), 120); v(120); }
  else if (status === "duplicate") { beep(520, 0.25, "square", 0.12); v([80, 60, 80]); }
  else { beep(180, 0.45, "sawtooth", 0.18); v([200, 80, 200]); }
}

function statusMeta(s: ScanStatus) {
  switch (s) {
    case "valid": return { label: "ACCÈS AUTORISÉ", color: "bg-emerald-500", ring: "ring-emerald-500", text: "text-emerald-600", icon: CheckCircle2 };
    case "duplicate": return { label: "DÉJÀ SCANNÉ", color: "bg-amber-500", ring: "ring-amber-500", text: "text-amber-600", icon: AlertTriangle };
    case "revoked": return { label: "INVITATION RÉVOQUÉE", color: "bg-red-600", ring: "ring-red-600", text: "text-red-600", icon: XCircle };
    case "invalid": return { label: "QR INVALIDE", color: "bg-red-600", ring: "ring-red-600", text: "text-red-600", icon: XCircle };
    default: return { label: "ERREUR", color: "bg-zinc-700", ring: "ring-zinc-700", text: "text-zinc-700", icon: XCircle };
  }
}

function formatDateTime(iso: string) {
  try { return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }); }
  catch { return iso; }
}

export default function Scan() {
  const [active, setActive] = useState(true);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const lastPayload = useRef<{ value: string; ts: number } | null>(null);

  const handleDecode = useCallback(async (codes: IDetectedBarcode[]) => {
    if (!codes?.length || busy) return;
    const payload = codes[0].rawValue?.trim();
    if (!payload) return;

    const now = Date.now();
    if (lastPayload.current && lastPayload.current.value === payload && now - lastPayload.current.ts < COOLDOWN_MS) return;
    lastPayload.current = { value: payload, ts: now };

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-scan", {
        body: { payload, device_info: navigator.userAgent },
      });
      if (error) throw error;
      const r = data as ScanResult;
      setResult(r);
      feedback(r.status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erreur réseau";
      setResult({ status: "error", reason: msg });
      feedback("error");
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  }, [busy]);

  // Auto-clear result after a delay so the agent is ready for next scan
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.status === "valid" ? 3500 : 5000);
    return () => clearTimeout(t);
  }, [result]);

  const meta = result ? statusMeta(result.status) : null;
  const Icon = meta?.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-14">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/">Accueil</Link></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-xl py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Scanner QR</h1>
            <p className="text-xs text-muted-foreground">Pointez la caméra vers le badge invité</p>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setFacing(f => f === "environment" ? "user" : "environment")} title="Changer de caméra">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant={active ? "destructive" : "default"} size="icon" onClick={() => setActive(a => !a)} title={active ? "Pause" : "Démarrer"}>
              {active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Camera */}
        <Card className={cn(
          "relative overflow-hidden aspect-square ring-4 ring-transparent transition-all shadow-elegant",
          meta && `ring-offset-2 ${meta.ring}`,
        )}>
          {active ? (
            <Scanner
              key={facing}
              onScan={handleDecode}
              constraints={{ facingMode: facing }}
              formats={["qr_code"]}
              scanDelay={250}
              styles={{ container: { width: "100%", height: "100%" }, video: { width: "100%", height: "100%", objectFit: "cover" } }}
              components={{ finder: false, audio: false, torch: true, zoom: true }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <div className="text-center text-muted-foreground">
                <CameraOff className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">Caméra en pause</p>
              </div>
            </div>
          )}

          {/* Reticle */}
          {active && !result && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-2/3 aspect-square border-2 border-white/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {busy && (
            <div className="absolute top-2 right-2 bg-background/90 px-2 py-1 rounded-full flex items-center gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> Vérification…
            </div>
          )}
        </Card>

        {/* Result */}
        {result && meta && Icon && (
          <Card className={cn("p-5 animate-fade-in border-2", meta.ring.replace("ring-", "border-"))}>
            <div className="flex items-start gap-4">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-white shrink-0", meta.color)}>
                <Icon className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <Badge className={cn("text-white", meta.color)}>{meta.label}</Badge>
                {result.participant ? (
                  <>
                    <h2 className="text-xl font-bold mt-2 truncate">{result.participant.full_name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="uppercase tracking-wide font-semibold">{result.participant.category}</span>
                      {result.participant.organization && <>· <span className="truncate">{result.participant.organization}</span></>}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">{result.reason ?? "QR non reconnu"}</p>
                )}

                {result.first_scan_at && (
                  <div className="mt-3 flex items-center gap-2 text-sm rounded-lg bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2">
                    <Clock className="h-4 w-4" />
                    <span>1er passage&nbsp;: <strong>{formatDateTime(result.first_scan_at)}</strong></span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setResult(null)}>Scanner suivant</Button>
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Validation HMAC côté serveur · Détection double-scan · Audio &amp; vibration
        </p>
      </main>
    </div>
  );
}
