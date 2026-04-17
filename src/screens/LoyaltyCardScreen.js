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
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, radii } from '../theme';
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

    if (!s?.user) {
      setCards([]);
      if (!silent) setLoading(false);
      return;
    }

    // Traer tarjetas con datos del programa y de la barbería
    const { data, error } = await supabase
      .from('loyalty_cards')
      .select(`
        id,
        sellos_acumulados,
        canjeado_at,
        barbero_id,
        loyalty_programs (
          sellos_requeridos,
          beneficio_descripcion,
          beneficio_tipo,
          activo
        ),
        barberos (
          nombre_barberia,
          profiles ( nombre )
        )
      `)
      .eq('cliente_id', s.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setErr(error.message);
      setCards([]);
    } else {
      // Solo mostrar tarjetas con programa activo
      const filtered = (data ?? []).filter(
        (c) => c.loyalty_programs?.activo !== false
      );
      setCards(filtered);
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
    return (
      card.barberos?.nombre_barberia?.trim() ||
      card.barberos?.profiles?.nombre ||
      'Barbería'
    );
  }

  function isCompletada(card) {
    const prog = card.loyalty_programs;
    if (!prog) return false;
    return card.sellos_acumulados >= prog.sellos_requeridos;
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#141414', colors.black]}
        style={styles.headerGrad}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>MIS TARJETAS</Text>
            <Text style={styles.headerTitle}>FIDELIZACIÓN</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="ribbon" size={18} color={colors.acid} />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.acid}
          />
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
            icon="log-in-outline"
            title="Iniciá sesión"
            subtitle="Necesitás una cuenta para ver tus tarjetas de fidelización."
            action="Iniciar sesión"
            onAction={() => navigation.navigate('Login')}
          />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="ribbon-outline"
            title="Sin tarjetas todavía"
            subtitle={'Reservá y completá cortes en barberías que tengan programa de fidelización para acumular sellos.'}
            action="Ver barberías"
            onAction={() => navigation.navigate('Catalogo')}
          />
        ) : (
          <>
            {/* Tarjetas listas para canjear primero */}
            {cards.filter(isCompletada).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>LISTAS PARA CANJEAR</Text>
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

            {/* Tarjetas en progreso */}
            {cards.filter((c) => !isCompletada(c)).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>EN PROGRESO</Text>
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

function EmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <View style={styles.emptyBlock}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={colors.grayMid} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action && onAction && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAction}>
          <Text style={styles.emptyBtnText}>{action.toUpperCase()}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  center: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGrad: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.acid,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.white,
    letterSpacing: 1,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2.5,
    color: colors.grayLight,
    marginTop: 4,
    marginBottom: 2,
  },
  redeemHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.grayMid,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: 12,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.grayLight,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.acid,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: {
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.acid,
  },
});
