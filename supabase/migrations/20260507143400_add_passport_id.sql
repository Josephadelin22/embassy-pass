-- Add passport_id to participants table
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS passport_id text;
