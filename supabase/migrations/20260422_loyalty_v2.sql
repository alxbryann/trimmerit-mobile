-- =============================================================================
-- Loyalty v2: distribución manual de tarjetas + redención in-panel
-- =============================================================================
-- Cambios:
--   1. add_loyalty_stamp  → solo considera tarjetas activas (canjeado_at IS NULL)
--   2. redeem_loyalty_card → marca canjeado_at (antes reseteaba sellos)
--   3. redeem_and_give_new_card → canjea tarjeta completa y opcionalmente da nueva
-- =============================================================================

-- ─── 1. add_loyalty_stamp: solo tarjetas activas (canjeado_at IS NULL) ────────
CREATE OR REPLACE FUNCTION public.add_loyalty_stamp(p_reserva_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva   reservas%ROWTYPE;
  v_prog      loyalty_programs%ROWTYPE;
  v_card      loyalty_cards%ROWTYPE;
  v_stamp_id  UUID;
  v_sellos    INT;
  v_completado BOOLEAN;
BEGIN
  -- OWASP A01: verificar que el barbero que llama es dueño de la reserva
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'reserva_not_found'); END IF;
  IF v_reserva.barbero_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_prog
  FROM loyalty_programs
  WHERE barbero_id = v_reserva.barbero_id AND activo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_active_program'); END IF;

  -- Solo tarjetas activas (canjeado_at IS NULL)
  SELECT * INTO v_card
  FROM loyalty_cards
  WHERE cliente_id = v_reserva.cliente_id
    AND barbero_id = v_reserva.barbero_id
    AND canjeado_at IS NULL;

  -- Verificar duplicado
  IF FOUND THEN
    IF EXISTS (
      SELECT 1 FROM loyalty_stamps
      WHERE reserva_id = p_reserva_id AND card_id = v_card.id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_stamped');
    END IF;
  END IF;

  -- Crear tarjeta si no existe
  IF NOT FOUND THEN
    INSERT INTO loyalty_cards (cliente_id, barbero_id, programa_id, sellos_acumulados)
    VALUES (v_reserva.cliente_id, v_reserva.barbero_id, v_prog.id, 0)
    RETURNING * INTO v_card;
  END IF;

  -- Agregar sello
  INSERT INTO loyalty_stamps (card_id, reserva_id, stamped_at)
  VALUES (v_card.id, p_reserva_id, now())
  RETURNING id INTO v_stamp_id;

  -- Actualizar contador
  UPDATE loyalty_cards SET sellos_acumulados = sellos_acumulados + 1
  WHERE id = v_card.id
  RETURNING sellos_acumulados INTO v_sellos;

  v_completado := v_sellos >= v_prog.sellos_requeridos;

  RETURN jsonb_build_object(
    'ok',         true,
    'sellos',     v_sellos,
    'requeridos', v_prog.sellos_requeridos,
    'completado', v_completado,
    'beneficio',  v_prog.beneficio_descripcion
  );
END;
$$;

-- ─── 2. redeem_loyalty_card: marcar como canjeado (no resetear) ───────────────
CREATE OR REPLACE FUNCTION public.redeem_loyalty_card(p_card_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card  loyalty_cards%ROWTYPE;
  v_prog  loyalty_programs%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM loyalty_cards WHERE id = p_card_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'card_not_found'); END IF;

  -- OWASP A01: solo el barbero dueño puede canjear
  IF v_card.barbero_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_prog FROM loyalty_programs WHERE id = v_card.programa_id;

  IF v_card.sellos_acumulados < COALESCE(v_prog.sellos_requeridos, 999) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_stamps');
  END IF;

  -- Marcar como canjeado (no se resetean los sellos, la tarjeta queda histórica)
  UPDATE loyalty_cards SET canjeado_at = now() WHERE id = p_card_id;

  RETURN jsonb_build_object(
    'ok',      true,
    'beneficio', COALESCE(v_prog.beneficio_descripcion, '')
  );
END;
$$;

-- ─── 3. redeem_and_give_new_card: canjear + opcionalmente dar nueva tarjeta ───
--
-- Flujo in-panel: el barbero confirma el corte de un cliente con tarjeta completa
-- y decide si el cliente inicia un nuevo ciclo.
-- OWASP A01: verifica auth.uid() = barbero de la reserva
-- OWASP A04: la reserva debe existir y pertenecer al barbero autenticado
CREATE OR REPLACE FUNCTION public.redeem_and_give_new_card(
  p_reserva_id    UUID,
  p_dar_nueva     BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva  reservas%ROWTYPE;
  v_prog     loyalty_programs%ROWTYPE;
  v_card     loyalty_cards%ROWTYPE;
  v_new_id   UUID;
BEGIN
  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'reserva_not_found'); END IF;

  -- OWASP A01
  IF v_reserva.barbero_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  SELECT * INTO v_prog
  FROM loyalty_programs
  WHERE barbero_id = v_reserva.barbero_id AND activo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_active_program'); END IF;

  -- Buscar tarjeta completa activa del cliente
  SELECT * INTO v_card
  FROM loyalty_cards
  WHERE cliente_id  = v_reserva.cliente_id
    AND barbero_id  = v_reserva.barbero_id
    AND canjeado_at IS NULL
    AND sellos_acumulados >= v_prog.sellos_requeridos;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_completed_card'); END IF;

  -- Canjear la tarjeta completa
  UPDATE loyalty_cards SET canjeado_at = now() WHERE id = v_card.id;

  IF p_dar_nueva THEN
    -- Crear nueva tarjeta con 1 sello (la visita actual cuenta)
    INSERT INTO loyalty_cards (cliente_id, barbero_id, programa_id, sellos_acumulados)
    VALUES (v_reserva.cliente_id, v_reserva.barbero_id, v_prog.id, 1)
    RETURNING id INTO v_new_id;

    -- Registrar el sello
    INSERT INTO loyalty_stamps (card_id, reserva_id, stamped_at)
    VALUES (v_new_id, p_reserva_id, now());
  END IF;

  RETURN jsonb_build_object(
    'ok',       true,
    'dar_nueva', p_dar_nueva,
    'beneficio', COALESCE(v_prog.beneficio_descripcion, '')
  );
END;
$$;

-- ─── Permisos (igual que las funciones anteriores) ────────────────────────────
GRANT EXECUTE ON FUNCTION public.add_loyalty_stamp(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_card(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_and_give_new_card(UUID, BOOLEAN) TO authenticated;
