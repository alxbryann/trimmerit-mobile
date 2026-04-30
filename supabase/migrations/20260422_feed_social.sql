-- =============================================================================
-- Feed Social v1: publicaciones extendidas + comentarios + reacciones
-- =============================================================================
-- Cambios:
--   1. Extender publicaciones con media_urls, video_url, text_style
--   2. Crear pub_comentarios (comentarios por publicación)
--   3. Crear pub_reacciones  (reacciones emoji por publicación)
--   4. toggle_reaccion RPC   (insertar/quitar reacción del usuario)
-- =============================================================================

-- ─── 1. Extender tabla publicaciones ─────────────────────────────────────────
ALTER TABLE public.publicaciones
  ADD COLUMN IF NOT EXISTS media_urls   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_url    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS text_style   JSONB   NOT NULL DEFAULT '{}';
--  text_style shape: { align: 'left'|'center', bold: bool, size: 'normal'|'large' }

COMMENT ON COLUMN public.publicaciones.media_urls IS 'URLs de imágenes (S3) — carrusel';
COMMENT ON COLUMN public.publicaciones.video_url  IS 'URL de video corto (≤10s) en S3';
COMMENT ON COLUMN public.publicaciones.text_style IS 'Formato del caption: align, bold, size';

-- ─── 2. Tabla pub_comentarios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pub_comentarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pub_id     UUID        NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  autor_id   UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  texto      TEXT        NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pub_comentarios_pub_idx ON public.pub_comentarios (pub_id, created_at DESC);

ALTER TABLE public.pub_comentarios ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer comentarios de publicaciones activas
CREATE POLICY "comentarios_select_authed"
  ON public.pub_comentarios FOR SELECT TO authenticated
  USING (true);

-- Solo el autor puede insertar su comentario (OWASP A01)
CREATE POLICY "comentarios_insert_own"
  ON public.pub_comentarios FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());

-- El autor puede borrar su propio comentario
CREATE POLICY "comentarios_delete_own"
  ON public.pub_comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

-- ─── 3. Tabla pub_reacciones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pub_reacciones (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pub_id     UUID        NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  usuario_id UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('fuego', 'tijeras', 'estrella', 'corazon')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pub_id, usuario_id, tipo)
);

CREATE INDEX IF NOT EXISTS pub_reacciones_pub_idx ON public.pub_reacciones (pub_id, tipo);

ALTER TABLE public.pub_reacciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reacciones_select_authed"
  ON public.pub_reacciones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "reacciones_insert_own"
  ON public.pub_reacciones FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "reacciones_delete_own"
  ON public.pub_reacciones FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

-- ─── 4. RPC toggle_reaccion ───────────────────────────────────────────────────
--
-- Alterna la reacción de un usuario sobre una publicación.
-- Devuelve: { ok, activa (bool — true = la reacción quedó activa), count (total de ese tipo) }
-- OWASP A01: usa auth.uid() directamente, no acepta usuario por parámetro
-- OWASP A04: verifica que la publicación exista antes de insertar
CREATE OR REPLACE FUNCTION public.toggle_reaccion(p_pub_id UUID, p_tipo TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID    := auth.uid();
  v_exists BOOLEAN;
  v_count  BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized');
  END IF;

  -- OWASP A04: verificar que la publicación exista y esté activa
  IF NOT EXISTS (SELECT 1 FROM publicaciones WHERE id = p_pub_id AND activo = true) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Validar tipo (doble check en caso de bypass de RLS)
  IF p_tipo NOT IN ('fuego', 'tijeras', 'estrella', 'corazon') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tipo');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pub_reacciones
    WHERE pub_id = p_pub_id AND usuario_id = v_uid AND tipo = p_tipo
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM pub_reacciones WHERE pub_id = p_pub_id AND usuario_id = v_uid AND tipo = p_tipo;
  ELSE
    INSERT INTO pub_reacciones (pub_id, usuario_id, tipo) VALUES (p_pub_id, v_uid, p_tipo);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM pub_reacciones WHERE pub_id = p_pub_id AND tipo = p_tipo;

  RETURN jsonb_build_object(
    'ok',    true,
    'activa', NOT v_exists,
    'count',  v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_reaccion(UUID, TEXT) TO authenticated;
