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
import { toast } from "sonner";
import { preloadData, verifyScanOffline, queueScanOffline, getQueueCount, syncQueue } from "@/lib/offlineSync";

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastPayload = useRef<{ value: string; ts: number } | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    getQueueCount().then(setQueueCount);
    const handleOnline = () => {
      toast.success("Connexion rétablie, synchronisation...");
      void handleSync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  async function handlePreload() {
    setSyncing(true);
    try {
      const count = await preloadData();
      setOfflineReady(true);
      toast.success(`${count} billets préchargés pour le mode hors-ligne !`);
    } catch (e: any) {
      toast.error("Erreur de préchargement : " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSync() {
    if (!navigator.onLine) {
      return toast.error("Vous êtes hors-ligne");
    }
    setSyncing(true);
    try {
      const count = await syncQueue();
      if (count > 0) toast.success(`${count} scans synchronisés avec succès !`);
      setQueueCount(await getQueueCount());
      await preloadData(); // Refresh cache
    } catch (e: any) {
      toast.error("Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }

  const validatePayload = useCallback(async (rawPayload: string) => {
    if (busy) return;
    const payload = rawPayload.trim();
    if (!payload) return;

    const now = Date.now();
    if (lastPayload.current && lastPayload.current.value === payload && now - lastPayload.current.ts < COOLDOWN_MS) return;
    lastPayload.current = { value: payload, ts: now };

    setBusy(true);

    try {
      // Offline first verification
      if (offlineReady || queueCount > 0) {
        const local = await verifyScanOffline(payload);
        if (local.valid && local.invitation) {
          if (local.status === "utilise") {
            setResult({ status: "duplicate", participant: local.invitation.participant });
            feedback("duplicate");
          } else if (local.status === "actif") {
            await queueScanOffline(local.invitation.id);
            setQueueCount(c => c + 1);
            setResult({ status: "valid", participant: local.invitation.participant });
            feedback("valid");
            // Try background sync if online
            if (navigator.onLine) handleSync();
          } else {
            setResult({ status: "revoked", participant: local.invitation.participant });
            feedback("revoked");
          }
          return;
        }
      }

      // Fallback to API
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
  }, [busy, offlineReady, queueCount]);

  const handleDecode = useCallback(async (codes: IDetectedBarcode[]) => {
    if (!codes?.length) return;
    const payload = codes[0].rawValue?.trim();
    if (payload) await validatePayload(payload);
  }, [validatePayload]);

  async function scanImageFile(file: File) {
    if (!('BarcodeDetector' in window)) {
      toast.error("Scan depuis image non supporté par ce navigateur");
      return;
    }
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    try {
      const codes = await detector.detect(bitmap);
      const payload = codes[0]?.rawValue?.trim();
      if (!payload) return toast.error("Aucun QR code détecté dans l'image");
      await validatePayload(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lecture impossible";
      toast.error(msg);
    } finally {
      bitmap.close();
    }
  }

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
            <Button variant="outline" size="sm" onClick={handlePreload} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Précharger"}
            </Button>
            {queueCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
                Sync ({queueCount})
              </Button>
            )}
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
              onError={(error) => setCameraError(error instanceof Error ? error.message : "Caméra indisponible")}
              constraints={{
                facingMode: { ideal: facing },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
                // Macro / close-focus hints (best-effort, ignored by browsers that don't support them)
                advanced: [
                  { focusMode: "continuous" } as MediaTrackConstraintSet,
                  { focusDistance: 0.1 } as unknown as MediaTrackConstraintSet,
                ],
              } as MediaTrackConstraints}
              formats={["qr_code"]}
              scanDelay={100}
              allowMultiple
              paused={busy}
              styles={{ container: { width: "100%", height: "100%" }, video: { width: "100%", height: "100%", objectFit: "cover" } }}
              components={{ finder: false, torch: true, zoom: true }}
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

        {cameraError && (
          <p className="text-center text-xs text-destructive">{cameraError}</p>
        )}

        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <label>
              Scanner un QR depuis une image
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void scanImageFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
        </div>

        {/* Fullscreen Feedback Overlay */}
        {result && meta && Icon && (
          <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200", meta.color)}>
            <Icon className="h-32 w-32 text-white mb-6 animate-bounce" />
            <h1 className="text-5xl font-black text-white tracking-tight mb-2 text-center px-4">
              {meta.label}
            </h1>
            {result.participant ? (
              <div className="text-center text-white/90">
                <p className="text-3xl font-bold">{result.participant.full_name}</p>
                <p className="text-xl mt-2 uppercase tracking-widest opacity-80">{result.participant.category}</p>
              </div>
            ) : (
              <p className="text-2xl text-white/80">{result.reason ?? "QR non reconnu"}</p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Validation offline / serveur · Détection double-scan · Audio &amp; vibration
        </p>
      </main>
    </div>
  );
}
