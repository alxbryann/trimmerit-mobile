import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts } from '../theme';
import LoyaltyCard from '../components/LoyaltyCard';

export default function LoyaltyCardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState([]);
  const [err, setErr] = useState(null);
  const [session, setSession] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent) setLoading(true);
    setErr(null);

    if (!supabaseConfigured) {
      setErr('Configura Supabase para usar la app.');
      if (!silent) setLoading(false);
      return;
    }

    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);

    if (!s?.user) { setCards([]); if (!silent) setLoading(false); return; }

    const { data: rows, error } = await supabase
      .from('loyalty_cards')
      .select(`
        id, sellos_acumulados, canjeado_at, barbero_id,
        loyalty_programs ( sellos_requeridos, beneficio_descripcion, beneficio_tipo, activo )
      `)
      .eq('cliente_id', s.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setErr(error.message);
      setCards([]);
    } else {
      const list = rows ?? [];
      const barberIds = [...new Set(list.map((c) => c.barbero_id).filter(Boolean))];
      let barberById = {};
      if (barberIds.length > 0) {
        const { data: barr, error: bErr } = await supabase
          .from('barberos')
          .select('id, nombre_barberia, profiles ( nombre )')
          .in('id', barberIds);
        if (bErr) { setErr(bErr.message); setCards([]); if (!silent) setLoading(false); return; }
        barberById = Object.fromEntries((barr ?? []).map((b) => [b.id, b]));
      }
      const merged = list.map((c) => ({ ...c, barberos: barberById[c.barbero_id] ?? null }));
      setCards(merged.filter((c) => c.loyalty_programs?.activo !== false));
    }

    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load({ silent: true }));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  function nombreBarberia(card) {
    return card.barberos?.nombre_barberia?.trim() || card.barberos?.profiles?.nombre || 'Barbería';
  }

  function isCompletada(card) {
    const prog = card.loyalty_programs;
    if (!prog) return false;
    return card.sellos_acumulados >= prog.sellos_requeridos;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.champagne} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>— lealtad —</Text>
        <Text style={styles.headerTitle}>sellos.</Text>
        <Text style={styles.headerSub}>
          Un sello por cada corte completado. La tarjeta la lleva tu barbero en la app.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.champagne} />
        }
        showsVerticalScrollIndicator={false}
      >
        {err && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{err}</Text>
          </View>
        )}

        {!session?.user ? (
          <EmptyState
            title="iniciá sesión"
            subtitle="Necesitás una cuenta para ver tus tarjetas de fidelización."
            action="iniciar sesión →"
            onAction={() => navigation.navigate('Login')}
          />
        ) : cards.length === 0 ? (
          <EmptyState
            title="sin tarjetas todavía"
            subtitle="Reservá y completá cortes en barberías con programa de fidelización para acumular sellos."
            action="ver barberías →"
            onAction={() => navigation.navigate('Catalogo')}
          />
        ) : (
          <>
            {cards.filter(isCompletada).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>listas para canjear</Text>
                {cards.filter(isCompletada).map((card) => (
                  <View key={card.id}>
                    <LoyaltyCard
                      nombreBarberia={nombreBarberia(card)}
                      sellosAcumulados={card.sellos_acumulados}
                      sellosRequeridos={card.loyalty_programs?.sellos_requeridos ?? 10}
                      beneficioDesc={card.loyalty_programs?.beneficio_descripcion ?? ''}
                      completada
                    />
                    <Text style={styles.redeemHint}>
                      Mostrá esta tarjeta en tu próxima visita para canjear el beneficio.
                    </Text>
                  </View>
                ))}
              </>
            )}

            {cards.filter((c) => !isCompletada(c)).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>en progreso</Text>
                {cards.filter((c) => !isCompletada(c)).map((card) => (
                  <LoyaltyCard
                    key={card.id}
                    nombreBarberia={nombreBarberia(card)}
                    sellosAcumulados={card.sellos_acumulados}
                    sellosRequeridos={card.loyalty_programs?.sellos_requeridos ?? 10}
                    beneficioDesc={card.loyalty_programs?.beneficio_descripcion ?? ''}
                    completada={false}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action && onAction && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAction}>
          <Text style={styles.emptyBtnText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.champagne,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 48,
    lineHeight: 46,
    color: colors.paper,
    letterSpacing: -1,
    marginBottom: 8,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    maxWidth: 280,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 12 },

  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 4,
    marginBottom: 4,
  },
  redeemHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 4,
  },
  errorBox: { borderWidth: 1, borderColor: 'rgba(184,94,76,0.3)', padding: 12 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.terracota },

  emptyBlock: { alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 16 },
  emptyTitle: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 26,
    color: colors.paper,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.champagne,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.champagne,
    letterSpacing: -0.5,
  },
});
