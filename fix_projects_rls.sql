-- ═══════════════════════════════════════════════════
--  FIX: Projects RLS — ejecuta esto en Supabase SQL Editor
--  https://supabase.com/dashboard/project/irodzmlnddwkjyshcgct/sql/new
-- ═══════════════════════════════════════════════════

-- Drop existing policies that may be blocking reads
DROP POLICY IF EXISTS "proj_read"   ON public.projects;
DROP POLICY IF EXISTS "proj_write"  ON public.projects;
DROP POLICY IF EXISTS "projects_read"  ON public.projects;
DROP POLICY IF EXISTS "projects_write" ON public.projects;
DROP POLICY IF EXISTS "config_read"  ON public.system_config;
DROP POLICY IF EXISTS "config_write" ON public.system_config;
DROP POLICY IF EXISTS "cfg_read"  ON public.system_config;
DROP POLICY IF EXISTS "cfg_write" ON public.system_config;

-- Recreate: everyone authenticated can read projects
CREATE POLICY "projects_read_all" ON public.projects
  FOR SELECT USING (auth.role() = 'authenticated');

-- Everyone authenticated can write (admin check is done in app)
CREATE POLICY "projects_write_all" ON public.projects
  FOR ALL USING (auth.role() = 'authenticated');

-- Fix system_config too
CREATE POLICY "config_read_all" ON public.system_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_write_all" ON public.system_config
  FOR ALL USING (auth.role() = 'authenticated');

-- Make sure schedule column exists
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS schedule JSONB;

-- Set schedule for VACUNACION 2026 LO BARNECHEA
UPDATE public.projects
SET schedule = '{
  "mon": {"active": true,  "start": "08:00", "end": "17:00"},
  "tue": {"active": true,  "start": "08:00", "end": "17:00"},
  "wed": {"active": true,  "start": "08:00", "end": "17:00"},
  "thu": {"active": true,  "start": "08:00", "end": "17:00"},
  "fri": {"active": true,  "start": "08:00", "end": "16:00"},
  "sat": {"active": false, "start": "08:00", "end": "14:00"},
  "sun": {"active": false, "start": "08:00", "end": "14:00"}
}'
WHERE name ILIKE '%barnechea%' OR name ILIKE '%vacunacion%' OR name ILIKE '%vacunación%';

-- Verify your projects are visible
SELECT id, name, active FROM public.projects ORDER BY name;
