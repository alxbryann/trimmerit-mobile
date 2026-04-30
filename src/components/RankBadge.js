import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

const RANK_COLORS = {
  1: '#8a7454',
  2: '#c8a96a',
  3: '#b85e4c',
  4: '#6d7a5a',
  5: '#c8a96a',
};

export default function RankBadge({ rank, size = 'md' }) {
  if (!rank) return null;

  const dim = size === 'sm' ? 44 : size === 'lg' ? 80 : 60;
  const emojiFontSize = size === 'sm' ? 20 : size === 'lg' ? 36 : 28;
  const nameFontSize = size === 'sm' ? 8 : size === 'lg' ? 11 : 9;
  const accent = RANK_COLORS[rank.rank_level] ?? colors.champagne;

  return (
    <View style={[styles.badge, { width: dim, height: dim, borderColor: accent }]}>
      <Text style={{ fontSize: emojiFontSize, lineHeight: emojiFontSize + 4 }}>
        {rank.badge_emoji}
      </Text>
      <Text style={[styles.name, { fontSize: nameFontSize, color: accent }]}>
        {rank.rank_name?.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    backgroundColor: colors.dark2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  name: {
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
