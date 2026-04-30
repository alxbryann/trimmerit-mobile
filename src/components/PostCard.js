/**
 * PostCard — Tarjeta de publicación para el feed social
 *
 * Features:
 *  - Cabecera: monograma + nombre barbero + barbería + tiempo ago
 *  - Texto con estilo (align, bold, size)
 *  - Carrusel de imágenes con indicador de dots
 *  - Video en bucle mudo (LoopMutedVideo)
 *  - 4 reacciones emoji: 🔥 fuego, ✂️ tijeras, ⭐ estrella, ❤️ corazón
 *  - Comentarios (2 recientes + "ver todos" expandible + input para comentar)
 *
 * Props:
 *  post               : objeto publicacion (con barberos, _reacciones, _mis_reacciones, _comentarios)
 *  currentUserId      : string — para saber cuáles reacciones son mías
 *  onToggleReaccion   : (postId, tipo) => void
 *  onAddComentario    : (postId, texto) => void
 */

import { useState, useRef, useMemo } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import LoopMutedVideo from './LoopMutedVideo';
import { fonts } from '../theme';
import { useColors } from '../theme/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const IMG_H = Math.round(SCREEN_W * 1.1);   // ~ cuadrada/vertical editorial

const REACCIONES = [
  { tipo: 'fuego',    emoji: '🔥', label: 'fuego'    },
  { tipo: 'tijeras',  emoji: '✂️', label: 'tijeras'  },
  { tipo: 'estrella', emoji: '⭐', label: 'estrella' },
  { tipo: 'corazon',  emoji: '❤️', label: 'corazón'  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'ahora';
  if (mins  < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days  < 7)  return `hace ${days}d`;
  return new Date(isoStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function initials(nombre = '') {
  return nombre.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Componente Carrusel ───────────────────────────────────────────────────────
function ImageCarousel({ urls, styles }) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef(null);

  function onScroll(e) {
    const x    = e.nativeEvent.contentOffset.x;
    const page = Math.round(x / SCREEN_W);
    setIdx(page);
  }

  if (!urls?.length) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {urls.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={[styles.carouselImg, { width: SCREEN_W }]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Dots indicator */}
      {urls.length > 1 && (
        <View style={styles.dotsRow}>
          {urls.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === idx && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Counter (top-right) */}
      {urls.length > 1 && (
        <View style={styles.counterBadge}>
          <Text style={styles.counterTxt}>{idx + 1}/{urls.length}</Text>
        </View>
      )}
    </View>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PostCard({
  post,
  currentUserId,
  onToggleReaccion,
  onAddComentario,
}) {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.ink,
          marginBottom: 0,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        },
        avatar: {
          width: 40,
          height: 40,
          backgroundColor: colors.ink3,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarTxt: {
          fontFamily: fonts.display,
          fontStyle: 'italic',
          fontSize: 18,
          color: colors.champagne,
          lineHeight: 22,
        },
        headerMeta: { flex: 1 },
        barberoName: {
          fontFamily: fonts.bodyBold,
          fontSize: 14,
          color: colors.paper,
        },
        barberiaName: {
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: colors.muted,
          marginTop: 1,
          textTransform: 'uppercase',
        },
        captionWrap: {
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        caption: {
          lineHeight: 20,
          color: colors.paper,
        },
        carouselImg: {
          height: IMG_H,
        },
        dotsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 5,
          paddingVertical: 8,
        },
        dot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.muted2,
        },
        dotActive: {
          width: 14,
          backgroundColor: colors.champagne,
        },
        counterBadge: {
          position: 'absolute',
          top: 12,
          right: 12,
          backgroundColor: 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        counterTxt: {
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: '#f2efe7',
        },
        videoWrap: {
          height: Math.round(SCREEN_W * 0.85),
          position: 'relative',
        },
        video: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.ink2,
        },
        videoBadge: {
          position: 'absolute',
          bottom: 10,
          left: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        videoBadgeTxt: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 2,
          color: colors.champagne,
        },
        reaccionesRow: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        reaBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: 'transparent',
        },
        reaBtnActive: {
          borderColor: colors.champagne,
          backgroundColor: colors.champagneGlow,
        },
        reaEmoji: {
          fontSize: 15,
          lineHeight: 19,
        },
        reaCount: {
          fontFamily: fonts.mono,
          fontSize: 11,
          color: colors.muted,
        },
        reaCountActive: {
          color: colors.champagne,
        },
        comentariosSection: {
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        verTodosBtn: {
          paddingVertical: 4,
          marginBottom: 6,
        },
        verTodosTxt: {
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: colors.muted,
          textTransform: 'lowercase',
        },
        comentario: {
          marginBottom: 6,
        },
        comAutor: {
          fontFamily: fonts.bodyBold,
          fontSize: 12,
          color: colors.paper,
        },
        comBadge: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 1,
          color: colors.champagne,
          textTransform: 'uppercase',
        },
        comTxt: {
          fontFamily: fonts.body,
          fontSize: 13,
          color: colors.paperDim,
          lineHeight: 18,
        },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
        },
        comInput: {
          flex: 1,
          fontFamily: fonts.body,
          fontSize: 13,
          color: colors.paper,
          paddingVertical: 6,
        },
        sendBtn: {
          padding: 2,
        },
        sendBtnDisabled: {
          opacity: 0.5,
        },
      }),
    [colors]
  );

  const [comentariosExpanded, setComentariosExpanded] = useState(false);
  const [inputTxt, setInputTxt]  = useState('');
  const [enviando, setEnviando]  = useState(false);

  // Reacciones locales optimistas
  const [localReacciones, setLocalReacciones]   = useState(post._reacciones ?? {});
  const [localMias, setLocalMias]               = useState(post._mis_reacciones ?? []);

  // Comentarios locales (se agregan al estado local al enviar)
  const [localComsTail, setLocalComsTail] = useState([]);

  const todasComs = [
    ...(post._comentarios ?? []),
    ...localComsTail,
  ];

  const visibleComs = comentariosExpanded ? todasComs : todasComs.slice(-2);

  async function handleReaccion(tipo) {
    const yaEsta = localMias.includes(tipo);
    // Optimistic update
    setLocalMias((prev) =>
      yaEsta ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
    setLocalReacciones((prev) => ({
      ...prev,
      [tipo]: Math.max(0, (prev[tipo] ?? 0) + (yaEsta ? -1 : 1)),
    }));
    onToggleReaccion?.(post.id, tipo);
  }

  async function handleEnviarComentario() {
    const txt = inputTxt.trim();
    if (!txt || enviando) return;

    setEnviando(true);
    const tempCom = {
      id: `temp-${Date.now()}`,
      pub_id: post.id,
      autor_id: currentUserId,
      texto: txt,
      created_at: new Date().toISOString(),
      profiles: { nombre: 'Tú', role: 'cliente' },
    };
    setInputTxt('');
    await onAddComentario?.(post.id, txt);
    setLocalComsTail((prev) => [...prev, tempCom]);
    setEnviando(false);
  }

  const barberoNombre  = post.barberos?.profiles?.nombre ?? '—';
  const barberiaNombre = post.barberos?.nombre_barberia  ?? '—';
  const ts             = timeAgo(post.created_at);
  const ini            = initials(barberoNombre);

  // Text style
  const ts_style = post.text_style ?? {};
  const textAlign = ts_style.align === 'center' ? 'center' : 'left';
  const fontFamily = ts_style.bold ? fonts.bodyBold : fonts.body;
  const fontSize   = ts_style.size === 'large' ? 18 : 14;

  return (
    <View style={styles.card}>
      {/* ── Cabecera ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{ini}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.barberoName}>{barberoNombre}</Text>
          <Text style={styles.barberiaName}>{barberiaNombre} · {ts}</Text>
        </View>
      </View>

      {/* ── Caption ──────────────────────────────────────────────────────────── */}
      {!!post.caption && (
        <View style={styles.captionWrap}>
          <Text style={[styles.caption, { textAlign, fontFamily, fontSize }]}>
            {post.caption}
          </Text>
        </View>
      )}

      {/* ── Media: imágenes ──────────────────────────────────────────────────── */}
      {post.media_urls?.length > 0 && (
        <ImageCarousel urls={post.media_urls} styles={styles} />
      )}

      {/* ── Media: video ─────────────────────────────────────────────────────── */}
      {!!post.video_url && !post.media_urls?.length && (
        <View style={styles.videoWrap}>
          <LoopMutedVideo uri={post.video_url} style={styles.video} contentFit="cover" />
          <View style={styles.videoBadge}>
            <Ionicons name="play-circle" size={14} color={colors.champagne} />
            <Text style={styles.videoBadgeTxt}>VIDEO</Text>
          </View>
        </View>
      )}

      {/* ── Reacciones ───────────────────────────────────────────────────────── */}
      <View style={styles.reaccionesRow}>
        {REACCIONES.map(({ tipo, emoji }) => {
          const activa = localMias.includes(tipo);
          const count  = localReacciones[tipo] ?? 0;
          return (
            <TouchableOpacity
              key={tipo}
              style={[styles.reaBtn, activa && styles.reaBtnActive]}
              onPress={() => handleReaccion(tipo)}
              activeOpacity={0.75}
            >
              <Text style={styles.reaEmoji}>{emoji}</Text>
              {count > 0 && (
                <Text style={[styles.reaCount, activa && styles.reaCountActive]}>
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Comentarios ──────────────────────────────────────────────────────── */}
      <View style={styles.comentariosSection}>
        {/* Toggle ver todos */}
        {(post._comentarios_count + localComsTail.length) > 2 && !comentariosExpanded && (
          <TouchableOpacity
            onPress={() => setComentariosExpanded(true)}
            style={styles.verTodosBtn}
          >
            <Text style={styles.verTodosTxt}>
              ver los {post._comentarios_count + localComsTail.length} comentarios
            </Text>
          </TouchableOpacity>
        )}

        {visibleComs.map((com) => (
          <View key={com.id} style={styles.comentario}>
            <Text style={styles.comAutor}>
              {com.profiles?.nombre ?? 'Usuario'}
              {com.profiles?.role === 'barbero' ? (
                <Text style={styles.comBadge}> · barbero</Text>
              ) : null}
            </Text>
            <Text style={styles.comTxt}>{com.texto}</Text>
          </View>
        ))}

        {/* Input comentario */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.comInput}
            value={inputTxt}
            onChangeText={setInputTxt}
            placeholder="Agregar comentario…"
            placeholderTextColor={colors.muted2}
            returnKeyType="send"
            onSubmitEditing={handleEnviarComentario}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputTxt.trim() || enviando) && styles.sendBtnDisabled]}
            onPress={handleEnviarComentario}
            disabled={!inputTxt.trim() || enviando}
          >
            {enviando
              ? <ActivityIndicator size="small" color={colors.champagne} />
              : <Ionicons name="arrow-up-circle" size={24} color={inputTxt.trim() ? colors.champagne : colors.muted2} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

