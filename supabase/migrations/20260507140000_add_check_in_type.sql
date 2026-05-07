-- Add check_in_type to check_ins table
ALTER TABLE public.check_ins ADD COLUMN IF NOT EXISTS check_in_type text DEFAULT 'entree';

-- Update existing check_ins to have 'entree' type if null
UPDATE public.check_ins SET check_in_type = 'entree' WHERE check_in_type IS NULL;
