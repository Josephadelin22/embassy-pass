import localforage from "localforage";
import { supabase } from "@/integrations/supabase/client";

export type OfflineInvitation = {
  id: string;
  uuid_secret: string;
  signature: string;
  status: string;
  participant: {
    full_name: string;
    category: string;
  };
};

export type QueuedScan = {
  invitation_id: string;
  scanned_at: string;
};

// Configurer localforage
localforage.config({
  name: "EmbassyPass",
  storeName: "offline_data",
});

const INVITATIONS_KEY = "invitations_cache";
const QUEUE_KEY = "scans_queue";

export async function preloadData() {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, uuid_secret, signature, status, participants(full_name, category)");

  if (error) throw error;

  const mapped: OfflineInvitation[] = (data as any[]).map((row) => ({
    id: row.id,
    uuid_secret: row.uuid_secret,
    signature: row.signature,
    status: row.status,
    participant: {
      full_name: row.participants?.full_name || "Inconnu",
      category: row.participants?.category || "visiteur",
    },
  }));

  await localforage.setItem(INVITATIONS_KEY, mapped);
  return mapped.length;
}

export async function verifyScanOffline(qrPayload: string): Promise<{ valid: boolean; status?: string; invitation?: OfflineInvitation }> {
  const invitations = await localforage.getItem<OfflineInvitation[]>(INVITATIONS_KEY) || [];
  
  const [uuid, signature] = qrPayload.split(".");
  const inv = invitations.find((i) => i.uuid_secret === uuid && i.signature === signature);

  if (!inv) return { valid: false };

  return { valid: true, status: inv.status, invitation: inv };
}

export async function queueScanOffline(invitationId: string) {
  // 1. Ajouter à la queue
  const queue = await localforage.getItem<QueuedScan[]>(QUEUE_KEY) || [];
  queue.push({ invitation_id: invitationId, scanned_at: new Date().toISOString() });
  await localforage.setItem(QUEUE_KEY, queue);

  // 2. Mettre à jour le cache local pour éviter le double scan offline
  const invitations = await localforage.getItem<OfflineInvitation[]>(INVITATIONS_KEY) || [];
  const updated = invitations.map((inv) => 
    inv.id === invitationId ? { ...inv, status: "utilise" } : inv
  );
  await localforage.setItem(INVITATIONS_KEY, updated);
}

export async function getQueueCount(): Promise<number> {
  const queue = await localforage.getItem<QueuedScan[]>(QUEUE_KEY) || [];
  return queue.length;
}

export async function syncQueue(): Promise<number> {
  const queue = await localforage.getItem<QueuedScan[]>(QUEUE_KEY) || [];
  if (queue.length === 0) return 0;

  let successCount = 0;

  for (const scan of queue) {
    try {
      // Mettre à jour l'invitation sur supabase
      const { error: err1 } = await supabase
        .from("invitations")
        .update({ status: "utilise", used_at: scan.scanned_at })
        .eq("id", scan.invitation_id)
        .eq("status", "actif"); // Eviter d'écraser si déjà utilisé par un autre

      if (err1) throw err1;

      // Ajouter le check-in
      const { data: userData } = await supabase.auth.getUser();
      const { error: err2 } = await supabase
        .from("check_ins")
        .insert({
          invitation_id: scan.invitation_id,
          agent_id: userData?.user?.id,
          scanned_at: scan.scanned_at,
          device_info: "Offline Sync",
        });

      if (err2 && err2.code !== '23505') { // Ignore unique constraint if any
        throw err2;
      }

      successCount++;
    } catch (err) {
      console.error("Erreur sync scan", scan, err);
      // On continue pour essayer les autres
    }
  }

  // Si on a tout réussi, on vide la queue. Sinon on garde ceux qui ont échoué
  // Pour simplifier, on vide les X premiers qui ont réussi
  if (successCount === queue.length) {
    await localforage.removeItem(QUEUE_KEY);
  } else {
    // Si certains ont échoué (réseau coupé pendant le loop), on les garde
    const newQueue = queue.slice(successCount);
    await localforage.setItem(QUEUE_KEY, newQueue);
  }

  return successCount;
}
