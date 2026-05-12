-- Rol barbero_independiente: mismo modelo que dueño (admin_id en barberias) pero sin códigos
-- de invitación ni colaboradores extra. Si public.profiles no existe en un entorno, este
-- archivo no hace nada destructivo salvo los triggers sobre barberias/barberos.

-- ── 1) Ampliar CHECK de profiles.role (solo constraints cuyo texto menciona 'role') ──
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'profiles' AND c.conname = 'profiles_role_values_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_values_check CHECK (
      role IS NULL
      OR role IN (
        'cliente',
        'admin_barberia',
        'barbero_empleado',
        'barbero_independiente',
        'barbero'
      )
    );
  END IF;
END $$;

-- ── 2) Anular invite_* si el dueño del local es barbero_independiente ───────────────
CREATE OR REPLACE FUNCTION public.barberias_clear_invite_for_independiente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role text;
BEGIN
  IF NEW.admin_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT p.role INTO admin_role FROM public.profiles p WHERE p.id = NEW.admin_id;
  IF admin_role = 'barbero_independiente' THEN
    NEW.invite_code := NULL;
    NEW.invite_code_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barberias_bi_clear_invite_independiente ON public.barberias;
CREATE TRIGGER barberias_bi_clear_invite_independiente
  BEFORE INSERT OR UPDATE ON public.barberias
  FOR EACH ROW
  EXECUTE PROCEDURE public.barberias_clear_invite_for_independiente();

-- ── 3) Impedir filas en barberos que no sean el admin en locales de independiente ───
CREATE OR REPLACE FUNCTION public.barberos_reject_extra_for_independiente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b_admin uuid;
  admin_role text;
BEGIN
  SELECT b.admin_id INTO b_admin FROM public.barberias b WHERE b.id = NEW.barberia_id;
  IF b_admin IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT p.role INTO admin_role FROM public.profiles p WHERE p.id = b_admin;
  IF admin_role = 'barbero_independiente' AND NEW.id IS DISTINCT FROM b_admin THEN
    RAISE EXCEPTION 'Este local no admite colaboradores (cuenta independiente).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barberos_bi_reject_extra_independiente ON public.barberos;
CREATE TRIGGER barberos_bi_reject_extra_independiente
  BEFORE INSERT ON public.barberos
  FOR EACH ROW
  EXECUTE PROCEDURE public.barberos_reject_extra_for_independiente();
