-- ============================================================
-- Migración: Gestión de Equipo — Comisiones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. % de comisión global por barbería (default 50%)
ALTER TABLE barberias
  ADD COLUMN IF NOT EXISTS comision_default_pct numeric(5,2) NOT NULL DEFAULT 50;

-- 2. % de comisión individual por barbero (NULL = usar el global)
ALTER TABLE barberos
  ADD COLUMN IF NOT EXISTS comision_pct numeric(5,2) DEFAULT NULL;

-- 3. Registro de pagos de comisiones
CREATE TABLE IF NOT EXISTS comisiones_pagos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id    uuid NOT NULL REFERENCES barberias(id) ON DELETE CASCADE,
  barbero_id     uuid NOT NULL REFERENCES barberos(id)  ON DELETE CASCADE,
  monto          numeric(12,2) NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fin    date NOT NULL,
  pagado_en      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_comisiones_pagos_barberia  ON comisiones_pagos(barberia_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_pagos_barbero   ON comisiones_pagos(barbero_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_pagos_periodo   ON comisiones_pagos(periodo_inicio, periodo_fin);

-- RLS: solo el admin de la barbería puede ver y crear pagos
ALTER TABLE comisiones_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin puede ver pagos de su barbería"
  ON comisiones_pagos FOR SELECT
  USING (
    barberia_id IN (
      SELECT id FROM barberias WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY "Admin puede registrar pagos de su barbería"
  ON comisiones_pagos FOR INSERT
  WITH CHECK (
    barberia_id IN (
      SELECT id FROM barberias WHERE admin_id = auth.uid()
    )
  );
