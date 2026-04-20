-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'viewer');
CREATE TYPE public.participant_category AS ENUM ('vip', 'visiteur', 'exposant');
CREATE TYPE public.invitation_status AS ENUM ('actif', 'utilise', 'annule');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ PARTICIPANTS ============
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  category public.participant_category NOT NULL DEFAULT 'visiteur',
  organization TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid_secret UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status public.invitation_status NOT NULL DEFAULT 'actif',
  signature TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_invitations_participant ON public.invitations(participant_id);
CREATE INDEX idx_invitations_status ON public.invitations(status);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============ CHECK_INS ============
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_info TEXT
);
CREATE INDEX idx_checkins_invitation ON public.check_ins(invitation_id);
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- participants
CREATE POLICY "Staff view participants" ON public.participants
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'viewer')
  );
CREATE POLICY "Admins insert participants" ON public.participants
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update participants" ON public.participants
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete participants" ON public.participants
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- invitations
CREATE POLICY "Staff view invitations" ON public.invitations
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'viewer')
  );
CREATE POLICY "Admins insert invitations" ON public.invitations
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update invitations" ON public.invitations
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents update invitation status" ON public.invitations
  FOR UPDATE USING (public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins delete invitations" ON public.invitations
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- transactions
CREATE POLICY "Staff view transactions" ON public.transactions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'viewer')
  );
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- check_ins
CREATE POLICY "Staff view checkins" ON public.check_ins
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'viewer')
  );
CREATE POLICY "Agents create checkins" ON public.check_ins
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
  );

-- ============ TRIGGERS ============

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER participants_updated_at BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + assign admin role to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();