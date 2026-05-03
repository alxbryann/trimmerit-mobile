-- =============================================================================
-- Feed RPC: publicaciones + autor + reacciones + comentarios recientes
-- =============================================================================
-- Evita armar el feed desde el cliente con varias queries y muchas filas.
-- Devuelve el mismo shape que PostCard ya consume:
--   barberos, _reacciones, _mis_reacciones, _comentarios_count, _comentarios
-- =============================================================================

CREATE INDEX IF NOT EXISTS publicaciones_activo_created_idx
  ON public.publicaciones (activo, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_feed_posts(
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS SETOF JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT auth.uid() AS uid
  ),
  params AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50) AS lim,
      GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  feed_posts AS (
    SELECT p.*
    FROM public.publicaciones p, params
    WHERE p.activo = true
      AND (SELECT uid FROM caller) IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT (SELECT lim FROM params)
    OFFSET (SELECT off FROM params)
  )
  SELECT
    to_jsonb(p)
    || jsonb_build_object(
      'barberos',
        jsonb_build_object(
          'nombre_barberia', COALESCE(b.nombre_barberia, '—'),
          'profiles', jsonb_build_object('nombre', COALESCE(bp.nombre, '—'))
        ),
      '_reacciones',
        jsonb_build_object(
          'fuego',    COALESCE(r.fuego, 0),
          'tijeras',  COALESCE(r.tijeras, 0),
          'estrella', COALESCE(r.estrella, 0),
          'corazon',  COALESCE(r.corazon, 0)
        ),
      '_mis_reacciones', COALESCE(m.mine, '[]'::jsonb),
      '_comentarios_count', COALESCE(c.total, 0),
      '_comentarios', COALESCE(c.items, '[]'::jsonb)
    )
  FROM feed_posts p
  LEFT JOIN public.barberos b ON b.id = p.barbero_id
  LEFT JOIN public.profiles bp ON bp.id = b.id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE pr.tipo = 'fuego')    AS fuego,
      COUNT(*) FILTER (WHERE pr.tipo = 'tijeras')  AS tijeras,
      COUNT(*) FILTER (WHERE pr.tipo = 'estrella') AS estrella,
      COUNT(*) FILTER (WHERE pr.tipo = 'corazon')  AS corazon
    FROM public.pub_reacciones pr
    WHERE pr.pub_id = p.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(pr.tipo ORDER BY pr.tipo) AS mine
    FROM public.pub_reacciones pr
    WHERE pr.pub_id = p.id
      AND pr.usuario_id = (SELECT uid FROM caller)
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT
      (SELECT COUNT(*) FROM public.pub_comentarios pc WHERE pc.pub_id = p.id) AS total,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', recent.id,
            'pub_id', recent.pub_id,
            'autor_id', recent.autor_id,
            'texto', recent.texto,
            'created_at', recent.created_at,
            'profiles', jsonb_build_object(
              'nombre', COALESCE(prof.nombre, 'Usuario'),
              'role', COALESCE(prof.role, 'cliente')
            )
          )
          ORDER BY recent.created_at ASC
        ) FILTER (WHERE recent.id IS NOT NULL),
        '[]'::jsonb
      ) AS items
    FROM (
      SELECT pc.*
      FROM public.pub_comentarios pc
      WHERE pc.pub_id = p.id
      ORDER BY pc.created_at DESC
      LIMIT 2
    ) recent
    LEFT JOIN public.profiles prof ON prof.id = recent.autor_id
  ) c ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_posts(INT, INT) TO authenticated;
