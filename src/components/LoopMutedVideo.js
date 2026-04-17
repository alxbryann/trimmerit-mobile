import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Video en bucle, silenciado, sin controles (hero / galería).
 * Cada instancia tiene su propio reproductor (correcto para listas).
 */
function LoopMutedVideoInner({ uri, style, contentFit = 'cover' }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
    />
  );
}

export default function LoopMutedVideo({ uri, style, contentFit }) {
  if (!uri) return null;
  return <LoopMutedVideoInner uri={uri} style={style} contentFit={contentFit} />;
}
