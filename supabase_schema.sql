-- ═══════════════════════════════════════════════════
--  HealthOps · Supabase Schema
--  Run in: https://supabase.com/dashboard/project/irodzmlnddwkjyshcgct/sql/new
-- ═══════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────
-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  email         TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  role_label    TEXT,           -- "Enfermera", "TENS", "Auxiliar", etc.
  project       TEXT,           -- "CardioHome Sur", "Speech Norte", etc.
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alert')),
  rut           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── SHIFTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project       TEXT NOT NULL,
  shift_date    DATE NOT NULL,
  start_time    TIME NOT NULL DEFAULT '08:00',
  end_time      TIME NOT NULL DEFAULT '20:00',
  status        TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','late','absent','cancelled')),
  fee           INTEGER DEFAULT 28000,  -- CLP
  notes         TEXT,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ATTENDANCES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_id        UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'present' CHECK (status IN ('present','late','absent')),
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  checkin_lat     DOUBLE PRECISION,
  checkin_lng     DOUBLE PRECISION,
  checkout_lat    DOUBLE PRECISION,
  checkout_lng    DOUBLE PRECISION,
  late_minutes    INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REQUESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('inasistencia','reclamo','cambio')),
  description     TEXT,
  affected_date   DATE,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOLETAS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boletas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INTEGER NOT NULL,
  amount          INTEGER NOT NULL DEFAULT 0,  -- CLP
  file_url        TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','paid','rejected')),
  submitted_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  paid_by         UUID REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (worker_id, period_month, period_year)
);

-- ─── DOCUMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  file_url        TEXT,
  file_type       TEXT,
  size_bytes      INTEGER,
  category        TEXT DEFAULT 'general' CHECK (category IN ('general','contratos','licitaciones','protocolos','boletas','turnos')),
  worker_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ALERTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('late_critical','late_warning','absent','document_missing')),
  message         TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts      ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES: user sees own, admin sees all
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- SHIFTS: workers see own, admins see all
CREATE POLICY "shifts_select" ON public.shifts FOR SELECT
  USING (worker_id = auth.uid() OR public.is_admin());
CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE
  USING (public.is_admin());

-- ATTENDANCES: workers insert/see own, admin sees all
CREATE POLICY "att_select" ON public.attendances FOR SELECT
  USING (worker_id = auth.uid() OR public.is_admin());
CREATE POLICY "att_insert" ON public.attendances FOR INSERT
  WITH CHECK (worker_id = auth.uid() OR public.is_admin());
CREATE POLICY "att_update" ON public.attendances FOR UPDATE
  USING (worker_id = auth.uid() OR public.is_admin());

-- REQUESTS: workers insert/see own, admin sees all
CREATE POLICY "req_select" ON public.requests FOR SELECT
  USING (worker_id = auth.uid() OR public.is_admin());
CREATE POLICY "req_insert" ON public.requests FOR INSERT
  WITH CHECK (worker_id = auth.uid());
CREATE POLICY "req_update" ON public.requests FOR UPDATE
  USING (public.is_admin());

-- BOLETAS: workers see/insert own, admin sees all
CREATE POLICY "bol_select" ON public.boletas FOR SELECT
  USING (worker_id = auth.uid() OR public.is_admin());
CREATE POLICY "bol_insert" ON public.boletas FOR INSERT
  WITH CHECK (worker_id = auth.uid());
CREATE POLICY "bol_update" ON public.boletas FOR UPDATE
  USING (public.is_admin());

-- DOCUMENTS: all authenticated users can read, only admin inserts
CREATE POLICY "doc_select" ON public.documents FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "doc_insert" ON public.documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "doc_delete" ON public.documents FOR DELETE
  USING (public.is_admin());

-- ALERTS: admin only
CREATE POLICY "alert_all" ON public.alerts FOR ALL
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════
--  STORAGE BUCKETS
--  Create these manually in Supabase Storage UI
--  or uncomment if using service key
-- ═══════════════════════════════════════════════════

-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('boletas', 'boletas', false);

-- ═══════════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_shifts_worker     ON public.shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date       ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_att_worker        ON public.attendances(worker_id);
CREATE INDEX IF NOT EXISTS idx_att_checkin       ON public.attendances(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_req_worker        ON public.requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_req_status        ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_bol_worker        ON public.boletas(worker_id);
CREATE INDEX IF NOT EXISTS idx_doc_category      ON public.documents(category);

-- ═══════════════════════════════════════════════════
--  PROJECTS TABLE (add this if not exists)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.projects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_read" ON public.projects FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "projects_write" ON public.projects FOR ALL
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════
--  ACCOUNT REQUESTS — Solicitudes de acceso
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.account_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  rut           TEXT,
  role_label    TEXT,
  project       TEXT,
  message       TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES public.profiles(id),
  reviewed_at   TIMESTAMPTZ,
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Public can insert (no auth needed to request access)
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_req_insert" ON public.account_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "account_req_select" ON public.account_requests
  FOR SELECT USING (public.is_admin());

CREATE POLICY "account_req_update" ON public.account_requests
  FOR UPDATE USING (public.is_admin());
