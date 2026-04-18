import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMutedVideo from '../components/LoopMutedVideo';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors, fonts, radii, shadows } from '../theme';
import {
  DEFAULT_SERVICES,
  TIMES_MORNING,
  TIMES_AFTERNOON,
  TIMES_EVENING,
  getDays,
  getBogotaClock,
  heroNameLines,
  fmtPrice,
  isUuidString,
} from '../utils/booking';
import { ServiceIonicon, resolveServiceIonicon } from '../utils/serviceIcons';
import { notifyReservation } from '../api/notify';
import { sendPushNotification } from '../lib/notifications';

const { width: W } = Dimensions.get('window');

export default function BarberProfileScreen({ navigation, route }) {
  const slug = route.params?.slug;
  const previewFromEdit = route.params?.previewFromEdit === true;
  const [barbero, setBarbero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [galeria, setGaleria] = useState([]);

  const [days] = useState(() => getDays());
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reservaLoading, setReservaLoading] = useState(false);

  const [pendingReseña, setPendingReseña] = useState(null);
  const [ratingSelected, setRatingSelected] = useState(0);
  const [ratingComentario, setRatingComentario] = useState('');
  const [ratingSending, setRatingSending] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const loadBarbero = useCallback(async () => {
    if (!slug || !supabaseConfigured) { setLoading(false); return; }
    let { data, error } = await supabase
      .from('barberos')
      .select('id, slug, especialidades, rating, total_cortes, bio, video_url, nombre_barberia, profiles(nombre)')
      .eq('slug', slug)
      .maybeSingle();
    if (error) console.warn('[barbero]', error);
    if (!data) {
      await new Promise((r) => setTimeout(r, 600));
      const retry = await supabase
        .from('barberos')
        .select('id, slug, especialidades, rating, total_cortes, bio, video_url, nombre_barberia, profiles(nombre)')
        .eq('slug', slug)
        .maybeSingle();
      data = retry.data;
    }
    if (!data) { setLoading(false); return; }

    supabase.from('servicios').select('*').eq('barbero_id', data.id).eq('activo', true)
      .then(({ data: svcs }) => {
        if (svcs?.length) {
          setServices(
            svcs.map((s) => ({
              id: s.id,
              label: s.nombre,
              price: s.precio,
              duration: `${s.duracion_min} min`,
              icon: resolveServiceIonicon(s.icono),
            })),
          );
        }
      });

    setBarbero({
      id: data.id, slug: data.slug,
      nombre: data.profiles?.nombre ?? slug,
      nombre_barberia: data.nombre_barberia ?? null,
      especialidades: data.especialidades ?? [],
      rating: data.rating ?? 5,
      total_cortes: data.total_cortes ?? 0,
      desde_año: new Date().getFullYear(),
      bio: data.bio, video_url: data.video_url,
    });

    supabase.from('galeria_cortes').select('id, imagen_url, tipo').eq('barbero_id', data.id)
      .order('created_at', { ascending: false })
      .then(({ data: gal }) => { if (gal) setGaleria(gal); });

    setLoading(false);
  }, [slug]);

  useEffect(() => { loadBarbero(); }, [loadBarbero]);

  useEffect(() => {
    // Verificar sesión activa al montar (cubre el caso en que ya hay sesión iniciada)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
      }
    });

    // Escuchar cambios futuros de auth (login desde este screen, logout, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        AsyncStorage.getItem(`reserva_draft_${slug}`).then((draft) => {
          if (!draft) return;
          try {
            const { selectedService: s, selectedDay: d, selectedTime: t } = JSON.parse(draft);
            if (s) setSelectedService(s);
            if (d != null) setSelectedDay(d);
            if (t) setSelectedTime(t);
          } catch {}
          AsyncStorage.removeItem(`reserva_draft_${slug}`);
        });
      } else { setUser(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [slug]);

  const barberoId = barbero?.id ?? null;

  useEffect(() => {
    if (!user || !barberoId) return;
    async function check() {
      const { data: reservasComp } = await supabase.from('reservas').select('id')
        .eq('cliente_id', user.id).eq('barbero_id', barberoId).eq('estado', 'completada');
      if (!reservasComp?.length) return;
      const ids = reservasComp.map((r) => r.id);
      const { data: reseñasExist } = await supabase.from('reseñas').select('reserva_id').in('reserva_id', ids);
      const reseñadas = new Set((reseñasExist ?? []).map((r) => r.reserva_id));
      const sinReseña = ids.find((id) => !reseñadas.has(id));
      if (sinReseña) setPendingReseña({ reservaId: sinReseña });
    }
    check();
  }, [user, barberoId]);

  async function handleEnviarReseña() {
    if (!user || !barbero || !pendingReseña || ratingSelected === 0) return;
    setRatingSending(true);
    await supabase.from('reseñas').insert({ reserva_id: pendingReseña.reservaId, cliente_id: user.id, barbero_id: barbero.id, estrellas: ratingSelected, comentario: ratingComentario.trim() || null });
    const { data: updated } = await supabase.from('barberos').select('rating, total_cortes').eq('id', barbero.id).single();
    if (updated) setBarbero((prev) => prev ? { ...prev, rating: updated.rating, total_cortes: updated.total_cortes } : prev);
    setRatingSending(false);
    setRatingDone(true);
    setTimeout(() => { setPendingReseña(null); setRatingDone(false); setRatingSelected(0); setRatingComentario(''); }, 2000);
  }

  const service = services.find((s) => s.id === selectedService);
  const day = days[selectedDay] ?? null;

  async function handleConfirmar() {
    if (!selectedService || selectedDay == null || !selectedTime || !barbero) return;
    if (!user) {
      await AsyncStorage.setItem(`reserva_draft_${slug}`, JSON.stringify({ selectedService, selectedDay, selectedTime }));
      navigation.navigate('Login', { redirect: { screen: 'BarberProfile', params: { slug } } });
      return;
    }
    setReservaLoading(true);
    const d = days[selectedDay];
    const fecha = d.fullDate.toISOString().split('T')[0];
    const servicioIdDb = service?.id && isUuidString(service.id) ? service.id : null;
    const { error: insertError } = await supabase.from('reservas').insert({
      cliente_id: user.id, barbero_id: barbero.id, servicio_id: servicioIdDb,
      fecha, hora: selectedTime, precio: service?.price ?? null, estado: 'pendiente',
    });
    if (insertError) { console.warn(insertError); setReservaLoading(false); return; }

    try {
      const { data: barberoProfile } = await supabase
        .from('profiles')
        .select('push_token, nombre')
        .eq('id', barbero.id)
        .maybeSingle();
      if (barberoProfile?.push_token) {
        await sendPushNotification({
          to: barberoProfile.push_token,
          title: '💈 Nueva reserva',
          body: `${barberoProfile.nombre ?? 'Cliente'} reservó ${service?.label ?? selectedService} el ${fecha} a las ${selectedTime}`,
          data: { barberoId: barbero.id, fecha, hora: selectedTime },
        });
      }

      await notifyReservation({
        barberoId: barbero.id, barbero: barbero.nombre_barberia || barbero.nombre,
        servicio: service?.label ?? selectedService, fecha, hora: selectedTime,
        precio: service?.price ? service.price.toLocaleString('es-CO') : '—', cliente: user.email,
      });
    } catch (e) {
      console.warn('[reserva] post-insert:', e);
    } finally {
      setReservaLoading(false);
    }
    setConfirmed(true);
  }

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={colors.acid} />
        <Text style={styles.loadingText}>CARGANDO...</Text>
      </View>
    );
  }

  if (!barbero) {
    return (
      <SafeAreaView style={styles.centerFill}>
        <Text style={styles.hero404}>404</Text>
        <Text style={styles.hero404Sub}>BARBERO NO ENCONTRADO</Text>
        <Text style={styles.muted}>No encontramos este perfil</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'Catalogo' })}
          style={styles.backLink}
        >
          <Text style={styles.link}>← Volver al inicio</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const nombreBarberiaTrim = barbero.nombre_barberia?.trim() ?? '';
  const heroTitleSource = nombreBarberiaTrim || barbero.nombre;
  const { primary: heroPrimary, secondary: heroSecondary } = heroNameLines(heroTitleSource);

  if (confirmed) {
    return (
      <View style={styles.centerFill}>
        <View style={styles.confirmedCard}>
          <View style={styles.confirmedCheck}>
            <Text style={styles.confirmedCheckText}>✓</Text>
          </View>
          <Text style={styles.okTitle}>RESERVA{'\n'}CONFIRMADA</Text>
          <View style={styles.confirmedDetails}>
            <ConfirmRow icon="✂" label={service?.label ?? '—'} />
            <ConfirmRow icon="◉" label={barbero.nombre} />
            <ConfirmRow icon="◈" label={day ? `${day.day} ${day.label} ${day.month}` : '—'} />
            <ConfirmRow icon="⏰" label={selectedTime ?? '—'} />
            {service && <ConfirmRow icon="$" label={`$${fmtPrice(service.price)}`} accent />}
          </View>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => setConfirmed(false)}>
            <Text style={styles.ghostBtnText}>NUEVA RESERVA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwner = user && user.id === barbero.id;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={styles.hero}>
          {barbero.video_url ? (
            <LoopMutedVideo uri={barbero.video_url} style={styles.video} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#0f1208', '#0a0a0a', '#080808']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.video} />
          )}
          {/* Overlay gradient */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(8,8,8,0.95)']} locations={[0, 0.5, 1]} style={styles.heroGrad} />

          {/* Top controls */}
          <SafeAreaView edges={['top']} style={styles.heroTop}>
            <TouchableOpacity style={styles.backPill} onPress={() => navigation.goBack()}>
              <Text style={styles.backPillText}>← VOLVER</Text>
            </TouchableOpacity>
            {isOwner && !previewFromEdit && (
              <View style={styles.ownerRow}>
                <TouchableOpacity
                  style={styles.ownerGhost}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'MiAgenda', params: { slug } })}
                >
                  <Text style={styles.ownerGhostText}>PANEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ownerSolid}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'MiPerfil', params: { slug } })}
                >
                  <Text style={styles.ownerSolidText}>EDITAR</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>

          {/* Hero text */}
          <View style={styles.heroText}>
            <View style={styles.heroKickerRow}>
              <View style={styles.heroKickerDot} />
              <Text style={styles.kicker}>Barbero · Bogotá</Text>
            </View>
            <Text style={styles.heroName}>{heroPrimary}</Text>
            {heroSecondary ? <Text style={styles.heroNameAcid}>{heroSecondary}</Text> : null}
            {nombreBarberiaTrim ? <Text style={styles.personName}>{barbero.nombre}</Text> : null}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statVal}>{barbero.total_cortes > 0 ? `${barbero.total_cortes}+` : 'Nuevo'}</Text>
                <Text style={styles.statLbl}>CORTES</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statPill}>
                <Text style={styles.statVal}>★ {String(barbero.rating)}</Text>
                <Text style={styles.statLbl}>RATING</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statPill}>
                <Text style={styles.statVal}>{String(barbero.desde_año)}</Text>
                <Text style={styles.statLbl}>DESDE</Text>
              </View>
            </View>
          </View>

          {/* Acid line at bottom */}
          <View style={styles.acidLine} />
        </View>

        <View style={styles.body}>
          {/* Bio */}
          {barbero.bio ? (
            <View style={styles.bioCard}>
              <Text style={styles.bioText}>{barbero.bio}</Text>
            </View>
          ) : null}

          {/* Especialidades pills */}
          {barbero.especialidades?.length > 0 && (
            <View style={styles.specialtyRow}>
              {barbero.especialidades.map((e) => (
                <View key={e} style={styles.specialtyPill}>
                  <Text style={styles.specialtyText}>{e}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Galería */}
          {galeria.length > 0 && (
            <View style={styles.block}>
              <SectionHead n="✦" label="TRABAJOS" />
              <View style={styles.galGrid}>
                {galeria.map((foto) => (
                  <View key={foto.id} style={styles.galCell}>
                    {foto.tipo === 'video' ? (
                      <LoopMutedVideo uri={foto.imagen_url} style={styles.galImg} contentFit="cover" />
                    ) : (
                      <Image source={{ uri: foto.imagen_url }} style={styles.galImg} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* PASO 1: Servicios */}
          <Step n="01" label="ELIGE EL SERVICIO" />
          {services.map((s) => {
            const active = selectedService === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.svc, active && styles.svcOn]}
                onPress={() => { setSelectedService(s.id); setSelectedTime(null); }}
                activeOpacity={0.85}
              >
                <View style={[styles.svcIconWrap, active && styles.svcIconWrapOn]}>
                  <ServiceIonicon
                    name={s.icon}
                    size={20}
                    color={active ? colors.acid : colors.grayMid}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.svcLabel, active && styles.svcLabelOn]}>{s.label}</Text>
                  <Text style={[styles.svcDur, active && styles.svcDurOn]}>{s.duration}</Text>
                </View>
                <Text style={[styles.svcPrice, active && styles.svcPriceOn]}>${fmtPrice(s.price)}</Text>
                {active && <View style={styles.svcCheck}><Text style={styles.svcCheckText}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}

          {/* PASO 2: Día y hora */}
          <Step n="02" label="DÍA Y HORA" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {days.map((d, i) => {
              const active = selectedDay === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayChip, active && styles.dayChipOn]}
                  onPress={() => { setSelectedDay(i); setSelectedTime(null); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.dayNum, active && styles.dayNumOn]}>{d.label}</Text>
                  <Text style={[styles.dayWd, active && styles.dayWdOn]}>{d.day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {[
            { label: 'Mañana', times: TIMES_MORNING },
            { label: 'Tarde', times: TIMES_AFTERNOON },
            { label: 'Noche', times: TIMES_EVENING },
          ].map((group) => {
            const isToday = selectedDay === 0;
            const { hour: bh, minute: bm } = getBogotaClock();
            const available = isToday
              ? group.times.filter((t) => {
                  const [h, m] = t.split(':').map(Number);
                  return h * 60 + m > bh * 60 + bm;
                })
              : group.times;
            if (!available.length) return null;
            return (
              <View key={group.label} style={{ marginBottom: 14 }}>
                <Text style={styles.slotGrp}>{group.label}</Text>
                <View style={styles.slotWrap}>
                  {available.map((t) => {
                    const active = selectedTime === t;
                    return (
                      <TouchableOpacity key={t} style={[styles.slot, active && styles.slotOn]} onPress={() => setSelectedTime(t)} activeOpacity={0.8}>
                        <Text style={[styles.slotTxt, active && styles.slotTxtOn]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* PASO 3: Resumen */}
          <Step n="03" label="TU RESUMEN" />
          <View style={styles.summary}>
            <SummaryRow label="Barbero" value={barbero.nombre.toUpperCase()} />
            <View style={styles.sep} />
            <SummaryRow
              label="Fecha y hora"
              value={day && selectedTime ? `${day.day} ${day.label} ${day.month} · ${selectedTime}` : '—'}
              dim={!day || !selectedTime}
            />
            <View style={styles.sep} />
            <SummaryRow label="Servicio" value={service ? service.label : '—'} dim={!service} />
            <View style={styles.sep} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLbl}>TOTAL</Text>
              <Text style={[styles.totalVal, !service && { color: colors.grayMid }]}>
                {service ? `$${fmtPrice(service.price)}` : '—'}
              </Text>
            </View>
          </View>

          {!user && selectedService && selectedDay != null && selectedTime && (
            <View style={styles.loginHint}>
              <Text style={styles.loginHintText}>Debes iniciar sesión para confirmar tu reserva.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Iniciar sesión →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirm, (!selectedService || !selectedTime || reservaLoading) && styles.confirmOff]}
            disabled={!selectedService || !selectedTime || reservaLoading}
            onPress={handleConfirmar}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={(!selectedService || !selectedTime || reservaLoading) ? [colors.dark3, colors.dark3] : [colors.acid, colors.acidDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGrad}
            >
              <Text style={[styles.confirmText, (!selectedService || !selectedTime) && styles.confirmTextOff]}>
                {reservaLoading
                  ? 'RESERVANDO...'
                  : selectedService && selectedTime
                    ? user ? 'CONFIRMAR RESERVA →' : 'INICIA SESIÓN PARA RESERVAR'
                    : 'COMPLETA LOS PASOS'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de reseña */}
      <Modal visible={Boolean(pendingReseña)} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            {ratingDone ? (
              <View style={styles.modalDone}>
                <Text style={styles.modalDoneIcon}>★</Text>
                <Text style={styles.modalOk}>GRACIAS POR TU RESEÑA</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.modalClose} onPress={() => setPendingReseña(null)}>
                  <Text style={styles.modalCloseTxt}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalK}>¿QUÉ TAL EL CORTE?</Text>
                <Text style={styles.modalTitle}>
                  CALIFICA A{'\n'}
                  <Text style={{ color: colors.acid }}>{barbero.nombre.toUpperCase()}</Text>
                </Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRatingSelected(n)} activeOpacity={0.7}>
                      <Text style={[styles.star, n <= ratingSelected && styles.starOn]}>{n <= ratingSelected ? '★' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.ta}
                  placeholder="Comentario (opcional)..."
                  placeholderTextColor={colors.grayMid}
                  value={ratingComentario}
                  onChangeText={setRatingComentario}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.modalBtn, ratingSelected === 0 && styles.confirmOff]}
                  disabled={ratingSelected === 0 || ratingSending}
                  onPress={handleEnviarReseña}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={ratingSelected === 0 ? [colors.gray, colors.gray] : [colors.acid, colors.acidDim]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.modalBtnGrad}
                  >
                    <Text style={[styles.modalBtnTxt, ratingSelected === 0 && { color: colors.grayMid }]}>
                      {ratingSending ? 'ENVIANDO...' : 'ENVIAR RESEÑA'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Step({ n, label }) {
  return (
    <View style={styles.stepHead}>
      <View style={styles.stepNumWrap}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepTitle}>{label}</Text>
    </View>
  );
}

function SectionHead({ n, label }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionHeadIcon}>{n}</Text>
      <Text style={styles.sectionHeadLabel}>{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value, dim }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLbl}>{label}</Text>
      <Text style={[styles.summaryVal, dim && { color: colors.grayMid }]}>{value}</Text>
    </View>
  );
}

function ConfirmRow({ icon, label, accent }) {
  return (
    <View style={styles.confirmRowItem}>
      <Text style={styles.confirmRowIcon}>{icon}</Text>
      <Text style={[styles.confirmRowLabel, accent && { color: colors.acid, fontFamily: fonts.display, fontSize: 22 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  centerFill: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 4, color: colors.grayMid, marginTop: 12 },

  // 404
  hero404: { fontFamily: fonts.display, fontSize: 80, color: colors.acid, lineHeight: 88 },
  hero404Sub: { fontFamily: fonts.display, fontSize: 24, color: colors.white, marginBottom: 8, letterSpacing: 1 },
  muted: { fontFamily: fonts.body, color: colors.grayLight, marginBottom: 16, textAlign: 'center' },
  backLink: { marginTop: 4 },
  link: { fontFamily: fonts.bodyBold, color: colors.acid, fontSize: 14 },

  // Confirmed
  confirmedCard: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.2)',
    borderRadius: radii.xl,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  confirmedCheck: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.acidSoft,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmedCheckText: { fontFamily: fonts.display, fontSize: 32, color: colors.acid },
  okTitle: { fontFamily: fonts.display, fontSize: 36, color: colors.white, textAlign: 'center', marginBottom: 20, lineHeight: 42, letterSpacing: 1 },
  confirmedDetails: { width: '100%', gap: 10, marginBottom: 24 },
  confirmRowItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmRowIcon: { fontSize: 16, color: colors.grayMid, width: 20, textAlign: 'center' },
  confirmRowLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white, flex: 1 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ghostBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2, color: colors.grayLight },

  // HERO
  hero: { height: W * 1.15, position: 'relative' },
  video: { ...StyleSheet.absoluteFillObject },
  heroGrad: { ...StyleSheet.absoluteFillObject },
  heroTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 4,
  },
  backPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backPillText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.white },
  ownerRow: { flexDirection: 'row', gap: 8 },
  ownerGhost: {
    borderWidth: 1, borderColor: colors.acid,
    borderRadius: radii.pill,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(205,255,0,0.08)',
  },
  ownerGhostText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.acid },
  ownerSolid: {
    backgroundColor: colors.acid,
    borderRadius: radii.pill,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  ownerSolidText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: colors.black },

  heroText: {
    position: 'absolute',
    bottom: 28,
    left: 22,
    right: 22,
    paddingTop: 6,
    overflow: 'visible',
  },
  heroKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  heroKickerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.acid },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 4, color: colors.acid },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 62,
    color: colors.white,
    width: '100%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  heroNameAcid: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 62,
    color: colors.acid,
    marginBottom: 8,
    width: '100%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  personName: { fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 2, color: colors.grayLight, marginBottom: 14 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
    gap: 0,
  },
  statPill: { paddingHorizontal: 16, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
  statVal: { fontFamily: fonts.display, fontSize: 22, color: colors.white, lineHeight: 24 },
  statLbl: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 2, color: colors.grayLight, marginTop: 2 },

  acidLine: { height: 3, backgroundColor: colors.acid },

  // BODY
  body: { padding: 18, paddingBottom: 48, maxWidth: 720, alignSelf: 'center', width: '100%' },

  bioCard: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 14,
  },
  bioText: { fontFamily: fonts.body, fontSize: 15, color: colors.grayLight, lineHeight: 22 },

  specialtyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  specialtyPill: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  specialtyText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.grayLight, letterSpacing: 1 },

  block: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionHeadIcon: { fontSize: 14, color: colors.acid },
  sectionHeadLabel: { fontFamily: fonts.display, fontSize: 22, color: colors.white, letterSpacing: 0.5 },

  galGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galCell: { width: (W - 56) / 3, aspectRatio: 1, overflow: 'hidden', borderRadius: radii.xs },
  galImg: { width: '100%', height: '100%' },

  // Steps
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 14,
  },
  stepNumWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.acidSoft,
    borderWidth: 1,
    borderColor: 'rgba(205,255,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontFamily: fonts.display, fontSize: 13, color: colors.acid },
  stepTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white, flex: 1, letterSpacing: 0.5 },

  // Servicios
  svc: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark2,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderRadius: radii.md,
  },
  svcOn: { backgroundColor: '#111500', borderColor: colors.acid },
  svcIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  svcIconWrapOn: { backgroundColor: colors.acidSoft, borderColor: 'rgba(205,255,0,0.3)' },
  svcLabel: { fontFamily: fonts.display, fontSize: 18, color: colors.white },
  svcLabelOn: { color: colors.acid },
  svcDur: { fontFamily: fonts.body, fontSize: 12, color: colors.grayLight, marginTop: 2 },
  svcDurOn: { color: colors.acidDim },
  svcPrice: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  svcPriceOn: { color: colors.acid },
  svcCheck: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.acid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svcCheckText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.black },

  // Days
  dayRow: { marginBottom: 16 },
  dayChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderRadius: radii.md,
    minWidth: 52,
  },
  dayChipOn: { backgroundColor: '#111500', borderColor: colors.acid },
  dayNum: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  dayNumOn: { color: colors.acid },
  dayWd: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.grayLight, marginTop: 2, letterSpacing: 1 },
  dayWdOn: { color: colors.acidDim },

  // Slots
  slotGrp: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 3, color: colors.grayLight, marginBottom: 8, textTransform: 'uppercase' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  slotOn: { backgroundColor: '#111500', borderColor: colors.acid },
  slotTxt: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  slotTxtOn: { color: colors.acid },

  // Summary
  summary: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.dark2,
    padding: 18,
    marginBottom: 16,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLbl: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.grayLight, textTransform: 'uppercase' },
  summaryVal: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white, flex: 1, textAlign: 'right' },
  sep: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLbl: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.grayLight, textTransform: 'uppercase' },
  totalVal: { fontFamily: fonts.display, fontSize: 34, color: colors.acid },

  loginHint: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.dark2,
    borderRadius: radii.sm,
    gap: 6,
  },
  loginHintText: { fontFamily: fonts.body, fontSize: 13, color: colors.grayLight },

  confirm: { borderRadius: radii.sm, overflow: 'hidden', ...shadows.acid },
  confirmOff: { opacity: 0.45 },
  confirmGrad: { paddingVertical: 18, alignItems: 'center' },
  confirmText: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, color: colors.black },
  confirmTextOff: { color: colors.grayMid },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', padding: 20 },
  modalBox: {
    backgroundColor: colors.dark2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.xl,
    padding: 24,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    ...shadows.md,
  },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 2, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { color: colors.grayLight, fontSize: 16 },
  modalK: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 3, color: colors.acid, marginBottom: 8 },
  modalTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.white, marginBottom: 20, lineHeight: 34 },
  stars: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  star: { fontSize: 34, color: colors.grayMid },
  starOn: { color: colors.acid },
  ta: {
    backgroundColor: colors.dark3,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.sm,
    color: colors.white,
    fontFamily: fonts.body,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  modalBtn: { borderRadius: radii.sm, overflow: 'hidden', marginTop: 12 },
  modalBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  modalBtnTxt: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 2, color: colors.black },
  modalDone: { alignItems: 'center', padding: 8, gap: 12 },
  modalDoneIcon: { fontSize: 40, color: colors.acid },
  modalOk: { fontFamily: fonts.display, fontSize: 24, color: colors.white, textAlign: 'center', letterSpacing: 1 },
});
