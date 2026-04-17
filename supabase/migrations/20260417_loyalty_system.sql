-- ============================================================
-- SISTEMA DE FIDELIZACIÓN — BarberIT
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Tabla: programas de fidelización (uno por barbería)
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barbero_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sellos_requeridos    INTEGER NOT NULL DEFAULT 10,
  beneficio_tipo       TEXT NOT NULL DEFAULT 'personalizado',
  -- 'corte_gratis' | 'descuento' | 'producto' | 'personalizado'
  beneficio_descripcion TEXT NOT NULL DEFAULT '',
  beneficio_valor      NUMERIC,
  activo               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Tabla: tarjetas de fidelización (una por cliente por barbería)
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  barbero_id           UUID NOT NULL,
  programa_id          UUID REFERENCES loyalty_programs(id) ON DELETE SET NULL,
  sellos_acumulados    INTEGER NOT NULL DEFAULT 0,
  canjeado_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(cliente_id, barbero_id)
);

-- 3. Tabla: historial de sellos
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id     UUID REFERENCES loyalty_cards(id) ON DELETE CASCADE NOT NULL,
  reserva_id  UUID REFERENCES reservas(id) ON DELETE SET NULL,
  stamped_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_barbero ON loyalty_programs(barbero_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_cliente    ON loyalty_cards(cliente_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_barbero    ON loyalty_cards(barbero_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_stamps_card      ON loyalty_stamps(card_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps   ENABLE ROW LEVEL SECURITY;

-- loyalty_programs: barbero puede gestionar el suyo, todos pueden leer activos
CREATE POLICY "barbero gestiona su programa"
  ON loyalty_programs FOR ALL
  USING (auth.uid() = barbero_id)
  WITH CHECK (auth.uid() = barbero_id);

CREATE POLICY "programas activos son públicos"
  ON loyalty_programs FOR SELECT
  USING (activo = true);

-- loyalty_cards: cliente ve las suyas, barbero ve las de su barbería
CREATE POLICY "cliente ve sus tarjetas"
  ON loyalty_cards FOR SELECT
  USING (auth.uid() = cliente_id);

CREATE POLICY "barbero ve tarjetas de su barbería"
  ON loyalty_cards FOR SELECT
  USING (auth.uid() = barbero_id);

CREATE POLICY "sistema puede insertar tarjetas"
  ON loyalty_cards FOR INSERT
  WITH CHECK (true);

CREATE POLICY "sistema puede actualizar tarjetas"
  ON loyalty_cards FOR UPDATE
  USING (true);

-- loyalty_stamps: cliente ve los suyos via card, insert via función
CREATE POLICY "cliente ve sus sellos"
  ON loyalty_stamps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_cards lc
      WHERE lc.id = loyalty_stamps.card_id
        AND lc.cliente_id = auth.uid()
    )
  );

CREATE POLICY "sistema puede insertar sellos"
  ON loyalty_stamps FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FUNCIÓN: agregar sello al completar reserva
-- Llamar desde el cliente via: supabase.rpc('add_loyalty_stamp', { p_reserva_id: id })
-- ============================================================
CREATE OR REPLACE FUNCTION add_loyalty_stamp(p_reserva_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id  UUID;
  v_barbero_id  UUID;
  v_programa    loyalty_programs%ROWTYPE;
  v_card_id     UUID;
  v_sellos      INTEGER;
  v_completado  BOOLEAN := false;
BEGIN
  -- Obtener datos de la reserva
  SELECT cliente_id, barbero_id
  INTO   v_cliente_id, v_barbero_id
  FROM   reservas
  WHERE  id = p_reserva_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reserva_not_found');
  END IF;

  -- Buscar programa activo para esa barbería
  SELECT * INTO v_programa
  FROM   loyalty_programs
  WHERE  barbero_id = v_barbero_id AND activo = true
  LIMIT  1;

  IF v_programa.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_program');
  END IF;

  -- Verificar que no se haya sellado ya esta reserva
  IF EXISTS (
    SELECT 1 FROM loyalty_stamps ls
    JOIN loyalty_cards lc ON lc.id = ls.card_id
    WHERE ls.reserva_id = p_reserva_id
      AND lc.cliente_id = v_cliente_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_stamped');
  END IF;

  -- Upsert de tarjeta
  INSERT INTO loyalty_cards (cliente_id, barbero_id, programa_id, sellos_acumulados)
  VALUES (v_cliente_id, v_barbero_id, v_programa.id, 0)
  ON CONFLICT (cliente_id, barbero_id)
  DO UPDATE SET programa_id = EXCLUDED.programa_id
  RETURNING id INTO v_card_id;

  IF v_card_id IS NULL THEN
    SELECT id INTO v_card_id
    FROM loyalty_cards
    WHERE cliente_id = v_cliente_id AND barbero_id = v_barbero_id;
  END IF;

  -- Insertar sello
  INSERT INTO loyalty_stamps (card_id, reserva_id) VALUES (v_card_id, p_reserva_id);

  -- Actualizar contador
  UPDATE loyalty_cards
  SET sellos_acumulados = sellos_acumulados + 1
  WHERE id = v_card_id
  RETURNING sellos_acumulados INTO v_sellos;

  -- Verificar si completó
  IF v_sellos >= v_programa.sellos_requeridos THEN
    v_completado := true;
  END IF;

  RETURN jsonb_build_object(
    'ok',              true,
    'sellos',          v_sellos,
    'requeridos',      v_programa.sellos_requeridos,
    'completado',      v_completado,
    'beneficio',       v_programa.beneficio_descripcion
  );
END;
$$;

-- ============================================================
-- FUNCIÓN: canjear beneficio (barbero llama esto al entregar el premio)
-- supabase.rpc('redeem_loyalty_card', { p_card_id: id })
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_loyalty_card(p_card_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card  loyalty_cards%ROWTYPE;
  v_prog  loyalty_programs%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF v_card.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'card_not_found');
  END IF;

  -- Solo el barbero dueño puede canjear
  IF auth.uid() != v_card.barbero_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_prog FROM loyalty_programs WHERE id = v_card.programa_id;
  IF v_card.sellos_acumulados < v_prog.sellos_requeridos THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_stamps');
  END IF;

  IF v_card.canjeado_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  END IF;

  -- Marcar como canjeado y resetear contador para el próximo ciclo
  UPDATE loyalty_cards
  SET canjeado_at       = now(),
      sellos_acumulados = 0,
      created_at        = now()
  WHERE id = p_card_id;

  -- Resetear canjeado_at para que empiece nuevo ciclo
  UPDATE loyalty_cards SET canjeado_at = NULL WHERE id = p_card_id;

  RETURN jsonb_build_object('ok', true, 'beneficio', v_prog.beneficio_descripcion);
END;
$$;
