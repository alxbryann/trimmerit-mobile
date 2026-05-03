const FEED_POST_SELECT = '*, barberos(nombre_barberia, profiles(nombre))';
const REACTION_TYPES = ['fuego', 'tijeras', 'estrella', 'corazon'];

function emptyReactionCounts() {
  return REACTION_TYPES.reduce((acc, tipo) => ({ ...acc, [tipo]: 0 }), {});
}

function groupFeedMetadata(posts, reactions, comments, profilesById, currentUserId) {
  const metaByPost = new Map(
    posts.map((post) => [
      post.id,
      {
        _reacciones: emptyReactionCounts(),
        _mis_reacciones: [],
        _comentarios: [],
        _comentarios_count: 0,
      },
    ])
  );

  for (const reaction of reactions) {
    const meta = metaByPost.get(reaction.pub_id);
    if (!meta || !REACTION_TYPES.includes(reaction.tipo)) continue;

    meta._reacciones[reaction.tipo] += 1;
    if (reaction.usuario_id === currentUserId) {
      meta._mis_reacciones.push(reaction.tipo);
    }
  }

  for (const comment of comments) {
    const meta = metaByPost.get(comment.pub_id);
    if (!meta) continue;

    const profile = profilesById.get(comment.autor_id);
    meta._comentarios.push({
      ...comment,
      profiles: profile
        ? { nombre: profile.nombre, role: profile.role }
        : { nombre: 'Usuario', role: 'cliente' },
    });
    meta._comentarios_count += 1;
  }

  return posts.map((post) => ({
    ...post,
    ...metaByPost.get(post.id),
  }));
}

export async function fetchFeedPosts(supabase, currentUserId) {
  const { data: posts, error: postsError } = await supabase
    .from('publicaciones')
    .select(FEED_POST_SELECT)
    .eq('activo', true)
    .order('created_at', { ascending: false });

  if (postsError) throw new Error(postsError.message);
  if (!posts?.length) return [];

  const postIds = posts.map((post) => post.id);

  const [
    { data: reactions, error: reactionsError },
    { data: comments, error: commentsError },
  ] = await Promise.all([
    supabase
      .from('pub_reacciones')
      .select('pub_id, usuario_id, tipo')
      .in('pub_id', postIds),
    supabase
      .from('pub_comentarios')
      .select('id, pub_id, autor_id, texto, created_at')
      .in('pub_id', postIds)
      .order('created_at', { ascending: true }),
  ]);

  if (reactionsError) throw new Error(reactionsError.message);
  if (commentsError) throw new Error(commentsError.message);

  const authorIds = [...new Set((comments ?? []).map((comment) => comment.autor_id).filter(Boolean))];
  let profilesById = new Map();

  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nombre, role')
      .in('id', authorIds);

    profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  }

  return groupFeedMetadata(posts, reactions ?? [], comments ?? [], profilesById, currentUserId);
}
