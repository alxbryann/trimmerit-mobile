/**
 * FeedBarberoScreen — Feed social para barberos
 *
 * Secciones:
 *  1. Feed de publicaciones (PostCard) — todos los barberos
 *  2. Botón "NUEVA PUBLICACIÓN" fijo arriba del feed
 *  3. Modal compositor — texto + formato + imágenes (carrusel) + video
 *
 * OWASP:
 *  A01 — barbero_id/autor_id siempre desde auth.getUser(), nunca de params
 *  A09 — logs solo en __DEV__
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  StyleSheet, ActivityIndicator, ScrollView, Image, Platform,
  KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { fetchFeedPosts } from '../api/feed';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { uploadToS3, validateFile } from '../lib/s3Upload';
import { fonts } from '../theme';
import { useColors, useTheme } from '../theme/ThemeContext';
import PostCard from '../components/PostCard';

const THUMB = 88;

// ── Helpers de duración de video ──────────────────────────────────────────────
const MAX_VIDEO_S = 10;

const FALLBACK_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

function extensionForAsset(asset, mimeType) {
  const match = asset.uri?.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  return match?.[1]?.toLowerCase() ?? FALLBACK_EXT_BY_MIME[mimeType] ?? 'jpg';
}

function createS3Path(userId, folder, asset, mimeType) {
  const ext = extensionForAsset(asset, mimeType).replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function FeedBarberoScreen({ navigation }) {
  const colors = useColors();
  const { mode } = useTheme();
  const onChampagne = mode === 'light' ? colors.paper : colors.ink;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.ink },
        safe: { flex: 1 },

        headerGrad: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        headerKicker: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: colors.champagne,
          marginBottom: 2,
        },
        headerTitle: {
          fontFamily: fonts.display,
          fontStyle: 'italic',
          fontSize: 36,
          lineHeight: 38,
          color: colors.paper,
          letterSpacing: -1,
        },
        nuevaBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.champagne,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        nuevaBtnTxt: {
          fontFamily: fonts.display,
          fontSize: 12,
          letterSpacing: 1.5,
          color: onChampagne,
        },

        center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        emptyList: { flex: 1 },
        emptyWrap: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
          paddingTop: 80,
          gap: 8,
        },
        emptyIcon: { fontSize: 28, color: colors.muted2, marginBottom: 4 },
        emptyTitle: {
          fontFamily: fonts.display,
          fontStyle: 'italic',
          fontSize: 22,
          color: colors.muted,
          letterSpacing: -0.5,
        },
        emptyHint: {
          fontFamily: fonts.body,
          fontSize: 13,
          color: colors.muted2,
          textAlign: 'center',
        },
        emptyBtn: { marginTop: 8 },
        emptyBtnTxt: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.champagne },

        composerRoot: { flex: 1, backgroundColor: colors.ink },
        composerSafe: { flex: 1 },
        composerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        composerCancel: { padding: 4 },
        composerCancelTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
        composerTitle: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 3,
          color: colors.champagne,
          textTransform: 'uppercase',
        },
        composerPostBtn: {
          backgroundColor: colors.champagne,
          paddingHorizontal: 14,
          paddingVertical: 8,
          minWidth: 80,
          alignItems: 'center',
        },
        composerPostBtnDis: { opacity: 0.4 },
        composerPostTxt: {
          fontFamily: fonts.display,
          fontSize: 12,
          letterSpacing: 1.5,
          color: onChampagne,
        },
        composerScroll: { flex: 1 },

        composerInput: {
          fontFamily: fonts.body,
          fontSize: 15,
          color: colors.paper,
          lineHeight: 22,
          padding: 20,
          minHeight: 140,
          textAlignVertical: 'top',
        },
        composerInputBold: { fontFamily: fonts.bodyBold },
        composerInputLarge: { fontSize: 20, lineHeight: 28 },

        fmtToolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
        fmtLabel: {
          fontFamily: fonts.mono,
          fontSize: 8,
          letterSpacing: 2,
          color: colors.muted2,
          textTransform: 'uppercase',
        },
        fmtBtns: { flexDirection: 'row', gap: 8 },
        fmtBtn: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: 'transparent',
        },
        fmtBtnActive: {
          backgroundColor: colors.champagne,
          borderColor: colors.champagne,
        },
        fmtBtnTxt: {
          fontFamily: fonts.bodyBold,
          fontSize: 14,
          color: colors.muted,
        },
        fmtBtnTxtActive: { color: onChampagne },

        mediaSelectorRow: {
          flexDirection: 'row',
          gap: 0,
          marginHorizontal: 20,
          marginVertical: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        mediaTypeBtn: { flex: 1 },
        mediaTypeBtnInner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRightWidth: 0.5,
          borderRightColor: colors.border,
        },
        mediaTypeBtnActive: {
          backgroundColor: colors.champagne,
        },
        mediaTypeTxt: {
          fontFamily: fonts.bodyBold,
          fontSize: 10,
          letterSpacing: 1,
          color: colors.champagne,
          textTransform: 'uppercase',
        },
        mediaTypeTxtActive: { color: onChampagne },
        mediaTypeHint: {
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 0.5,
          color: colors.muted,
          marginTop: 1,
        },

        thumbScroll: { marginHorizontal: 20, marginBottom: 16 },
        thumbScrollContent: { gap: 8, paddingRight: 8 },
        thumbWrap: {
          width: THUMB,
          height: THUMB,
          position: 'relative',
        },
        thumb: {
          width: THUMB,
          height: THUMB,
          backgroundColor: colors.ink3,
        },
        videoOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
        videoDurTxt: {
          fontFamily: fonts.mono,
          fontSize: 9,
          color: colors.paper,
          letterSpacing: 1,
        },
        removeThumb: {
          position: 'absolute',
          top: 4,
          right: 4,
        },

        previewBox: {
          marginHorizontal: 20,
          marginTop: 4,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
          padding: 14,
          gap: 6,
        },
        previewLabel: {
          fontFamily: fonts.mono,
          fontSize: 8,
          letterSpacing: 2,
          color: colors.muted2,
          textTransform: 'uppercase',
        },
        previewTxt: {
          fontFamily: fonts.body,
          fontSize: 14,
          color: colors.paper,
          lineHeight: 20,
        },
      }),
    [colors, onChampagne]
  );

  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [barberoId, setBarberoId]   = useState(null);

  // ── Estado del compositor ──
  const [composerOpen, setComposerOpen]   = useState(false);
  const [caption, setCaption]             = useState('');
  const [textStyle, setTextStyle]         = useState({ align: 'left', bold: false, size: 'normal' });
  const [mediaItems, setMediaItems]       = useState([]);  // {type:'image'|'video', uri, duration?}
  const [publishing, setPublishing]       = useState(false);

  // ── Carga del feed ─────────────────────────────────────────────────────────
  async function loadFeed(silent = false) {
    if (!supabaseConfigured) { setLoading(false); return; }
    if (!silent) setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setRefreshing(false); return; }

      setCurrentUserId(user.id);

      // Obtener barbero_id del usuario actual
      const { data: barbero } = await supabase
        .from('barberos')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      setBarberoId(barbero?.id ?? user.id);

      const feedPosts = await fetchFeedPosts(supabase, user.id);
      setPosts(feedPosts);
    } catch (e) {
      if (__DEV__) console.warn('[FeedBarbero] Error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadFeed(); }, []));

  // ── Reacción ───────────────────────────────────────────────────────────────
  async function handleToggleReaccion(postId, tipo) {
    const { data, error } = await supabase.rpc('toggle_reaccion', { p_pub_id: postId, p_tipo: tipo });
    if (error) throw new Error(error.message);
    if (data?.ok === false) throw new Error(data.reason ?? 'No se pudo guardar la reacción');
    // No recargar el feed completo — la UI ya actualizó optimistamente en PostCard
  }

  // ── Comentario ─────────────────────────────────────────────────────────────
  async function handleAddComentario(postId, texto) {
    if (!currentUserId) return;
    const { error } = await supabase.from('pub_comentarios').insert({
      pub_id:   postId,
      autor_id: currentUserId,
      texto,
    });
    if (error) throw new Error(error.message);
  }

  // ── Selector de imágenes (multi) ────────────────────────────────────────────
  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });
    if (!result.canceled) {
      const newItems = result.assets.map((a) => ({
        type: 'image',
        uri: a.uri,
        mimeType: a.mimeType ?? 'image/jpeg',
        fileSize: a.fileSize,
      }));
      // Reemplazar cualquier video existente al elegir imágenes
      setMediaItems((prev) => [
        ...prev.filter((m) => m.type === 'image'),
        ...newItems,
      ].slice(0, 6));
    }
  }

  // ── Selector de video ──────────────────────────────────────────────────────
  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: MAX_VIDEO_S,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const durationS = asset.duration ? Math.round(asset.duration / 1000) : null;
      if (durationS && durationS > MAX_VIDEO_S) {
        Alert.alert(
          'Video muy largo',
          `El video tiene ${durationS}s. El límite es ${MAX_VIDEO_S}s. Elegí otro o recortalo primero.`
        );
        return;
      }
      // Reemplazar imágenes al elegir video
      setMediaItems([{
        type: 'video',
        uri: asset.uri,
        duration: durationS,
        mimeType: asset.mimeType ?? 'video/mp4',
        fileSize: asset.fileSize,
      }]);
    }
  }

  function removeMedia(idx) {
    setMediaItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Publicar ───────────────────────────────────────────────────────────────
  async function handlePublicar() {
    if (!caption.trim() && !mediaItems.length) {
      Alert.alert('Contenido vacío', 'Escribe algo o adjunta una imagen/video.');
      return;
    }
    setPublishing(true);

    try {
      const hasVideo  = mediaItems.some((m) => m.type === 'video');
      const images    = mediaItems.filter((m) => m.type === 'image');
      const video     = mediaItems.find((m) => m.type === 'video');

      if ((images.length || video) && !currentUserId) {
        throw new Error('No hay sesión activa. Vuelve a iniciar sesión.');
      }

      const media_urls = [];
      for (const image of images) {
        const mimeType = image.mimeType ?? 'image/jpeg';
        const check = validateFile(mimeType, image.fileSize);
        if (!check.ok) throw new Error(check.error);

        const path = createS3Path(currentUserId, 'publicaciones', image, mimeType);
        const publicUrl = await uploadToS3(image.uri, path, mimeType, image.fileSize);
        media_urls.push(publicUrl);
      }

      let video_url = null;
      if (video) {
        const mimeType = video.mimeType ?? 'video/mp4';
        const check = validateFile(mimeType, video.fileSize);
        if (!check.ok) throw new Error(check.error);

        const path = createS3Path(currentUserId, 'publicaciones', video, mimeType);
        video_url = await uploadToS3(video.uri, path, mimeType, video.fileSize);
      }

      const tipo = hasVideo ? 'video' : images.length ? 'imagen' : 'texto';

      const payload = {
        barbero_id:  barberoId,
        tipo,
        caption:     caption.trim() || null,
        text_style:  textStyle,
        media_urls,
        video_url,
        activo:      true,
      };

      const { error } = await supabase.from('publicaciones').insert(payload);
      if (error) throw new Error(error.message);

      // Reset compositor
      setCaption('');
      setTextStyle({ align: 'left', bold: false, size: 'normal' });
      setMediaItems([]);
      setComposerOpen(false);

      // Recargar feed
      await loadFeed(true);
    } catch (e) {
      if (__DEV__) console.warn('[FeedBarbero] Error publicando:', e?.message);
      Alert.alert('Error', 'No se pudo publicar. Intenta de nuevo.');
    } finally {
      setPublishing(false);
    }
  }

  function resetComposer() {
    setCaption('');
    setTextStyle({ align: 'left', bold: false, size: 'normal' });
    setMediaItems([]);
    setComposerOpen(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <LinearGradient colors={[colors.ink2, colors.ink]} style={styles.headerGrad}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerKicker}>— trimmerit™ —</Text>
              <Text style={styles.headerTitle}>feed</Text>
            </View>
            {/* CTA nueva publicación */}
            <TouchableOpacity
              style={styles.nuevaBtn}
              onPress={() => setComposerOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={onChampagne} />
              <Text style={styles.nuevaBtnTxt}>PUBLICAR</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Feed ───────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.champagne} />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={currentUserId}
                onToggleReaccion={handleToggleReaccion}
                onAddComentario={handleAddComentario}
              />
            )}
            onRefresh={() => { setRefreshing(true); loadFeed(true); }}
            refreshing={refreshing}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>✧</Text>
                <Text style={styles.emptyTitle}>sin publicaciones</Text>
                <Text style={styles.emptyHint}>Sé el primero en compartir tu trabajo.</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => setComposerOpen(true)}
                >
                  <Text style={styles.emptyBtnTxt}>crear primera publicación →</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
          />
        )}
      </SafeAreaView>

      {/* ── Modal Compositor ──────────────────────────────────────────────── */}
      <Modal
        visible={composerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetComposer}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.composerRoot}
        >
          <SafeAreaView style={styles.composerSafe} edges={['top', 'bottom']}>
            {/* Barra superior */}
            <View style={styles.composerHeader}>
              <TouchableOpacity onPress={resetComposer} style={styles.composerCancel}>
                <Text style={styles.composerCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.composerTitle}>NUEVA PUBLICACIÓN</Text>
              <TouchableOpacity
                style={[styles.composerPostBtn, (!caption.trim() && !mediaItems.length) && styles.composerPostBtnDis]}
                onPress={handlePublicar}
                disabled={publishing || (!caption.trim() && !mediaItems.length)}
              >
                {publishing
                  ? <ActivityIndicator size="small" color={onChampagne} />
                  : <Text style={styles.composerPostTxt}>PUBLICAR</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.composerScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Área de texto ─────────────────────────────────────── */}
              <TextInput
                style={[
                  styles.composerInput,
                  { textAlign: textStyle.align },
                  textStyle.bold && styles.composerInputBold,
                  textStyle.size === 'large' && styles.composerInputLarge,
                ]}
                value={caption}
                onChangeText={setCaption}
                multiline
                placeholder="¿Qué hay de nuevo en tu local?"
                placeholderTextColor={colors.muted2}
                maxLength={800}
                autoFocus
              />

              {/* ── Toolbar de formato ────────────────────────────────── */}
              <View style={styles.fmtToolbar}>
                <Text style={styles.fmtLabel}>FORMATO</Text>
                <View style={styles.fmtBtns}>
                  {/* Bold */}
                  <TouchableOpacity
                    style={[styles.fmtBtn, textStyle.bold && styles.fmtBtnActive]}
                    onPress={() => setTextStyle((s) => ({ ...s, bold: !s.bold }))}
                  >
                    <Text style={[styles.fmtBtnTxt, textStyle.bold && styles.fmtBtnTxtActive]}>B</Text>
                  </TouchableOpacity>
                  {/* Align center */}
                  <TouchableOpacity
                    style={[styles.fmtBtn, textStyle.align === 'center' && styles.fmtBtnActive]}
                    onPress={() => setTextStyle((s) => ({ ...s, align: s.align === 'center' ? 'left' : 'center' }))}
                  >
                    <Ionicons
                      name="reorder-three"
                      size={16}
                      color={textStyle.align === 'center' ? onChampagne : colors.muted}
                    />
                  </TouchableOpacity>
                  {/* Large text */}
                  <TouchableOpacity
                    style={[styles.fmtBtn, textStyle.size === 'large' && styles.fmtBtnActive]}
                    onPress={() => setTextStyle((s) => ({ ...s, size: s.size === 'large' ? 'normal' : 'large' }))}
                  >
                    <Text style={[styles.fmtBtnTxt, textStyle.size === 'large' && styles.fmtBtnTxtActive, { fontSize: 13 }]}>Aa</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Selector de media ─────────────────────────────────── */}
              <View style={styles.mediaSelectorRow}>
                <TouchableOpacity
                  style={styles.mediaTypeBtn}
                  onPress={pickImages}
                  disabled={mediaItems.some((m) => m.type === 'video')}
                >
                  <View style={[
                    styles.mediaTypeBtnInner,
                    mediaItems.some((m) => m.type === 'image') && styles.mediaTypeBtnActive,
                  ]}>
                    <Ionicons name="images" size={20} color={
                      mediaItems.some((m) => m.type === 'video')
                        ? colors.muted2
                        : mediaItems.some((m) => m.type === 'image')
                          ? onChampagne
                          : colors.champagne
                    } />
                    <Text style={[
                      styles.mediaTypeTxt,
                      mediaItems.some((m) => m.type === 'image') && styles.mediaTypeTxtActive,
                      mediaItems.some((m) => m.type === 'video') && { color: colors.muted2 },
                    ]}>
                      IMÁGENES{mediaItems.filter((m) => m.type === 'image').length > 0
                        ? ` (${mediaItems.filter((m) => m.type === 'image').length})`
                        : ''}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mediaTypeBtn}
                  onPress={pickVideo}
                  disabled={mediaItems.some((m) => m.type === 'image')}
                >
                  <View style={[
                    styles.mediaTypeBtnInner,
                    mediaItems.some((m) => m.type === 'video') && styles.mediaTypeBtnActive,
                  ]}>
                    <Ionicons name="videocam" size={20} color={
                      mediaItems.some((m) => m.type === 'image')
                        ? colors.muted2
                        : mediaItems.some((m) => m.type === 'video')
                          ? onChampagne
                          : colors.champagne
                    } />
                    <View>
                      <Text style={[
                        styles.mediaTypeTxt,
                        mediaItems.some((m) => m.type === 'video') && styles.mediaTypeTxtActive,
                        mediaItems.some((m) => m.type === 'image') && { color: colors.muted2 },
                      ]}>VIDEO</Text>
                      <Text style={[styles.mediaTypeHint,
                        mediaItems.some((m) => m.type === 'image') && { color: colors.muted2 }
                      ]}>
                        máx. {MAX_VIDEO_S}s
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── Preview de media seleccionada ─────────────────────── */}
              {mediaItems.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbScroll}
                  contentContainerStyle={styles.thumbScrollContent}
                >
                  {mediaItems.map((item, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                      {item.type === 'video' && (
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play" size={18} color={colors.paper} />
                          {item.duration && (
                            <Text style={styles.videoDurTxt}>{item.duration}s</Text>
                          )}
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeThumb}
                        onPress={() => removeMedia(i)}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.paper} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* ── Vista previa del caption con estilo ──────────────── */}
              {!!caption.trim() && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>VISTA PREVIA</Text>
                  <Text style={[
                    styles.previewTxt,
                    { textAlign: textStyle.align },
                    textStyle.bold && { fontFamily: fonts.bodyBold },
                    textStyle.size === 'large' && { fontSize: 18, lineHeight: 24 },
                  ]}>
                    {caption}
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

