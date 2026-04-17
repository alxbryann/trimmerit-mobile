import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import LoopMutedVideo from '../components/LoopMutedVideo';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, radii } from '../theme';
import { SERVICE_ICON_OPTIONS, ServiceIonicon, resolveServiceIonicon } from '../utils/serviceIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

function normalizeServicioIcon(s) {
  return { ...s, icono: resolveServiceIonicon(s.icono) };
}

function Section({ n, label }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionNum}>{n}</Text>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function EditarScreen({ navigation, route }) {
  const slug = route.params?.slug;
  const [barberoId, setBarberoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [nombreBarberia, setNombreBarberia] = useState('');
  const [bio, setBio] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [servicios, setServicios] = useState([]);
  const [galeria, setGaleria] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingGaleria, setUploadingGaleria] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.replace('Login');
        return;
      }
      const { data: barbero, error } = await supabase
        .from('barberos')
        .select('id, slug, bio, especialidades, video_url, nombre_barberia, profiles(nombre)')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !barbero) {
        setAuthError(true);
        setLoading(false);
        return;
      }
      if (barbero.slug !== slug) {
        navigation.setParams({ slug: barbero.slug });
        return;
      }

      setBarberoId(barbero.id);
      setNombre(barbero.profiles?.nombre ?? '');
      setNombreBarberia(barbero.nombre_barberia?.trim() ?? '');
      setBio(barbero.bio ?? '');
      setEspecialidades((barbero.especialidades ?? []).join(', '));
      setVideoUrl(barbero.video_url ?? '');

      const { data: svcs } = await supabase
        .from('servicios')
        .select('*')
        .eq('barbero_id', barbero.id)
        .eq('activo', true);

      if (svcs?.length) {
        setServicios(svcs.map(normalizeServicioIcon));
      } else {
        setServicios([
          { nombre: 'CORTE CLÁSICO', precio: 40000, duracion_min: 45, icono: 'cut-outline', activo: true, isNew: true },
          { nombre: 'BARBA', precio: 30000, duracion_min: 30, icono: 'brush-outline', activo: true, isNew: true },
          { nombre: 'COMBO FULL', precio: 65000, duracion_min: 75, icono: 'layers-outline', activo: true, isNew: true },
        ]);
      }

      const { data: gal } = await supabase
        .from('galeria_cortes')
        .select('id, imagen_url, tipo, descripcion')
        .eq('barbero_id', barbero.id)
        .order('created_at', { ascending: false });
      if (gal) setGaleria(gal);

      setLoading(false);
    })();
  }, [slug, navigation]);

  async function pickHeroVideo() {
    if (!barberoId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso', 'Necesitamos acceso a la galería para el video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const ext = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
    const path = `${barberoId}/hero.${ext}`;
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const { error } = await supabase.storage
        .from('barberos-media')
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? 'video/mp4' });
      if (!error) {
        const { data } = supabase.storage.from('barberos-media').getPublicUrl(path);
        setVideoUrl(data.publicUrl);
      }
    } catch (e) {
      console.warn(e);
    }
    setUploading(false);
  }

  async function pickGaleria() {
    if (!barberoId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploadingGaleria(true);
    for (const asset of result.assets) {
      const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
      const path = `${barberoId}/galeria/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const tipo = asset.type === 'video' ? 'video' : 'imagen';
      try {
        const blob = await (await fetch(asset.uri)).blob();
        const { error } = await supabase.storage.from('barberos-media').upload(path, blob, {
          contentType: asset.mimeType ?? (tipo === 'video' ? 'video/mp4' : 'image/jpeg'),
        });
        if (!error) {
          const { data: pub } = supabase.storage.from('barberos-media').getPublicUrl(path);
          const { data: row } = await supabase
            .from('galeria_cortes')
            .insert({ barbero_id: barberoId, imagen_url: pub.publicUrl, tipo })
            .select('id, imagen_url, tipo, descripcion')
            .single();
          if (row) setGaleria((prev) => [row, ...prev]);
        }
      } catch (e) {
        console.warn(e);
      }
    }
    setUploadingGaleria(false);
  }

  async function deleteFoto(id, url) {
    await supabase.from('galeria_cortes').delete().eq('id', id);
    const match = url.match(/barberos-media\/(.+)$/);
    if (match) await supabase.storage.from('barberos-media').remove([match[1]]);
    setGaleria((prev) => prev.filter((f) => f.id !== id));
  }

  function addServicio() {
    setServicios((prev) => [
      ...prev,
      {
        nombre: 'NUEVO SERVICIO',
        precio: 30000,
        duracion_min: 30,
        icono: 'cut-outline',
        activo: true,
        isNew: true,
      },
    ]);
  }

  function removeServicio(idx) {
    setServicios((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateServicio(idx, key, value) {
    setServicios((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  }

  async function handleSave() {
    if (!barberoId) return;
    setSaving(true);
    const espArray = especialidades
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await supabase
      .from('barberos')
      .update({
        bio,
        especialidades: espArray,
        video_url: videoUrl || null,
        nombre_barberia: nombreBarberia.trim() || null,
      })
      .eq('id', barberoId);

    await supabase.from('profiles').update({ nombre }).eq('id', barberoId);

    for (const svc of servicios) {
      if (svc.isNew || !svc.id) {
        await supabase.from('servicios').insert({
          barbero_id: barberoId,
          nombre: svc.nombre,
          precio: svc.precio,
          duracion_min: svc.duracion_min,
          icono: svc.icono,
          activo: true,
        });
      } else {
        await supabase.from('servicios').update({
          nombre: svc.nombre,
          precio: svc.precio,
          duracion_min: svc.duracion_min,
          icono: svc.icono,
        }).eq('id', svc.id);
      }
    }

    const { data: svcsReload } = await supabase
      .from('servicios')
      .select('*')
      .eq('barbero_id', barberoId)
      .eq('activo', true);
    if (svcsReload?.length) setServicios(svcsReload.map(normalizeServicioIcon));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.acid} size="large" />
        <Text style={styles.loadTxt}>CARGANDO...</Text>
      </View>
    );
  }

  if (authError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errTitle}>SIN ACCESO</Text>
        <Text style={styles.muted}>Este perfil no te pertenece.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.sticky}>
        <View style={styles.stickyActions}>
          <TouchableOpacity
            style={[styles.previewBtn, !slug && styles.previewBtnOff]}
            onPress={() => slug && navigation.navigate('BarberProfile', { slug, previewFromEdit: true })}
            disabled={!slug}
            activeOpacity={0.85}
          >
            <Text style={styles.previewTxt}>VISTA PREVIA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.save, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            <Text style={styles.saveTxt}>{saving ? 'GUARDANDO...' : saved ? 'GUARDADO ✓' : 'GUARDAR'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!videoUrl ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>COMPLETA TU PERFIL</Text>
            <Text style={styles.bannerBody}>
              Sube tu video hero, define servicios y galería para que te encuentren.
            </Text>
          </View>
        ) : null}

        <Section n="01" label="INFO BÁSICA" />
        <Field label="NOMBRE COMPLETO" value={nombre} onChangeText={setNombre} />
        <Field label="NOMBRE DE LA BARBERÍA" value={nombreBarberia} onChangeText={setNombreBarberia} />
        <Field label="BIO (opcional)" value={bio} onChangeText={setBio} multiline />
        <Field
          label="ESPECIALIDADES (coma)"
          value={especialidades}
          onChangeText={setEspecialidades}
        />

        <Section n="02" label="VIDEO HERO" />
        {videoUrl ? (
          <View style={styles.videoBox}>
            <LoopMutedVideo uri={videoUrl} style={styles.video} contentFit="cover" />
            <TouchableOpacity style={styles.changeVid} onPress={pickHeroVideo} disabled={uploading}>
              <Text style={styles.changeVidTxt}>{uploading ? 'SUBIENDO...' : 'CAMBIAR'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={pickHeroVideo} disabled={uploading}>
            <Text style={styles.uploadTitle}>{uploading ? 'SUBIENDO...' : 'SUBIR VIDEO HERO'}</Text>
            <Text style={styles.uploadHint}>MP4 · aparece en tu perfil</Text>
          </TouchableOpacity>
        )}

        <Section n="03" label="MIS SERVICIOS" />
        {servicios.map((svc, idx) => (
          <View key={idx} style={styles.svcCard}>
            <View style={styles.svcRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPick}>
                {SERVICE_ICON_OPTIONS.map(({ value, hint }) => {
                  const selected = svc.icono === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.iconChip,
                        selected && { borderColor: colors.acid, backgroundColor: colors.black },
                      ]}
                      onPress={() => updateServicio(idx, 'icono', value)}
                      accessibilityLabel={hint}
                    >
                      <ServiceIonicon
                        name={value}
                        size={22}
                        color={selected ? colors.acid : colors.grayLight}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <TextInput
              style={styles.svcNombre}
              value={svc.nombre}
              onChangeText={(v) => updateServicio(idx, 'nombre', v.toUpperCase())}
            />
            <View style={styles.svcRow2}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                style={styles.svcPrecio}
                keyboardType="number-pad"
                value={String(svc.precio)}
                onChangeText={(v) => updateServicio(idx, 'precio', Number(v.replace(/\D/g, '') || 0))}
              />
              <TextInput
                style={styles.svcDur}
                keyboardType="number-pad"
                value={String(svc.duracion_min)}
                onChangeText={(v) =>
                  updateServicio(idx, 'duracion_min', Number(v.replace(/\D/g, '') || 0))
                }
              />
              <Text style={styles.minLbl}>min</Text>
              <TouchableOpacity style={styles.trash} onPress={() => removeServicio(idx)}>
                <Text style={styles.trashTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addSvc} onPress={addServicio}>
          <Text style={styles.addSvcTxt}>+ AGREGAR SERVICIO</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
        <Section n="04" label="GALERÍA" />
        <View style={styles.galGrid}>
          {galeria.map((foto) => (
            <View key={foto.id} style={styles.galCell}>
              {foto.tipo === 'video' ? (
                <LoopMutedVideo uri={foto.imagen_url} style={styles.galImg} contentFit="cover" />
              ) : (
                <Image source={{ uri: foto.imagen_url }} style={styles.galImg} />
              )}
              <TouchableOpacity style={styles.galDel} onPress={() => deleteFoto(foto.id, foto.imagen_url)}>
                <Text style={styles.galDelTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.galUpload}
          onPress={pickGaleria}
          disabled={uploadingGaleria}
        >
          <Text style={styles.galUploadTxt}>
            {uploadingGaleria ? 'SUBIENDO...' : 'AÑADIR FOTOS / VIDEOS'}
          </Text>
        </TouchableOpacity>

        {/* ── SECCIÓN 05: FIDELIZACIÓN ── */}
        <Section n="05" label="FIDELIZACIÓN" />
        <TouchableOpacity
          style={styles.loyaltyBtn}
          onPress={() => navigation.navigate('LoyaltyConfig')}
        >
          <View style={styles.loyaltyBtnLeft}>
            <Ionicons name="ribbon" size={20} color={colors.acid} />
            <View>
              <Text style={styles.loyaltyBtnTitle}>Programa de puntos</Text>
              <Text style={styles.loyaltyBtnSubtitle}>
                Configurá sellos, beneficios y canje de premios
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.grayMid} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, multiline }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={colors.grayMid}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadTxt: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 3,
    color: colors.acid,
    marginTop: 12,
  },
  errTitle: { fontFamily: fonts.display, fontSize: 36, color: colors.white, marginBottom: 8 },
  muted: { fontFamily: fonts.body, color: colors.grayLight },
  sticky: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
    backgroundColor: 'rgba(8,8,8,0.97)',
  },
  stickyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  previewBtn: {
    borderWidth: 1,
    borderColor: colors.acid,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  previewBtnOff: { opacity: 0.4, borderColor: colors.gray },
  previewTxt: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.acid,
    letterSpacing: 2,
  },
  save: { backgroundColor: colors.acid, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
  saveTxt: { fontFamily: fonts.display, fontSize: 14, color: colors.black, letterSpacing: 2 },
  scroll: { padding: 20, paddingBottom: 48, maxWidth: 720, alignSelf: 'center', width: '100%' },
  banner: {
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.2)',
    backgroundColor: 'rgba(205,255,0,0.06)',
    padding: 16,
    marginBottom: 24,
  },
  bannerTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.acid,
    marginBottom: 6,
    letterSpacing: 1,
  },
  bannerBody: { fontFamily: fonts.body, fontSize: 13, color: colors.grayLight, lineHeight: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 8 },
  sectionNum: { fontFamily: fonts.display, fontSize: 12, color: colors.acid, opacity: 0.8 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white, flex: 1 },
  lbl: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.grayLight,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  videoBox: { height: 200, marginBottom: 16, position: 'relative' },
  video: { width: '100%', height: '100%' },
  changeVid: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: colors.acid,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeVidTxt: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.acid, letterSpacing: 1 },
  uploadBox: {
    height: 160,
    borderWidth: 2,
    borderColor: colors.gray,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 1 },
  uploadHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grayLight, marginTop: 8 },
  svcCard: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.dark2,
    padding: 12,
    marginBottom: 10,
  },
  svcRow: { marginBottom: 8 },
  iconPick: { flexGrow: 0 },
  iconChip: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  svcNombre: {
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.black,
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 16,
    padding: 8,
    marginBottom: 8,
  },
  svcRow2: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dollar: { color: colors.grayLight, fontFamily: fonts.body },
  svcPrecio: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.black,
    color: colors.white,
    fontFamily: fonts.body,
    padding: 8,
  },
  svcDur: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.black,
    color: colors.grayLight,
    fontFamily: fonts.body,
    padding: 8,
    textAlign: 'center',
  },
  minLbl: { fontFamily: fonts.body, fontSize: 11, color: colors.grayLight },
  trash: {
    borderWidth: 1,
    borderColor: colors.gray,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trashTxt: { color: colors.danger, fontSize: 14 },
  addSvc: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray,
    padding: 14,
    alignItems: 'center',
  },
  addSvcTxt: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2, color: colors.grayLight },
  galGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  galCell: { width: '31%', aspectRatio: 1, position: 'relative' },
  galImg: { width: '100%', height: '100%' },
  galDel: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galDelTxt: { color: colors.danger, fontSize: 12 },
  galUpload: {
    borderWidth: 2,
    borderColor: colors.gray,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  galUploadTxt: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2, color: colors.grayLight },
  loyaltyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: 16,
  },
  loyaltyBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  loyaltyBtnTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  loyaltyBtnSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.grayLight,
    marginTop: 1,
  },
});
