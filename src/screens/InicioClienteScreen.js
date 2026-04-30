/**
 * InicioClienteScreen — Pantalla principal del cliente
 *
 * Secciones:
 *  1. Tus barberías — las más visitadas por el usuario (RPC get_frecuentes_cliente)
 *  2. Feed — placeholder (publicaciones de barberos, HU pendiente)
 *
 * OWASP:
 *  A01 — userId siempre de auth.getSession() / auth.getUser(), nunca de parámetros
 *  A02 — no se logean datos del usuario ni tokens
 *  A09 — solo logs en __DEV__
 */

import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';
import PostCard from '../components/PostCard';

const SERVICIOS_LABELS = {
  mascarilla: 'Mascarilla',
  tinturas:   'Tinturas',
  lavado:     'Lavado',
};

// ── Componente: card de una barbería frecuente ────────────────────────────────
function BarberiaCard({ item, onPress }) {
  const servicios = (item.servicios_especiales ?? [])
    .map((s) => SERVICIOS_LABELS[s] ?? s)
    .slice(0, 2);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardKicker}>
            {item.ciudad ? `— ${item.ciudad.toLowerCase()} —` : '— local —'}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.nombre}</Text>
          {item.direccion ? (
            <Text style={styles.cardAddr} numberOfLines={1}>{item.direccion}</Text>
          ) : null}
        </View>
        <View style={styles.monoWrap}>
          <Text style={styles.monoChar}>{item.nombre?.charAt(0)?.toLowerCase() ?? '?'}</Text>
        </View>
      </View>

      {servicios.length > 0 && (
        <View style={styles.serviciosRow}>
          {servicios.map((s) => (
            <View key={s} style={styles.servicioBadge}>
              <Text style={styles.servicioTxt}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {item.hora_apertura && item.hora_cierre && (
        <Text style={styles.horario}>{item.hora_apertura} – {item.hora_cierre}</Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.visitasTxt}>
          {item.visitas === 1 ? '1 visita' : `${item.visitas} visitas`}
        </Text>
        <Text style={styles.reservarBtn}>reservar →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function InicioClienteScreen({ navigation }) {
  const [frecuentes, setFrecuentes] = useState([]);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  // OWASP A01: userId siempre desde la sesión activa en el servidor
  async function loadData(silent = false) {
    if (!supabaseConfigured) { setLoading(false); return; }
    if (!silent) setLoading(true);

    try {
      // Obtener sesión validada (no solo decodificar el JWT)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setRefreshing(false); return; }

      setCurrentUserId(user.id);

      // Nombre del usuario (para saludo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle();
      const nombre = profile?.nombre?.split(' ')[0] ?? '';
      setNombreUsuario(nombre);

      // Barberías más visitadas (RPC SECURITY DEFINER filtra por auth.uid())
      const { data: fData } = await supabase.rpc('get_frecuentes_cliente', { p_limit: 3 });
      setFrecuentes(fData ?? []);

      // Feed de publicaciones
      const { data: feedData } = await supabase
        .from('publicaciones')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false });
      setPosts(feedData ?? []);
    } catch (e) {
      if (__DEV__) console.warn('[InicioCliente] Error cargando datos:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleToggleReaccion(postId, tipo) {
    await supabase.rpc('toggle_reaccion', { p_pub_id: postId, p_tipo: tipo });
  }

  async function handleAddComentario(postId, texto) {
    if (!currentUserId) return;
    await supabase.from('pub_comentarios').insert({
      pub_id:   postId,
      autor_id: currentUserId,
      texto,
    });
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  function onRefresh() {
    setRefreshing(true);
    loadData(true);
  }

  function handleBarberiaPress(item) {
    // Navegar al perfil de la barbería — usamos el slug del barbero por compatibilidad
    // con BarberProfileScreen (hasta que exista BarberiaDetailScreen)
    navigation.navigate('BarberProfile', { slug: item.slug });
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.champagne}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerKicker}>— trimmerit™ · {new Date().getFullYear()} —</Text>
            <Text style={styles.headerTitle}>
              {nombreUsuario ? `hola,\n${nombreUsuario.toLowerCase()}.` : 'buen\ndía.'}
            </Text>
          </View>

          {/* Barberías frecuentes */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>tus favoritas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Catalogo')}>
                <Text style={styles.sectionLink}>ver todos →</Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.champagne} />
              </View>
            )}

            {!loading && frecuentes.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✦</Text>
                <Text style={styles.emptyTitle}>aún no tenés visitas</Text>
                <Text style={styles.emptyHint}>
                  Reservá tu primera cita y aparecerá acá.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('Catalogo')}
                >
                  <Text style={styles.emptyBtnTxt}>explorar barberías →</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && frecuentes.map((item) => (
              <BarberiaCard
                key={item.barberia_id}
                item={item}
                onPress={() => handleBarberiaPress(item)}
              />
            ))}
          </View>

          {/* Feed — publicaciones de barberos */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>feed</Text>
            </View>
          </View>

          {posts.length === 0 && !loading && (
            <View style={[styles.section, { paddingTop: 0 }]}>
              <View style={styles.feedPlaceholder}>
                <Text style={styles.feedIcon}>✧</Text>
                <Text style={styles.feedTitle}>sin novedades</Text>
                <Text style={styles.feedHint}>
                  Acá verás publicaciones, trabajos y novedades{'\n'}de los barberos.
                </Text>
              </View>
            </View>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onToggleReaccion={handleToggleReaccion}
              onAddComentario={handleAddComentario}
            />
          ))}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerKicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 52,
    lineHeight: 50,
    color: colors.paper,
    letterSpacing: -1,
  },

  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  sectionLink: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.champagne,
  },

  center: { paddingVertical: 28, alignItems: 'center' },

  // Barbería card
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cardMeta: { flex: 1 },
  cardKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 24,
    color: colors.paper,
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  cardAddr: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  monoWrap: {
    width: 48,
    height: 48,
    backgroundColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monoChar: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 30,
    color: colors.champagne,
    letterSpacing: -1,
    lineHeight: 34,
  },
  serviciosRow: { flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  servicioBadge: {
    borderWidth: 1,
    borderColor: colors.champagneDim,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  servicioTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.champagne,
  },
  horario: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 6,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visitasTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
  },
  reservarBtn: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.champagne,
  },

  // Estado vacío
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 26, color: colors.champagne, marginBottom: 4 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyBtn: { marginTop: 8 },
  emptyBtnTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.champagne,
  },

  // Feed empty state
  feedPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  feedIcon: { fontSize: 28, color: colors.muted2, marginBottom: 4 },
  feedTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.muted,
    letterSpacing: -0.5,
  },
  feedHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted2,
    textAlign: 'center',
    lineHeight: 18,
  },
})