import { Platform, View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Hero / galería: bucle, mute, sin controles.
 * useVideoPlayer must always be called (Rules of Hooks) — we pass null when
 * there is no URI and skip rendering VideoView instead.
 */
export default function LoopMutedVideo({ uri, style, contentFit = 'cover' }) {
  const trimmed = typeof uri === 'string' ? uri.trim() : '';

  const player = useVideoPlayer(trimmed || null, (p) => {
    if (!trimmed) return;
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  if (!trimmed) return null;

  return (
    <View style={style} collapsable={false} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit={contentFit}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' } : {})}
      />
    </View>
  );
}
