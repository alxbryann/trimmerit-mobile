-- ─── Agregar campos de fecha/hora de la reserva original a solicitudes ───────
--
-- Permite mostrar al barbero la fecha de la cita cancelada/cambiada
-- sin necesidad de un JOIN adicional al consultar solicitudes.

ALTER TABLE reserva_solicitudes
  ADD COLUMN IF NOT EXISTS reserva_fecha DATE,
  ADD COLUMN IF NOT EXISTS reserva_hora  TEXT;

-- ─── Actualizar función cancelar_reserva_cliente ──────────────────────────────

CREATE OR REPLACE FUNCTION cancelar_reserva_cliente(p_reserva_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva reservas%ROWTYPE;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_reserva.cliente_id != auth.uid() THEN
    RETURN json_build_object('ok', false, 'reason', 'unauthorized');
  END IF;
  IF v_reserva.estado NOT IN ('pendiente', 'aplazamiento_pendiente') THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_state');
  END IF;

  UPDATE reservas SET estado = 'cancelada' WHERE id = p_reserva_id;

  INSERT INTO reserva_solicitudes (
    reserva_id, barbero_id, cliente_id,
    tipo, estado, razon,
    leido_cliente, leido_barbero,
    reserva_fecha, reserva_hora
  ) VALUES (
    p_reserva_id, v_reserva.barbero_id, auth.uid(),
    'cancelacion_cliente', 'aceptado', '',
    true, false,
    v_reserva.fecha, v_reserva.hora
  );

  RETURN json_build_object('ok', true);
END;
$$;

-- ─── Actualizar función cambiar_reserva_cliente ───────────────────────────────

CREATE OR REPLACE FUNCTION cambiar_reserva_cliente(
  p_reserva_id  UUID,
  p_nueva_fecha DATE,
  p_nueva_hora  TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva  reservas%ROWTYPE;
  v_old_fecha DATE;
  v_old_hora  TEXT;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_reserva.cliente_id != auth.uid() THEN
    RETURN json_build_object('ok', false, 'reason', 'unauthorized');
  END IF;
  IF v_reserva.estado != 'pendiente' THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_state');
  END IF;

  -- Guardar fecha anterior
  v_old_fecha := v_reserva.fecha;
  v_old_hora  := v_reserva.hora;

  UPDATE reservas
  SET fecha = p_nueva_fecha, hora = p_nueva_hora
  WHERE id = p_reserva_id;

  INSERT INTO reserva_solicitudes (
    reserva_id, barbero_id, cliente_id,
    tipo, estado, razon,
    nueva_fecha, nueva_hora,
    leido_cliente, leido_barbero,
    reserva_fecha, reserva_hora
  ) VALUES (
    p_reserva_id, v_reserva.barbero_id, auth.uid(),
    'cambio_cliente', 'aceptado', '',
    p_nueva_fecha, p_nueva_hora,
    true, false,
    v_old_fecha, v_old_hora
  );

  RETURN json_build_object('ok', true);
END;
$$;
