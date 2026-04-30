import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, shadows } from '../theme';
import RankBadge from '../components/RankBadge';

// Rangos de clientes (basado en visitas completadas)
const CLIENT_RANKS = [
  { rank_level: 1, rank_name: 'Nuevo',    badge_emoji: '✂️', min_cortes: 0,  description: 'Bienvenido a Trimmerit' },
  { rank_level: 2, rank_name: 'Regular',  badge_emoji: '⭐', min_cortes: 5,  description: '5+ cortes completados' },
  { rank_level: 3, rank_name: 'Fiel',     badge_emoji: '🏅', min_cortes: 15, description: '15+ cortes — cliente de confianza' },
  { rank_level: 4, rank_name: 'VIP',      badge_emoji: '👑', min_cortes: 30, description: '30+ cortes — acceso prioritario' },
  { rank_level: 5, rank_name: 'Elite',    badge_emoji: '🔥', min_cortes: 60, description: '60+ cortes — nivel máximo' },
];

const RARITY_COLORS = {
  common:    colors.champagneDim,
  uncommon:  colors.olivo,
  rare:      colors.champagne,
  legendary: colors.terracota,
};

const RARITY_LABELS = {
  common:    'COMÚN',
  uncommon:  'INUSUAL',
  rare:      'RARO',
  legendary: 'LEGENDARIO',
};

function getClientRank(totalVisitas) {
  let current = CLIENT_RANKS[0];
  for (const r of CLIENT_RANKS) {
    if (totalVisitas >= r.min_cortes) current = r;
  }
  return current;
}

function getNextRank(allRanks, currentLevel) {
  return allRanks.find((r) => r.rank_level === currentLevel + 1) ?? null;
}

export default function LogrosScreen() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);

  // Barber state
  const [barberStats, setBarberStats] = useState(null);
  const [allBarberRanks, setAllBarberRanks] = useState([]);
  const [currentBarberRank, setCurrentBarberRank] = useState(null);

  // Client state
  const [clientStats, setClientStats] = useState(null);

  // Shared
  const [achievements, setAchievements] = useState([]);
  const [earnedIds, setEarnedIds] = useState(new Set());
  const [selectedAch, setSelectedAch] = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const uid = session.user.id;
    setUserId(uid);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();

    const userRole = profile?.role ?? 'cliente';
    setRole(userRole);

    const isBarber = ['barbero', 'admin_barberia', 'barbero_empleado'].includes(userRole);

    if (isBarber) {
      await loadBarberData(uid);
    } else {
      await loadClientData(uid);
    }

    setLoading(false);
  }

  async function loadBarberData(uid) {
    // Cargar rangos
    const { data: ranks } = await supabase
      .from('barber_ranks')
      .select('*')
      .order('rank_level', { ascending: true });
    setAllBarberRanks(ranks ?? []);

    // Estadísticas del barbero
    const [{ count: totalCortes }, { data: reseñasData }] = await Promise.all([
      supabase
        .from('reservas')
        .select('*', { count: 'exact', head: true })
        .eq('barbero_id', uid)
        .eq('estado', 'completada'),
      supabase
        .from('reseñas')
        .select('estrellas')
        .eq('barbero_id', uid),
    ]);

    const cortes = totalCortes ?? 0;
    const avgRating = reseñasData?.length
      ? reseñasData.reduce((s, r) => s + r.estrellas, 0) / reseñasData.length
      : 0;

    setBarberStats({ totalCortes: cortes, avgRating, totalReseñas: reseñasData?.length ?? 0 });

    // Rango actual (el más alto que cumple los requisitos)
    const eligible = (ranks ?? []).filter(
      (r) => cortes >= r.min_cortes && avgRating >= r.min_rating
    );
    const current = eligible.length ? eligible[eligible.length - 1] : (ranks ?? [])[0];
    setCurrentBarberRank(current ?? null);

    // Logros
    await loadAchievements(uid, 'barbero');
  }

  async function loadClientData(uid) {
    const [{ count: totalVisitas }, { count: totalReseñas }] = await Promise.all([
      supabase
        .from('reservas')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', uid)
        .eq('estado', 'completada'),
      supabase
        .from('reseñas')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', uid),
    ]);

    setClientStats({
      totalVisitas: totalVisitas ?? 0,
      totalReseñas: totalReseñas ?? 0,
    });

    await loadAchievements(uid, 'cliente');
  }

  async function loadAchievements(uid, category) {
    const [{ data: achs }, { data: earned }] = await Promise.all([
      supabase
        .from('achievements')
        .select('*')
        .eq('category', category)
        .order('condition_value', { ascending: true }),
      supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', uid),
    ]);

    setAchievements(achs ?? []);
    setEarnedIds(new Set((earned ?? []).map((e) => e.achievement_id)));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.champagne} />
      </View>
    );
  }

  const isBarber = ['barbero', 'admin_barberia', 'barbero_empleado'].includes(role);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenKicker}>— logros —</Text>

        {isBarber
          ? <BarberRankSection
              stats={barberStats}
              currentRank={currentBarberRank}
              allRanks={allBarberRanks}
            />
          : <ClientRankSection stats={clientStats} />
        }

        <View style={styles.achSection}>
          <Text style={styles.sectionTitle}>Logros</Text>
          <Text style={styles.sectionSub}>
            {earnedIds.size}/{achievements.length} desbloqueados
          </Text>

          {achievements.map((ach) => {
            const earned = earnedIds.has(ach.id);
            const rarityColor = RARITY_COLORS[ach.rarity] ?? colors.champagneDim;
            return (
              <TouchableOpacity
                key={ach.id}
                style={[styles.achCard, !earned && styles.achCardLocked]}
                onPress={() => setSelectedAch(ach)}
                activeOpacity={0.8}
              >
                <View style={[styles.achIcon, { borderColor: earned ? rarityColor : colors.border }]}>
                  <Text style={[styles.achEmoji, !earned && { opacity: 0.3 }]}>
                    {ach.badge_emoji}
                  </Text>
                </View>
                <View style={styles.achInfo}>
                  <Text style={[styles.achName, !earned && styles.achNameLocked]}>
                    {ach.achievement_name}
                  </Text>
                  <Text style={styles.achDesc} numberOfLines={1}>
                    {ach.description}
                  </Text>
                  <Text style={[styles.achRarity, { color: rarityColor }]}>
                    {RARITY_LABELS[ach.rarity] ?? ach.rarity.toUpperCase()}
                    {' · '}+{ach.points} pts
                  </Text>
                </View>
                {earned && (
                  <View style={styles.achCheck}>
                    <Text style={styles.achCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal detalle logro */}
      <Modal
        visible={Boolean(selectedAch)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAch(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedAch(null)}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalEmoji}>{selectedAch?.badge_emoji}</Text>
            <Text style={styles.modalTitle}>{selectedAch?.achievement_name}</Text>
            <Text style={styles.modalDesc}>{selectedAch?.description}</Text>
            <View style={styles.modalMeta}>
              <Text style={[styles.modalRarity, {
                color: RARITY_COLORS[selectedAch?.rarity] ?? colors.champagne,
              }]}>
                {RARITY_LABELS[selectedAch?.rarity] ?? ''}
              </Text>
              <Text style={styles.modalPoints}>+{selectedAch?.points} puntos</Text>
            </View>
            {earnedIds.has(selectedAch?.id) ? (
              <View style={styles.modalEarnedBadge}>
                <Text style={styles.modalEarnedText}>✓ DESBLOQUEADO</Text>
              </View>
            ) : (
              <Text style={styles.modalLockedText}>Sigue progresando para desbloquearlo</Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function BarberRankSection({ stats, currentRank, allRanks }) {
  const nextRank = getNextRank(allRanks, currentRank?.rank_level ?? 0);
  const progress = nextRank && stats
    ? Math.min(100, (stats.totalCortes / nextRank.min_cortes) * 100)
    : 100;

  return (
    <>
      <View style={styles.rankCard}>
        <View style={styles.rankCardLeft}>
          <RankBadge rank={currentRank} size="lg" />
        </View>
        <View style={styles.rankCardRight}>
          <Text style={styles.rankKicker}>— tu rango —</Text>
          <Text style={styles.rankName}>{currentRank?.rank_name ?? '—'}</Text>
          <Text style={styles.rankDesc}>{currentRank?.description ?? ''}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats?.totalCortes ?? 0}</Text>
          <Text style={styles.statLbl}>CORTES</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>
            {stats?.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
          </Text>
          <Text style={styles.statLbl}>RATING</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats?.totalReseñas ?? 0}</Text>
          <Text style={styles.statLbl}>RESEÑAS</Text>
        </View>
      </View>

      {nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Próximo: {nextRank.rank_name} {nextRank.badge_emoji}</Text>
            <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.champagneDim, colors.champagne]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressSub}>
            {stats?.totalCortes ?? 0} / {nextRank.min_cortes} cortes
            {nextRank.min_rating > 0 ? ` · ★${nextRank.min_rating} mín.` : ''}
          </Text>
        </View>
      )}

      <View style={styles.ranksRoadmap}>
        <Text style={styles.sectionTitle}>Camino al éxito</Text>
        {allRanks.map((rank) => {
          const active = rank.rank_level === currentRank?.rank_level;
          const passed = rank.rank_level < (currentRank?.rank_level ?? 0);
          return (
            <View key={rank.id} style={[styles.rankRow, active && styles.rankRowActive]}>
              <Text style={[styles.rankRowEmoji, (passed || active) ? {} : { opacity: 0.3 }]}>
                {rank.badge_emoji}
              </Text>
              <View style={styles.rankRowInfo}>
                <Text style={[styles.rankRowName, active && { color: colors.champagne }]}>
                  {rank.rank_name}
                </Text>
                <Text style={styles.rankRowReq}>
                  {rank.min_cortes} cortes
                  {rank.min_rating > 0 ? ` · ★${rank.min_rating}` : ''}
                </Text>
              </View>
              {active && <Text style={styles.rankCurrent}>ACTUAL</Text>}
              {passed && <Text style={styles.rankPassed}>✓</Text>}
            </View>
          );
        })}
      </View>
    </>
  );
}

function ClientRankSection({ stats }) {
  const totalVisitas = stats?.totalVisitas ?? 0;
  const currentRank = getClientRank(totalVisitas);
  const nextRank = CLIENT_RANKS.find((r) => r.rank_level === currentRank.rank_level + 1) ?? null;
  const progress = nextRank
    ? Math.min(100, (totalVisitas / nextRank.min_cortes) * 100)
    : 100;

  return (
    <>
      <View style={styles.rankCard}>
        <View style={styles.rankCardLeft}>
          <RankBadge rank={currentRank} size="lg" />
        </View>
        <View style={styles.rankCardRight}>
          <Text style={styles.rankKicker}>— tu rango —</Text>
          <Text style={styles.rankName}>{currentRank.rank_name}</Text>
          <Text style={styles.rankDesc}>{currentRank.description}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{totalVisitas}</Text>
          <Text style={styles.statLbl}>VISITAS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats?.totalReseñas ?? 0}</Text>
          <Text style={styles.statLbl}>RESEÑAS</Text>
        </View>
      </View>

      {nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Próximo: {nextRank.rank_name} {nextRank.badge_emoji}</Text>
            <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[colors.champagneDim, colors.champagne]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressSub}>
            {totalVisitas} / {nextRank.min_cortes} visitas
          </Text>
        </View>
      )}

      <View style={styles.ranksRoadmap}>
        <Text style={styles.sectionTitle}>Camino al éxito</Text>
        {CLIENT_RANKS.map((rank) => {
          const active = rank.rank_level === currentRank.rank_level;
          const passed = rank.rank_level < currentRank.rank_level;
          return (
            <View key={rank.rank_level} style={[styles.rankRow, active && styles.rankRowActive]}>
              <Text style={[styles.rankRowEmoji, (passed || active) ? {} : { opacity: 0.3 }]}>
                {rank.badge_emoji}
              </Text>
              <View style={styles.rankRowInfo}>
                <Text style={[styles.rankRowName, active && { color: colors.champagne }]}>
                  {rank.rank_name}
                </Text>
                <Text style={styles.rankRowReq}>{rank.min_cortes} visitas</Text>
              </View>
              {active && <Text style={styles.rankCurrent}>ACTUAL</Text>}
              {passed && <Text style={styles.rankPassed}>✓</Text>}
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 18, paddingBottom: 48, paddingTop: 14, gap: 20 },

  screenKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.champagne,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Rank card
  rankCard: {
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.dark2,
    padding: 18,
    alignItems: 'center',
    ...shadows.sm,
  },
  rankCardLeft: {},
  rankCardRight: { flex: 1, gap: 4 },
  rankKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
  },
  rankName: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.paper,
    lineHeight: 34,
  },
  rankDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark2,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 12 },
  statVal: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.champagne,
    lineHeight: 32,
  },
  statLbl: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: colors.muted,
    marginTop: 2,
  },

  // Progress
  progressSection: { gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.paper,
  },
  progressPct: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.champagne,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  progressSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
  },

  // Roadmap
  ranksRoadmap: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.paper,
    marginBottom: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark2,
  },
  rankRowActive: {
    borderColor: colors.champagne,
    backgroundColor: colors.champagneGlow,
  },
  rankRowEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  rankRowInfo: { flex: 1 },
  rankRowName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.paper,
  },
  rankRowReq: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
    letterSpacing: 1,
  },
  rankCurrent: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: colors.champagne,
    borderWidth: 1,
    borderColor: colors.champagne,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankPassed: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.champagneDim,
  },

  // Achievements
  achSection: { gap: 10 },
  sectionSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    marginTop: -4,
    marginBottom: 4,
  },
  achCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.dark2,
    padding: 14,
  },
  achCardLocked: {
    borderColor: colors.border,
    backgroundColor: colors.ink2,
  },
  achIcon: {
    width: 52,
    height: 52,
    borderWidth: 1,
    backgroundColor: colors.dark3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achEmoji: { fontSize: 26 },
  achInfo: { flex: 1, gap: 3 },
  achName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.paper,
  },
  achNameLocked: { color: colors.muted },
  achDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  achRarity: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  achCheck: {
    width: 28,
    height: 28,
    backgroundColor: colors.champagneSoft,
    borderWidth: 1,
    borderColor: colors.champagne,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achCheckText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.champagne,
  },

  // Modal
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    ...shadows.md,
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseTxt: { color: colors.muted, fontSize: 16 },
  modalEmoji: { fontSize: 56, marginBottom: 4 },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.paper,
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalRarity: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
  },
  modalPoints: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.champagne,
  },
  modalEarnedBadge: {
    borderWidth: 1,
    borderColor: colors.champagne,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  modalEarnedText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.champagne,
  },
  modalLockedText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
