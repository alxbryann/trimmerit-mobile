-- ============================================================
-- SOLICITUDES DE CAMBIO EN RESERVAS — BarberIT
-- Maneja cancelaciones y aplazamientos propuestos por el barbero
-- ============================================================

CREATE TABLE IF NOT EXISTS reserva_solicitudes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reserva_id   UUID REFERENCES reservas(id) ON DELETE CASCADE NOT NULL,
  barbero_id   UUID REFERENCES auth.users(id) NOT NULL,
  cliente_id   UUID REFERENCES auth.users(id) NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('cancelacion', 'aplazamiento')),
  estado       TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente', 'aceptado', 'rechazado')),
  razon        TEXT NOT NULL,
  nueva_fecha  DATE,    -- solo aplazamiento
  nueva_hora   TEXT,    -- solo aplazamiento  HH:MM
  leido_cliente  BOOLEAN NOT NULL DEFAULT false,
  leido_barbero  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_reserva  ON reserva_solicitudes(reserva_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente  ON reserva_solicitudes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_barbero  ON reserva_solicitudes(barbero_id);

ALTER TABLE reserva_solicitudes ENABLE ROW LEVEL SECURITY;

-- barbero puede crear y leer las suyas
CREATE POLICY "barbero gestiona sus solicitudes"
  ON reserva_solicitudes FOR ALL
  USING (auth.uid() = barbero_id)
  WITH CHECK (auth.uid() = barbero_id);

-- cliente puede leer las que lo afectan y actualizar su estado
CREATE POLICY "cliente lee sus solicitudes"
  ON reserva_solicitudes FOR SELECT
  USING (auth.uid() = cliente_id);

CREATE POLICY "cliente responde solicitudes"
  ON reserva_solicitudes FOR UPDATE
  USING (auth.uid() = cliente_id);

-- ============================================================
-- FUNCIÓN: cancelar reserva (crea solicitud + actualiza reserva)
-- ============================================================
CREATE OR REPLACE FUNCTION cancelar_reserva(
  p_reserva_id UUID,
  p_razon      TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva  reservas%ROWTYPE;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF v_reserva.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF auth.uid() != v_reserva.barbero_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- Cancelar la reserva
  UPDATE reservas SET estado = 'cancelada' WHERE id = p_reserva_id;

  -- Registrar solicitud
  INSERT INTO reserva_solicitudes
    (reserva_id, barbero_id, cliente_id, tipo, estado, razon, leido_cliente)
  VALUES
    (p_reserva_id, v_reserva.barbero_id, v_reserva.cliente_id,
     'cancelacion', 'aceptado', p_razon, false);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- FUNCIÓN: proponer aplazamiento
-- ============================================================
CREATE OR REPLACE FUNCTION proponer_aplazamiento(
  p_reserva_id  UUID,
  p_razon       TEXT,
  p_nueva_fecha DATE,
  p_nueva_hora  TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva reservas%ROWTYPE;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF v_reserva.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF auth.uid() != v_reserva.barbero_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- Marcar reserva con estado especial mientras espera respuesta
  UPDATE reservas SET estado = 'aplazamiento_pendiente' WHERE id = p_reserva_id;

  INSERT INTO reserva_solicitudes
    (reserva_id, barbero_id, cliente_id, tipo, estado, razon, nueva_fecha, nueva_hora, leido_cliente)
  VALUES
    (p_reserva_id, v_reserva.barbero_id, v_reserva.cliente_id,
     'aplazamiento', 'pendiente', p_razon, p_nueva_fecha, p_nueva_hora, false);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- FUNCIÓN: cliente responde a aplazamiento
-- ============================================================
CREATE OR REPLACE FUNCTION responder_aplazamiento(
  p_solicitud_id UUID,
  p_acepta       BOOLEAN
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sol  reserva_solicitudes%ROWTYPE;
BEGIN
  SELECT * INTO v_sol FROM reserva_solicitudes WHERE id = p_solicitud_id;
  IF v_sol.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF auth.uid() != v_sol.cliente_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  IF p_acepta THEN
    -- Mover la reserva a la nueva fecha/hora propuesta
    UPDATE reservas
    SET fecha  = v_sol.nueva_fecha,
        hora   = v_sol.nueva_hora,
        estado = 'pendiente'
    WHERE id = v_sol.reserva_id;

    UPDATE reserva_solicitudes
    SET estado = 'aceptado', leido_cliente = true, leido_barbero = false,
        updated_at = now()
    WHERE id = p_solicitud_id;
  ELSE
    -- El cliente rechaza → la cita queda cancelada para ambos
    UPDATE reservas SET estado = 'cancelada' WHERE id = v_sol.reserva_id;

    UPDATE reserva_solicitudes
    SET estado = 'rechazado', leido_cliente = true, leido_barbero = false,
        updated_at = now()
    WHERE id = p_solicitud_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'acepto', p_acepta);
END;
$$;

-- Agregar estado 'aplazamiento_pendiente' al check existente si lo hay
-- (ejecutar solo si la columna estado en reservas tiene un CHECK constraint)
-- ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
-- ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check
--   CHECK (estado IN ('pendiente','completada','cancelada','aplazamiento_pendiente'));
