import { useCallback, useEffect, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { fonts, radii, shadows } from '../theme';
import { useColors } from '../theme/ThemeContext';

const TABS = ['Mi Panel', 'Colaboradores', 'Ajustes'];
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

export default function AdminBarberiaScreen({ navigation }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    safe: { flex: 1 },
    center: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 20, paddingBottom: 48 },
  
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    logo: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 2, color: colors.white },
    logoA: { color: colors.acid },
    signOutBtn: { paddingVertical: 4, paddingHorizontal: 8 },
    signOutTxt: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.grayMid },
  
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    barberiaName: { fontFamily: fonts.display, fontSize: 38, color: colors.white, flex: 1, letterSpacing: 1 },
    activaBadge: { backgroundColor: colors.acid, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
    activaTxt: { fontFamily: fonts.display, fontSize: 11, color: colors.black, letterSpacing: 1 },
  
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.cardBorder, paddingHorizontal: 20 },
    tabItem: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
    tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.acid },
    tabTxt: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5, color: colors.grayMid },
    tabTxtActive: { color: colors.acid },
  
    inviteCard: {
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.lg,
      padding: 20,
      marginBottom: 16,
      ...shadows.sm,
    },
    inviteCardActive: { borderColor: colors.acid, ...shadows.acid },
    inviteLabel: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2, color: colors.grayLight, marginBottom: 14 },
  
    codeDisplay: {
      fontFamily: fonts.display,
      fontSize: 64,
      color: colors.acid,
      letterSpacing: 12,
      textAlign: 'center',
      marginBottom: 14,
    },
    timerRow: {
      height: 3,
      backgroundColor: colors.gray,
      borderRadius: 2,
      marginBottom: 6,
      overflow: 'hidden',
    },
    timerBar: { height: 3, backgroundColor: colors.acid, borderRadius: 2 },
    timerTxt: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.grayMid, letterSpacing: 1, marginBottom: 14, textAlign: 'center' },
  
    noCodeTxt: { fontFamily: fonts.body, fontSize: 14, color: colors.grayMid, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
    generateBtn: {
      backgroundColor: colors.acid,
      borderRadius: radii.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
      ...shadows.acid,
    },
    generateTxt: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 3, color: colors.black },
  
    inviteBtns: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    outlineBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.dark3,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: radii.sm,
    },
    outlineTxt: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.5, color: colors.white },
    inviteHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grayMid, textAlign: 'center', marginTop: 4 },
  
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    statCard: {
      flex: 1,
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      padding: 14,
      alignItems: 'center',
    },
    statVal: { fontFamily: fonts.display, fontSize: 32, color: colors.white, letterSpacing: 1 },
    statLabel: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 2, color: colors.grayMid, marginTop: 2 },
  
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    sectionNum: { fontFamily: fonts.display, fontSize: 14, color: colors.acid, letterSpacing: 1 },
    sectionTitle: { fontFamily: fonts.display, fontSize: 14, letterSpacing: 2, color: colors.grayLight },
  
    emptyState: {
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.lg,
      padding: 32,
      alignItems: 'center',
    },
    emptyIcon: { fontSize: 32, color: colors.grayMid, marginBottom: 12 },
    emptyTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.grayMid, textAlign: 'center', lineHeight: 22 },
  
    barberoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.md,
      padding: 14,
      marginBottom: 8,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.acid },
    barberoName: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
    barberoBadge: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 2, color: colors.grayMid, marginTop: 2 },
  
    eliminarBtn: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radii.sm,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    eliminarTxt: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.danger },
  
    horarioCard: {
      backgroundColor: colors.dark2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.lg,
      padding: 20,
      marginBottom: 16,
    },
    horarioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    horarioLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.grayMid, marginBottom: 8 },
    horarioDivider: { width: 1, height: 48, backgroundColor: colors.cardBorder, marginHorizontal: 16 },
    timeBtn: {
      backgroundColor: colors.dark3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.sm,
      paddingVertical: 10,
      alignItems: 'center',
    },
    timeTxt: { fontFamily: fonts.display, fontSize: 28, color: colors.acid, letterSpacing: 2 },
  
    pickerOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: colors.dark2,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingBottom: 40,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    pickerTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.white, letterSpacing: 1 },
    pickerDone: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.acid, letterSpacing: 1.5 },
  
    wheelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ITEM_H * 5,
      paddingHorizontal: 20,
    },
    wheelList: { width: 100, height: ITEM_H * 5 },
    wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
    wheelTxt: { fontFamily: fonts.display, fontSize: 32, color: colors.grayMid, letterSpacing: 2 },
    wheelTxtActive: { color: colors.acid, fontSize: 40 },
    wheelColon: { fontFamily: fonts.display, fontSize: 40, color: colors.acid, marginHorizontal: 8 },
    wheelHighlight: {
      position: 'absolute',
      top: '50%',
      left: 20,
      right: 20,
      height: ITEM_H,
      marginTop: -ITEM_H / 2,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.sm,
    },
  });

  const [loading, setLoading] = useState(true);
  const [barberia, setBarberia] = useState(null);
  const [barberos, setBarberos] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [code, setCode] = useState(null);
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [copied, setCopied] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [horario, setHorario] = useState({ apertura: '09:00', cierre: '20:00' });
  const [horarioLoading, setHorarioLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(null); // 'apertura' | 'cierre'
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);

  const firstLocalFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        if (firstLocalFocus.current) {
          setLoading(true);
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigation.replace('Login'); return; }
        const { data: b } = await supabase
          .from('barberias')
          .select('*')
          .eq('admin_id', user.id)
          .maybeSingle();
        if (!b) { navigation.replace('CrearBarberia'); return; }
        if (!cancelled) {
          setBarberia(b);
          if (b.hora_apertura || b.hora_cierre) {
            setHorario({
              apertura: b.hora_apertura ?? '09:00',
              cierre: b.hora_cierre ?? '20:00',
            });
          }
        }

        if (b.invite_code && b.invite_code_expires_at) {
          const expiry = new Date(b.invite_code_expires_at);
          if (expiry > new Date()) {
            if (!cancelled) { setCode(b.invite_code); setCodeExpiry(expiry); }
          } else if (!cancelled) {
            setCode(null);
            setCodeExpiry(null);
          }
        } else if (!cancelled) {
          setCode(null);
          setCodeExpiry(null);
        }

        const { data: barberRows } = await supabase
          .from('barberos')
          .select('id, slug, barberia_id')
          .eq('barberia_id', b.id);
        const colaboradorRows = (barberRows ?? []).filter((row) => row.id !== user.id);
        const ids = colaboradorRows.map((r) => r.id);
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nombre, role')
            .in('id', ids);
          const merged = colaboradorRows.map((row) => {
            const p = (profiles ?? []).find((pr) => pr.id === row.id) ?? {};
            return { ...row, nombre: p.nombre ?? 'Colaborador', role: p.role };
          });
          if (!cancelled) setBarberos(merged);
        } else {
          if (!cancelled) setBarberos([]);
        }
        firstLocalFocus.current = false;
        if (!cancelled) setLoading(false);
      }
      load();
      return () => { cancelled = true; };
    }, [navigation])
  );

  // Countdown timer
  useEffect(() => {
    if (!codeExpiry) { setSecondsLeft(0); return; }
    function tick() {
      const diff = Math.max(0, Math.round((codeExpiry - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) { setCode(null); setCodeExpiry(null); }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [codeExpiry]);

  async function handleGenerateCode() {
    if (!barberia) return;
    setCodeLoading(true);
    const newCode = generateCode();
    const expiry = new Date(Date.now() + CODE_TTL_MS);
    const { error } = await supabase
      .from('barberias')
      .update({ invite_code: newCode, invite_code_expires_at: expiry.toISOString() })
      .eq('id', barberia.id);
    setCodeLoading(false);
    if (!error) { setCode(newCode); setCodeExpiry(expiry); }
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!code) return;
    await Share.share({
      message: `Únete a ${barberia.nombre} en Trimmerit 💈\nUsa el código: ${code}\n(válido por 5 minutos)`,
    });
  }

  async function handleEliminarBarbero(barbero) {
    Alert.alert(
      'Eliminar colaborador',
      `¿Eliminar a ${barbero.nombre} de tu equipo en Trimmerit?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('barberos')
              .delete()
              .eq('id', barbero.id);
            if (!error) {
              setBarberos((prev) => prev.filter((b) => b.id !== barbero.id));
            } else {
              Alert.alert('Error', 'No se pudo eliminar al colaborador.');
            }
          },
        },
      ]
    );
  }

  function openPicker(field) {
    const [h, m] = horario[field].split(':').map(Number);
    setPickerHour(h);
    setPickerMinute(m);
    setShowPicker(field);
  }

  function confirmPicker() {
    const time = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    setHorario((prev) => ({ ...prev, [showPicker]: time }));
    setShowPicker(null);
  }

  async function handleGuardarHorario() {
    if (!barberia) return;
    setHorarioLoading(true);
    const { error } = await supabase
      .from('barberias')
      .update({ hora_apertura: horario.apertura, hora_cierre: horario.cierre })
      .eq('id', barberia.id);
    setHorarioLoading(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el horario.');
    } else {
      Alert.alert('Guardado', 'Horario actualizado correctamente.');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const codeActive = code && secondsLeft > 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        <View style={styles.header}>
          <Text style={styles.logo}>TRIMMER<Text style={styles.logoA}>IT</Text></Text>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutTxt}>CERRAR SESIÓN</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroRow}>
          <Text style={styles.barberiaName} numberOfLines={1}>{barberia?.nombre}</Text>
          <View style={styles.activaBadge}>
            <Text style={styles.activaTxt}>ACTIVA</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} style={[styles.tabItem, activeTab === i && styles.tabItemActive]} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabTxt, activeTab === i && styles.tabTxtActive]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {activeTab === 0 && (
            <>
              {/* Invite code card */}
              <View style={[styles.inviteCard, codeActive && styles.inviteCardActive]}>
                <Text style={styles.inviteLabel}>CÓDIGO DE INVITACIÓN</Text>

                {codeActive ? (
                  <>
                    <Text style={styles.codeDisplay}>{code}</Text>
                    <View style={styles.timerRow}>
                      <View style={[styles.timerBar, { width: `${(secondsLeft / 300) * 100}%` }]} />
                    </View>
                    <Text style={styles.timerTxt}>Expira en {mins}:{secs}</Text>
                    <View style={styles.inviteBtns}>
                      <TouchableOpacity style={styles.outlineBtn} onPress={handleCopy} activeOpacity={0.8}>
                        <Text style={styles.outlineTxt}>{copied ? '✓ COPIADO' : 'COPIAR'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.outlineBtn} onPress={handleShare} activeOpacity={0.8}>
                        <Text style={styles.outlineTxt}>COMPARTIR</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.noCodeTxt}>Genera un código para que{'\n'}tus colaboradores puedan unirse.</Text>
                    <TouchableOpacity
                      style={[styles.generateBtn, codeLoading && { opacity: 0.55 }]}
                      onPress={handleGenerateCode}
                      disabled={codeLoading}
                      activeOpacity={0.88}
                    >
                      {codeLoading
                        ? <ActivityIndicator color={colors.black} />
                        : <Text style={styles.generateTxt}>GENERAR CÓDIGO</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}
                <Text style={styles.inviteHint}>El código dura 5 minutos y es de un solo uso por colaborador</Text>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                {[
                  { label: 'HOY', val: '0' },
                  { label: 'SEMANA', val: '0' },
                  { label: 'TOTAL', val: '0' },
                ].map((s) => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={styles.statVal}>{s.val}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <BarberosSection styles={styles} barberos={barberos} onEliminar={handleEliminarBarbero} />
            </>
          )}

          {activeTab === 1 && <BarberosSection styles={styles} barberos={barberos} onEliminar={handleEliminarBarbero} />}

          {activeTab === 2 && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNum}>⏰</Text>
                <Text style={styles.sectionTitle}>HORARIO DEL LOCAL</Text>
              </View>
              <View style={styles.horarioCard}>
                <View style={styles.horarioRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horarioLabel}>APERTURA</Text>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => openPicker('apertura')} activeOpacity={0.8}>
                      <Text style={styles.timeTxt}>{horario.apertura}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.horarioDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horarioLabel}>CIERRE</Text>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => openPicker('cierre')} activeOpacity={0.8}>
                      <Text style={styles.timeTxt}>{horario.cierre}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.generateBtn, horarioLoading && { opacity: 0.55 }]}
                  onPress={handleGuardarHorario}
                  disabled={horarioLoading}
                  activeOpacity={0.88}
                >
                  {horarioLoading
                    ? <ActivityIndicator color={colors.black} />
                    : <Text style={styles.generateTxt}>GUARDAR HORARIO</Text>
                  }
                </TouchableOpacity>
              </View>

            </View>
          )}

        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!showPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {showPicker === 'apertura' ? 'Hora de apertura' : 'Hora de cierre'}
              </Text>
              <TouchableOpacity onPress={confirmPicker}>
                <Text style={styles.pickerDone}>LISTO</Text>
              </TouchableOpacity>
            </View>
            <WheelTimePicker
              styles={styles}
              hour={pickerHour}
              minute={pickerMinute}
              onHourChange={setPickerHour}
              onMinuteChange={setPickerMinute}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ITEM_H = 52;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function WheelTimePicker({ styles, hour, minute, onHourChange, onMinuteChange }) {
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      hourRef.current?.scrollToIndex({ index: hour, animated: false });
      minRef.current?.scrollToIndex({ index: MINUTES.indexOf(minute), animated: false });
    }, 50);
  }, []);

  function onHourScroll(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, 23));
    onHourChange(HOURS[clamped]);
  }

  function onMinuteScroll(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, MINUTES.length - 1));
    onMinuteChange(MINUTES[clamped]);
  }

  const renderHour = ({ item }) => (
    <View style={styles.wheelItem}>
      <Text style={[styles.wheelTxt, item === hour && styles.wheelTxtActive]}>
        {String(item).padStart(2, '0')}
      </Text>
    </View>
  );

  const renderMinute = ({ item }) => (
    <View style={styles.wheelItem}>
      <Text style={[styles.wheelTxt, item === minute && styles.wheelTxtActive]}>
        {String(item).padStart(2, '0')}
      </Text>
    </View>
  );

  return (
    <View style={styles.wheelContainer}>
      <View style={styles.wheelHighlight} pointerEvents="none" />
      <FlatList
        ref={hourRef}
        data={HOURS}
        keyExtractor={(i) => String(i)}
        renderItem={renderHour}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onHourScroll}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={styles.wheelList}
      />
      <Text style={styles.wheelColon}>:</Text>
      <FlatList
        ref={minRef}
        data={MINUTES}
        keyExtractor={(i) => String(i)}
        renderItem={renderMinute}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMinuteScroll}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={styles.wheelList}
      />
    </View>
  );
}

function BarberosSection({ styles, barberos, onEliminar }) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionNum}>{String(barberos.length).padStart(2, '0')}</Text>
        <Text style={styles.sectionTitle}>MIS COLABORADORES</Text>
      </View>
      {barberos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✂</Text>
          <Text style={styles.emptyTxt}>Aún no tienes colaboradores.{'\n'}Genera un código e invítalos.</Text>
        </View>
      ) : (
        barberos.map((b) => (
          <View key={b.id} style={styles.barberoCard}>
            <View style={styles.statusDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.barberoName}>{b.nombre}</Text>
              <Text style={styles.barberoBadge}>COLABORADOR TRIMMERIT</Text>
            </View>
            <TouchableOpacity style={styles.eliminarBtn} onPress={() => onEliminar(b)} activeOpacity={0.75}>
              <Text style={styles.eliminarTxt}>ELIMINAR</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

