CREATE TABLE public.qr_signature_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  old_uuid_secret uuid NOT NULL,
  old_signature text NOT NULL,
  regeneration_batch_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  regenerated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_signature_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view QR signature history"
ON public.qr_signature_history
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_qr_signature_history_invitation_id
ON public.qr_signature_history(invitation_id);

CREATE INDEX idx_qr_signature_history_batch_id
ON public.qr_signature_history(regeneration_batch_id);

CREATE INDEX idx_qr_signature_history_regenerated_at
ON public.qr_signature_history(regenerated_at DESC);