-- ============================================================
-- ACCIONES DEL CLIENTE SOBRE SUS RESERVAS — BarberIT
-- Permite al cliente cancelar o cambiar fecha/hora de su cita
-- El barbero recibe notificación in-app (reserva_solicitudes)
-- ============================================================

-- Ampliar el check constraint de tipo para incluir acciones del cliente
ALTER TABLE reserva_solicitudes DROP CONSTRAINT IF EXISTS reserva_solicitudes_tipo_check;
ALTER TABLE reserva_solicitudes
  ADD CONSTRAINT reserva_solicitudes_tipo_check
  CHECK (tipo IN ('cancelacion', 'aplazamiento', 'cancelacion_cliente', 'cambio_cliente'));

-- ============================================================
-- FUNCIÓN: cliente cancela su propia reserva
-- ============================================================
CREATE OR REPLACE FUNCTION cancelar_reserva_cliente(
  p_reserva_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva reservas%ROWTYPE;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF v_reserva.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF auth.uid() != v_reserva.cliente_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;
  IF v_reserva.estado NOT IN ('pendiente', 'aplazamiento_pendiente') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_state');
  END IF;

  -- Cancelar reserva
  UPDATE reservas SET estado = 'cancelada' WHERE id = p_reserva_id;

  -- Notificar al barbero (leido_barbero=false para que le aparezca el popup)
  INSERT INTO reserva_solicitudes
    (reserva_id, barbero_id, cliente_id, tipo, estado, razon, leido_cliente, leido_barbero)
  VALUES
    (p_reserva_id, v_reserva.barbero_id, v_reserva.cliente_id,
     'cancelacion_cliente', 'aceptado', '', true, false);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- FUNCIÓN: cliente cambia fecha/hora de su reserva
-- ============================================================
CREATE OR REPLACE FUNCTION cambiar_reserva_cliente(
  p_reserva_id  UUID,
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
  IF auth.uid() != v_reserva.cliente_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;
  IF v_reserva.estado NOT IN ('pendiente') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_state');
  END IF;

  -- Actualizar fecha/hora (libera el slot anterior y ocupa el nuevo)
  UPDATE reservas
  SET fecha = p_nueva_fecha,
      hora  = p_nueva_hora
  WHERE id = p_reserva_id;

  -- Notificar al barbero
  INSERT INTO reserva_solicitudes
    (reserva_id, barbero_id, cliente_id, tipo, estado, razon,
     nueva_fecha, nueva_hora, leido_cliente, leido_barbero)
  VALUES
    (p_reserva_id, v_reserva.barbero_id, v_reserva.cliente_id,
     'cambio_cliente', 'aceptado', '',
     p_nueva_fecha, p_nueva_hora, true, false);

  RETURN jsonb_build_object('ok', true);
END;
$$;
