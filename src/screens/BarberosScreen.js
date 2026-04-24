import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';
import { initialsFromNombre } from '../utils/booking';

const SELECT_COLS = 'id, slug, especialidades, total_cortes, nombre_barberia, profiles(nombre)';

export default function BarberosScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [q, setQ] = useState('');

  const fetchCatalog = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);

    if (!supabaseConfigured) {
      setLoading(false);
      setFetchError('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    const isActive = typeof opts.isActive === 'function' ? opts.isActive : () => true;
    const t = setTimeout(() => {
      if (isActive()) {
        setLoading(false);
        setFetchError('Tiempo de espera agotado.');
      }
    }, 8000);

    try {
      const { data, error } = await supabase.from('barberos').select(SELECT_COLS);
      clearTimeout(t);
      if (!isActive()) return;
      if (error) { setFetchError(error.message); setBarbers([]); return; }

      let list = data ?? [];
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: mine, error: mineErr } = await supabase
          .from('barberos').select(SELECT_COLS).eq('id', uid).maybeSingle();
        if (isActive() && !mineErr && mine && !list.some((b) => b.id === mine.id)) {
          list = [mine, ...list];
        }
      }
      if (!isActive()) return;
      setFetchError(null);
      setBarbers(list);
    } catch (e) {
      clearTimeout(t);
      if (isActive()) { setFetchError(String(e)); setBarbers([]); }
    } finally {
      clearTimeout(t);
      if (isActive()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchCatalog({ isActive: () => active });
      return () => { active = false; };
    }, [fetchCatalog])
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return;
      fetchCatalog({ silent: true });
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [fetchCatalog]);

  const filtered = barbers.filter((b) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    const nombre = (b.nombre_barberia || b.profiles?.nombre || b.slug || '').toLowerCase();
    return nombre.includes(ql);
  });

  function renderItem({ item, index }) {
    const nombrePersona = item.profiles?.nombre?.trim() || item.slug.replace(/-/g, ' ');
    const nombre = item.nombre_barberia?.trim() || nombrePersona;
    const specialty = item.especialidades?.length > 0 ? item.especialidades.join(' · ') : 'Fade · Diseños · Barba';
    const ini = initialsFromNombre(nombrePersona, item.slug);
    const featured = index === 0;

    return (
      <TouchableOpacity
        style={[styles.card, featured && styles.cardFeatured]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('BarberProfile', { slug: item.slug })}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardKicker}>{featured ? '— destacado —' : `— ${specialty.split('·')[0].trim().toLowerCase()} —`}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{nombre}</Text>
            <Text style={styles.cardSub}>por {nombrePersona}</Text>
          </View>
          <View style={styles.monoWrap}>
            <Text style={styles.monoChar}>{ini.charAt(0).toLowerCase()}</Text>
          </View>
        </View>

        {item.total_cortes > 0 && (
          <Text style={styles.cortesLabel}>★ {item.total_cortes.toLocaleString()} cortes</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.reservarBtn}>reservar →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerKicker}>— catálogo · n.º 47 —</Text>
          <Text style={styles.headerTitle}>buena{'\n'}tijera.</Text>
        </View>

        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="buscar local o profesional"
            placeholderTextColor={colors.muted2}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {barbers.length > 0 && (
            <Text style={styles.countText}>{filtered.length} abiertos</Text>
          )}
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.champagne} />
            <Text style={styles.muted}>Cargando catálogo…</Text>
          </View>
        )}

        {!loading && fetchError && (
          <View style={styles.center}>
            <View style={styles.errCard}>
              <Text style={styles.errIcon}>⚠</Text>
              <Text style={styles.err}>{fetchError}</Text>
            </View>
          </View>
        )}

        {!loading && !fetchError && barbers.length === 0 && (
          <View style={styles.center}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>aún no hay profesionales</Text>
              <Text style={styles.muted}>Sé el primero en unirte a la plataforma.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Registro')} style={styles.linkBtn}>
                <Text style={styles.linkText}>Regístrate como profesional →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!loading && !fetchError && filtered.length > 0 && (
          <FlatList
            data={filtered}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  headerKicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 48,
    lineHeight: 46,
    color: colors.paper,
    letterSpacing: -1,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, color: colors.champagne },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.paper,
    paddingVertical: 0,
  },
  countText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.muted,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { fontFamily: fonts.body, color: colors.muted, textAlign: 'center', fontSize: 14 },

  errCard: {
    borderWidth: 1,
    borderColor: 'rgba(184,94,76,0.3)',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
  },
  errIcon: { fontSize: 24, color: colors.terracota },
  err: { fontFamily: fonts.body, color: colors.terracota, textAlign: 'center', fontSize: 14 },

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
  },
  emptyIcon: { fontSize: 28, color: colors.champagne, marginBottom: 4 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.paper,
    letterSpacing: -0.5,
  },
  linkBtn: { marginTop: 8 },
  linkText: { fontFamily: fonts.bodySemi, color: colors.champagne, fontSize: 13 },

  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    backgroundColor: 'transparent',
  },
  cardFeatured: {
    borderColor: colors.champagneDim,
    backgroundColor: colors.champagneGlow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
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
  cardSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  monoWrap: {
    width: 52,
    height: 52,
    backgroundColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  monoChar: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 32,
    color: colors.champagne,
    letterSpacing: -1,
    lineHeight: 36,
  },
  cortesLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.champagne,
    marginBottom: 10,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  reservarBtn: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
});
