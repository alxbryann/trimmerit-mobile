import { Video, ResizeMode } from 'expo-av';

/**
 * Video en bucle, silenciado, sin controles (hero / galería).
 * Usa expo-av (mismo runtime que el resto del proyecto) para evitar fallos si el binario
 * no incluye el módulo nativo de expo-video.
 */
export default function LoopMutedVideo({ uri, style, contentFit = 'cover' }) {
  if (!uri) return null;
  const resizeMode =
    contentFit === 'contain' ? ResizeMode.CONTAIN : ResizeMode.COVER;
  return (
    <Video
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      isLooping
      shouldPlay
      isMuted
      useNativeControls={false}
    />
  );
}
