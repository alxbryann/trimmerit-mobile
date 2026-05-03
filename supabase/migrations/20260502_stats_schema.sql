-- ═══════════════════════════════════════════════════════════════════════════
-- Migración: Schema para paneles estadísticos
-- Fecha: 2026-05-02
-- Tablas: gastos, productos, productos_ventas, comisiones, barbero_config
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla GASTOS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gastos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id   UUID NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  concepto      TEXT NOT NULL,
  categoria     TEXT NOT NULL CHECK (categoria IN ('fijo', 'variable')),
  monto         NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_barberia_fecha_idx
  ON public.gastos (barberia_id, fecha DESC);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Solo el dueño (admin_id) de la barbería ve/edita sus gastos.
CREATE POLICY "gastos_select_owner"
  ON public.gastos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = gastos.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "gastos_insert_owner"
  ON public.gastos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = gastos.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "gastos_update_owner"
  ON public.gastos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = gastos.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "gastos_delete_owner"
  ON public.gastos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = gastos.barberia_id AND b.admin_id = auth.uid()
  ));

-- ── 2. Tabla PRODUCTOS (catálogo) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.productos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id     UUID NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  categoria       TEXT,
  precio_venta    NUMERIC(10, 2) NOT NULL CHECK (precio_venta >= 0),
  precio_compra   NUMERIC(10, 2) CHECK (precio_compra IS NULL OR precio_compra >= 0),
  stock           INT NOT NULL DEFAULT 0,
  imagen_url      TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS productos_barberia_idx
  ON public.productos (barberia_id, activo);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer (catálogo se exhibe a clientes potenciales).
CREATE POLICY "productos_select_authed"
  ON public.productos FOR SELECT TO authenticated
  USING (activo = true OR EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos.barberia_id AND b.admin_id = auth.uid()
  ));

-- Solo el dueño puede insertar/modificar/eliminar.
CREATE POLICY "productos_insert_owner"
  ON public.productos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "productos_update_owner"
  ON public.productos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "productos_delete_owner"
  ON public.productos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos.barberia_id AND b.admin_id = auth.uid()
  ));

-- ── 3. Tabla PRODUCTOS_VENTAS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.productos_ventas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  barbero_id    UUID NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  barberia_id   UUID NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  cliente_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  unidades      INT NOT NULL CHECK (unidades > 0),
  monto         NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS productos_ventas_barberia_fecha_idx
  ON public.productos_ventas (barberia_id, fecha DESC);

CREATE INDEX IF NOT EXISTS productos_ventas_barbero_fecha_idx
  ON public.productos_ventas (barbero_id, fecha DESC);

CREATE INDEX IF NOT EXISTS productos_ventas_producto_idx
  ON public.productos_ventas (producto_id);

ALTER TABLE public.productos_ventas ENABLE ROW LEVEL SECURITY;

-- Admin barbería ve todas las ventas; barbero solo las suyas.
CREATE POLICY "productos_ventas_select_owner_or_self"
  ON public.productos_ventas FOR SELECT TO authenticated
  USING (
    barbero_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = productos_ventas.barberia_id AND b.admin_id = auth.uid()
    )
  );

-- Insert: barbero puede registrar su propia venta o admin de la barbería.
CREATE POLICY "productos_ventas_insert_self_or_owner"
  ON public.productos_ventas FOR INSERT TO authenticated
  WITH CHECK (
    barbero_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = productos_ventas.barberia_id AND b.admin_id = auth.uid()
    )
  );

-- Update / Delete: solo admin (correcciones contables).
CREATE POLICY "productos_ventas_update_owner"
  ON public.productos_ventas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos_ventas.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "productos_ventas_delete_owner"
  ON public.productos_ventas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = productos_ventas.barberia_id AND b.admin_id = auth.uid()
  ));

-- ── 4. Tabla COMISIONES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comisiones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id    UUID NOT NULL REFERENCES public.barberos(id) ON DELETE CASCADE,
  barberia_id   UUID NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('servicio', 'producto')),
  referencia_id UUID,
  porcentaje    NUMERIC(5, 2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  monto         NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'pagada')),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  pagada_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comisiones_barberia_fecha_idx
  ON public.comisiones (barberia_id, fecha DESC);

CREATE INDEX IF NOT EXISTS comisiones_barbero_estado_idx
  ON public.comisiones (barbero_id, estado, fecha DESC);

ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;

-- Barbero ve solo las suyas; admin ve todas las de su barbería.
CREATE POLICY "comisiones_select_owner_or_self"
  ON public.comisiones FOR SELECT TO authenticated
  USING (
    barbero_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = comisiones.barberia_id AND b.admin_id = auth.uid()
    )
  );

-- Solo admin crea/actualiza comisiones.
CREATE POLICY "comisiones_insert_owner"
  ON public.comisiones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = comisiones.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "comisiones_update_owner"
  ON public.comisiones FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = comisiones.barberia_id AND b.admin_id = auth.uid()
  ));

CREATE POLICY "comisiones_delete_owner"
  ON public.comisiones FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = comisiones.barberia_id AND b.admin_id = auth.uid()
  ));

-- ── 5. Tabla BARBERO_CONFIG ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.barbero_config (
  barbero_id              UUID PRIMARY KEY
                              REFERENCES public.barberos(id) ON DELETE CASCADE,
  comision_servicio_pct   NUMERIC(5, 2) NOT NULL DEFAULT 50
                              CHECK (comision_servicio_pct >= 0 AND comision_servicio_pct <= 100),
  comision_producto_pct   NUMERIC(5, 2) NOT NULL DEFAULT 10
                              CHECK (comision_producto_pct >= 0 AND comision_producto_pct <= 100),
  meta_mensual            NUMERIC(12, 2) CHECK (meta_mensual IS NULL OR meta_mensual >= 0),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.barbero_config ENABLE ROW LEVEL SECURITY;

-- El propio barbero o el admin de su barbería pueden leer.
CREATE POLICY "barbero_config_select_self_or_owner"
  ON public.barbero_config FOR SELECT TO authenticated
  USING (
    barbero_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.barberos bero
      JOIN public.barberias bria ON bria.id = bero.barberia_id
      WHERE bero.id = barbero_config.barbero_id
        AND bria.admin_id = auth.uid()
    )
  );

-- Solo admin de la barbería del barbero puede insertar/actualizar.
CREATE POLICY "barbero_config_upsert_owner"
  ON public.barbero_config FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.barberos bero
    JOIN public.barberias bria ON bria.id = bero.barberia_id
    WHERE bero.id = barbero_config.barbero_id
      AND bria.admin_id = auth.uid()
  ));

CREATE POLICY "barbero_config_update_owner"
  ON public.barbero_config FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.barberos bero
    JOIN public.barberias bria ON bria.id = bero.barberia_id
    WHERE bero.id = barbero_config.barbero_id
      AND bria.admin_id = auth.uid()
  ));
