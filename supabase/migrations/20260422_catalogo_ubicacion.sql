-- ═══════════════════════════════════════════════════════════════════════════
-- Migración: Catálogo con ubicación y servicios especiales
-- Fecha: 2026-04-22
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Nuevas columnas en barberias ─────────────────────────────────────────

ALTER TABLE public.barberias
  ADD COLUMN IF NOT EXISTS lat          DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS lng          DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS ciudad       TEXT,
  -- Servicios especiales: array de IDs de servicio
  -- Valores permitidos: 'mascarilla', 'tinturas', 'lavado'
  ADD COLUMN IF NOT EXISTS servicios_especiales TEXT[] DEFAULT '{}';

-- Índice para consultas geoespaciales simples por ciudad
CREATE INDEX IF NOT EXISTS barberias_ciudad_idx ON public.barberias (ciudad);

-- Índice para filtrar por servicios especiales (operador @>)
CREATE INDEX IF NOT EXISTS barberias_servicios_idx ON public.barberias
  USING GIN (servicios_especiales);

-- ── 2. Tabla de publicaciones (infraestructura para el feed, sin UI aún) ───

CREATE TABLE IF NOT EXISTS public.publicaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id    UUID NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  barberia_id   UUID REFERENCES public.barberias(id) ON DELETE SET NULL,
  tipo          TEXT NOT NULL DEFAULT 'imagen'
                  CHECK (tipo IN ('imagen', 'video', 'texto')),
  contenido_url TEXT,                          -- S3 URL para imagen/video
  caption       TEXT,                          -- texto o descripción
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para el feed (barbero más reciente primero)
CREATE INDEX IF NOT EXISTS publicaciones_barbero_created_idx
  ON public.publicaciones (barbero_id, created_at DESC);

-- Índice para el feed de una barbería
CREATE INDEX IF NOT EXISTS publicaciones_barberia_created_idx
  ON public.publicaciones (barberia_id, created_at DESC);

-- ── 3. RLS para publicaciones ────────────────────────────────────────────────

ALTER TABLE public.publicaciones ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer publicaciones activas
CREATE POLICY "publicaciones_select_authed"
  ON public.publicaciones
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Solo el barbero dueño puede insertar sus propias publicaciones
CREATE POLICY "publicaciones_insert_own"
  ON public.publicaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (barbero_id = auth.uid());

-- Solo el barbero dueño puede actualizar/borrar sus publicaciones
CREATE POLICY "publicaciones_update_own"
  ON public.publicaciones
  FOR UPDATE
  TO authenticated
  USING (barbero_id = auth.uid());

CREATE POLICY "publicaciones_delete_own"
  ON public.publicaciones
  FOR DELETE
  TO authenticated
  USING (barbero_id = auth.uid());

-- ── 4. Función RPC: barberías frecuentes del cliente ────────────────────────
-- Devuelve las N barberías donde el cliente tiene más reservas completadas,
-- ordenadas por cantidad de visitas DESC.
-- OWASP A01: SECURITY DEFINER con search_path fijo; filtra por auth.uid()
-- para que ningún cliente pueda ver las visitas de otro.

CREATE OR REPLACE FUNCTION public.get_frecuentes_cliente(p_limit INT DEFAULT 3)
RETURNS TABLE (
  barberia_id           UUID,
  nombre                TEXT,
  slug                  TEXT,
  direccion             TEXT,
  ciudad                TEXT,
  lat                   DECIMAL,
  lng                   DECIMAL,
  servicios_especiales  TEXT[],
  hora_apertura         TEXT,
  hora_cierre           TEXT,
  visitas               BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bria.id              AS barberia_id,
    bria.nombre,
    bria.slug,
    bria.direccion,
    bria.ciudad,
    bria.lat,
    bria.lng,
    bria.servicios_especiales,
    bria.hora_apertura,
    bria.hora_cierre,
    COUNT(r.id)          AS visitas
  FROM reservas r
  JOIN barberos  bero ON bero.id = r.barbero_id
  JOIN barberias bria ON bria.id = bero.barberia_id
  WHERE r.cliente_id = auth.uid()
    AND r.estado NOT IN ('cancelada')
  GROUP BY bria.id
  ORDER BY visitas DESC
  LIMIT p_limit;
$$;

-- Solo usuarios autenticados pueden invocarla (no anon)
REVOKE ALL ON FUNCTION public.get_frecuentes_cliente(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_frecuentes_cliente(INT) TO authenticated;
