import { View } from 'react-native';
import Svg, { Polyline, Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useColors } from '../../theme/ThemeContext';

/**
 * Sparkline minimalista con relleno bajo la línea.
 * @param {{ data: number[], width?: number, height?: number }} props
 */
export default function Sparkline({ data, width = 280, height = 56 }) {
  const colors = useColors();
  const points = buildPoints(data, width, height);
  if (points.length === 0) {
    return <View style={{ width, height }} />;
  }
  const polyline = points.map((p) => p.join(',')).join(' ');
  const polygon = `0,${height} ${polyline} ${width},${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.acid} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.acid} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={polygon} fill="url(#sparkFill)" />
      <Polyline
        points={polyline}
        stroke={colors.acid}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function buildPoints(data, width, height) {
  if (!data || data.length === 0) return [];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(max - min, 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  return data.map((v, i) => {
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return [Math.round(i * stepX), Math.round(y)];
  });
}
