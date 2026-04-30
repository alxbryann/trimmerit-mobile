import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, supabaseConfigured } from '../lib/supabase';
import InicioClienteScreen from '../screens/InicioClienteScreen';
import CatalogoScreen from '../screens/CatalogoScreen';
import BarberosScreen from '../screens/BarberosScreen';
import AgendaScreen from '../screens/AgendaScreen';
import LoyaltyCardScreen from '../screens/LoyaltyCardScreen';
import PanelScreen from '../screens/PanelScreen';
import EditarScreen from '../screens/EditarScreen';
import AdminBarberiaScreen from '../screens/AdminBarberiaScreen';
import EmpleadoBarberiaScreen from '../screens/EmpleadoBarberiaScreen';
import FeedBarberoScreen from '../screens/FeedBarberoScreen';
import LogrosScreen from '../screens/LogrosScreen';
import ConfiguracionScreen from '../screens/ConfiguracionScreen';
import SolicitudPopup from '../components/SolicitudPopup';
import { sendPushNotification } from '../lib/notifications';
import { fonts } from '../theme';
import { useColors, useTheme } from '../theme/ThemeContext';

function tabBarInactiveTint(colors, mode) {
  return mode === 'light' ? 'rgba(15,13,11,0.72)' : colors.muted;
}

const Tab = createBottomTabNavigator();

const BarberSlugContext = createContext(null);

function useBarberSlug() {
  return useContext(BarberSlugContext);
}

const CLIENT_ICONS = {
  Inicio:        { focused: 'home', outline: 'home-outline' },
  Catalogo:      { focused: 'search', outline: 'search-outline' },
  Agenda:        { focused: 'time', outline: 'time-outline' },
  Fidelizacion:  { focused: 'ribbon', outline: 'ribbon-outline' },
  Logros:        { focused: 'trophy', outline: 'trophy-outline' },
  Configuracion: { focused: 'settings', outline: 'settings-outline' },
};

const BARBER_ICONS = {
  MiAgenda:      { focused: 'calendar', outline: 'calendar-outline' },
  Feed:          { focused: 'grid', outline: 'grid-outline' },
  MiPerfil:      { focused: 'person', outline: 'person-outline' },
  Logros:        { focused: 'trophy', outline: 'trophy-outline' },
  Configuracion: { focused: 'settings', outline: 'settings-outline' },
};

const ADMIN_ICONS = {
  MiPanel:       { focused: 'grid', outline: 'grid-outline' },
  MiAgenda:      { focused: 'calendar', outline: 'calendar-outline' },
  Feed:          { focused: 'newspaper', outline: 'newspaper-outline' },
  MiPerfil:      { focused: 'person', outline: 'person-outline' },
  Logros:        { focused: 'trophy', outline: 'trophy-outline' },
  Configuracion: { focused: 'settings', outline: 'settings-outline' },
};

/** Crea o recupera el registro en `barberos` del dueño (misma lógica que colaborador / agenda). */
async function ensureAdminBarbero(userId) {
  const { data: existing } = await supabase
    .from('barberos')
    .select('slug')
    .eq('id', userId)
    .maybeSingle();
  if (existing?.slug) return existing.slug;

  const { data: b } = await supabase
    .from('barberias')
    .select('id, slug, nombre')
    .eq('admin_id', userId)
    .maybeSingle();
  if (!b) return null;

  const { error } = await supabase.from('barberos').upsert({
    id: userId,
    barberia_id: b.id,
    slug: b.slug,
    nombre_barberia: b.nombre?.trim() || null,
  });
  if (error) return null;
  return b.slug;
}

function pickDisplayName(profile, session) {
  const fromProfile = profile?.nombre?.trim();
  if (fromProfile) return fromProfile;
  const meta = session?.user?.user_metadata ?? {};
  const fromMeta =
    meta.nombre?.trim() ||
    meta.name?.trim() ||
    meta.full_name?.trim();
  if (fromMeta) return fromMeta;
  return session?.user?.email ?? 'El cliente';
}

const EMPLEADO_ICONS = {
  MiAgenda:      { focused: 'calendar', outline: 'calendar-outline' },
  Feed:          { focused: 'grid', outline: 'grid-outline' },
  MiPerfil:      { focused: 'person', outline: 'person-outline' },
  Logros:        { focused: 'trophy', outline: 'trophy-outline' },
  Configuracion: { focused: 'settings', outline: 'settings-outline' },
};

function BarberPanelTab(props) {
  const ctxSlug = useBarberSlug();
  const slug = props.route.params?.slug ?? ctxSlug;
  return <PanelScreen {...props} route={{ ...props.route, params: { ...props.route.params, slug } }} />;
}

function BarberEditarTab(props) {
  const ctxSlug = useBarberSlug();
  const slug = props.route.params?.slug ?? ctxSlug;
  return <EditarScreen {...props} route={{ ...props.route, params: { ...props.route.params, slug } }} />;
}


const tabScreenOptions = (colors, fonts, mode) => ({ route }) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.ink,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    paddingTop: 10,
    paddingBottom: 0,
  },
  tabBarActiveTintColor: colors.champagne,
  tabBarInactiveTintColor: tabBarInactiveTint(colors, mode),
  tabBarLabelStyle: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.35,
    marginBottom: 4,
    marginTop: 2,
  },
});

function ClientTabs({ bottomPad, colors, mode }) {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={({ route }) => ({
        ...tabScreenOptions(colors, fonts, mode)({ route }),
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingTop: 10,
          paddingBottom: bottomPad,
        },
        tabBarIcon: ({ color, focused }) => {
          const map = CLIENT_ICONS[route.name];
          const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
          return <Ionicons name={name} size={20} color={color} />;
        },
        tabBarItemStyle: { paddingHorizontal: 2 },
      })}
    >
      <Tab.Screen name="Inicio" component={InicioClienteScreen} options={{ tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Catalogo" component={CatalogoScreen} options={{ tabBarLabel: 'Catálogo' }} />
      <Tab.Screen name="Agenda" component={AgendaScreen} options={{ tabBarLabel: 'Agenda' }} />
      <Tab.Screen name="Fidelizacion" component={LoyaltyCardScreen} options={{ tabBarLabel: 'Sellos' }} />
      <Tab.Screen name="Logros" component={LogrosScreen} options={{ tabBarLabel: 'Logros' }} />
      <Tab.Screen name="Configuracion" component={ConfiguracionScreen} options={{ tabBarLabel: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

function BarberTabs({ bottomPad, slug, colors, mode }) {
  return (
    <BarberSlugContext.Provider value={slug}>
      <Tab.Navigator
        initialRouteName="MiAgenda"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.ink,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            paddingTop: 10,
            paddingBottom: bottomPad,
          },
          tabBarActiveTintColor: colors.champagne,
          tabBarInactiveTintColor: tabBarInactiveTint(colors, mode),
          tabBarLabelStyle: {
            fontFamily: fonts.mono,
            fontSize: 8,
            letterSpacing: 0.35,
            marginBottom: 4,
            marginTop: 2,
          },
          tabBarIcon: ({ color, focused }) => {
            const map = BARBER_ICONS[route.name];
            const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
            return <Ionicons name={name} size={20} color={color} />;
          },
          tabBarItemStyle: { paddingHorizontal: 2 },
        })}
      >
        <Tab.Screen name="MiAgenda" component={BarberPanelTab} options={{ tabBarLabel: 'Mi agenda' }} />
        <Tab.Screen name="Feed" component={FeedBarberoScreen} options={{ tabBarLabel: 'Feed' }} />
        <Tab.Screen name="MiPerfil" component={BarberEditarTab} options={{ tabBarLabel: 'Mi perfil' }} />
        <Tab.Screen name="Logros" component={LogrosScreen} options={{ tabBarLabel: 'Logros' }} />
        <Tab.Screen name="Configuracion" component={ConfiguracionScreen} options={{ tabBarLabel: 'Ajustes' }} />
      </Tab.Navigator>
    </BarberSlugContext.Provider>
  );
}

function AdminBarberTabs({ bottomPad, slug, colors, mode }) {
  return (
    <BarberSlugContext.Provider value={slug}>
      <Tab.Navigator
        initialRouteName="MiPanel"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.black,
            borderTopColor: colors.cardBorder,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: bottomPad,
          },
          tabBarActiveTintColor: colors.acid,
          tabBarInactiveTintColor: mode === 'light' ? tabBarInactiveTint(colors, mode) : colors.grayLight,
          tabBarLabelStyle: {
            fontFamily: fonts.bodyBold,
            fontSize: 8,
            letterSpacing: 0.35,
            marginBottom: 4,
            marginTop: 2,
          },
          tabBarIcon: ({ color, focused }) => {
            const map = ADMIN_ICONS[route.name];
            const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
            return <Ionicons name={name} size={20} color={color} />;
          },
          tabBarItemStyle: { paddingHorizontal: 2 },
        })}
      >
        <Tab.Screen name="MiPanel" component={AdminBarberiaScreen} options={{ tabBarLabel: 'Local' }} />
        <Tab.Screen name="MiAgenda" component={BarberPanelTab} options={{ tabBarLabel: 'Agenda' }} />
        <Tab.Screen name="Feed" component={FeedBarberoScreen} options={{ tabBarLabel: 'Feed' }} />
        <Tab.Screen name="MiPerfil" component={BarberEditarTab} options={{ tabBarLabel: 'Perfil' }} />
        <Tab.Screen name="Logros" component={LogrosScreen} options={{ tabBarLabel: 'Logros' }} />
        <Tab.Screen name="Configuracion" component={ConfiguracionScreen} options={{ tabBarLabel: 'Ajustes' }} />
      </Tab.Navigator>
    </BarberSlugContext.Provider>
  );
}

function EmpleadoTabs({ bottomPad, slug, colors, mode }) {
  return (
    <BarberSlugContext.Provider value={slug}>
      <Tab.Navigator
        initialRouteName="MiAgenda"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.ink,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            paddingTop: 10,
            paddingBottom: bottomPad,
          },
          tabBarActiveTintColor: colors.champagne,
          tabBarInactiveTintColor: tabBarInactiveTint(colors, mode),
          tabBarLabelStyle: {
            fontFamily: fonts.mono,
            fontSize: 8,
            letterSpacing: 0.35,
            marginBottom: 4,
            marginTop: 2,
          },
          tabBarIcon: ({ color, focused }) => {
            const map = EMPLEADO_ICONS[route.name];
            const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
            return <Ionicons name={name} size={20} color={color} />;
          },
          tabBarItemStyle: { paddingHorizontal: 2 },
        })}
      >
        <Tab.Screen name="MiAgenda" component={EmpleadoBarberiaScreen} options={{ tabBarLabel: 'Mi Agenda' }} />
        <Tab.Screen name="Feed" component={FeedBarberoScreen} options={{ tabBarLabel: 'Feed' }} />
        <Tab.Screen name="MiPerfil" component={BarberEditarTab} options={{ tabBarLabel: 'Mi perfil' }} />
        <Tab.Screen name="Logros" component={LogrosScreen} options={{ tabBarLabel: 'Logros' }} />
        <Tab.Screen name="Configuracion" component={ConfiguracionScreen} options={{ tabBarLabel: 'Ajustes' }} />
      </Tab.Navigator>
    </BarberSlugContext.Provider>
  );
}

export default function MainTabNavigator({ navigation }) {
  const colors = useColors();
  const { mode } = useTheme();
  const styles = StyleSheet.create({
    loadingRoot: {
      flex: 1,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stub: { flex: 1, backgroundColor: colors.ink },
  });
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const [ready, setReady] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
  const [barberSlug, setBarberSlug] = useState(null);
  const [empleadoSlug, setEmpleadoSlug] = useState(null);
  const [adminBarberSlug, setAdminBarberSlug] = useState(null);
  const [role, setRole] = useState(null);

  const [clientSolicitudQueue, setClientSolicitudQueue] = useState([]);
  const clientSolicitudActual = clientSolicitudQueue[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    let seq = 0;

    /**
     * `sessionHint === undefined` → leer getSession() (solo arranque).
     * `null` u objeto → viene de onAuthStateChange (evita carrera con SecureStore al cambiar de usuario).
     * `seq` evita que dos resolves solapados dejen `ready` en false o mezclen roles.
     */
    async function applyAuthSession(sessionHint) {
      const mySeq = ++seq;

      if (!supabaseConfigured) {
        if (!cancelled && mySeq === seq) {
          setIsBarber(false);
          setBarberSlug(null);
          setEmpleadoSlug(null);
          setAdminBarberSlug(null);
          setRole(null);
          setReady(true);
        }
        return;
      }

      let session = sessionHint;
      if (session === undefined) {
        const { data } = await supabase.auth.getSession();
        if (cancelled || mySeq !== seq) return;
        session = data?.session ?? null;
      }

      if (!session?.user) {
        if (!cancelled && mySeq === seq) {
          setIsBarber(false);
          setBarberSlug(null);
          setEmpleadoSlug(null);
          setAdminBarberSlug(null);
          setRole(null);
          setReady(true);
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled || mySeq !== seq) return;

      if (profile?.role === 'admin_barberia' || profile?.role === 'barbero') {
        const slug = await ensureAdminBarbero(session.user.id);
        if (cancelled || mySeq !== seq) return;
        if (!cancelled && mySeq === seq) {
          setIsBarber(false);
          setBarberSlug(null);
          setEmpleadoSlug(null);
          setAdminBarberSlug(slug);
          setRole('admin_barberia');
          setReady(true);
        }
        return;
      }

      if (profile?.role === 'barbero_empleado') {
        const { data: bEmp } = await supabase
          .from('barberos')
          .select('slug')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled || mySeq !== seq) return;
        if (!cancelled && mySeq === seq) {
          setIsBarber(false);
          setBarberSlug(null);
          setEmpleadoSlug(bEmp?.slug ?? null);
          setAdminBarberSlug(null);
          setRole('barbero_empleado');
          setReady(true);
        }
        return;
      }

      // Cliente: cargar solicitudes no leídas
      const { data: sols } = await supabase
        .from('reserva_solicitudes')
        .select('*')
        .eq('cliente_id', session.user.id)
        .eq('leido_cliente', false)
        .order('created_at', { ascending: true });
      if (cancelled || mySeq !== seq) return;
      if (!cancelled && mySeq === seq) {
        if (sols?.length) setClientSolicitudQueue(sols);
        setIsBarber(false);
        setBarberSlug(null);
        setEmpleadoSlug(null);
        setAdminBarberSlug(null);
        setRole(profile?.role ?? null);
        setReady(true);
      }
    }

    applyAuthSession(undefined);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthSession(session ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleClientSolicitudClose() {
    if (!clientSolicitudActual) return;
    const s = clientSolicitudActual;
    if (s.tipo === 'cancelacion' || s.estado !== 'pendiente') {
      await supabase
        .from('reserva_solicitudes')
        .update({ leido_cliente: true })
        .eq('id', s.id);
    }
    setClientSolicitudQueue((prev) => prev.slice(1));
  }

  async function handleClientAceptar(solicitudId) {
    const { data, error } = await supabase.rpc('responder_aplazamiento', {
      p_solicitud_id: solicitudId,
      p_acepta: true,
    });
    if (error || !data?.ok) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data: solicitud } = await supabase
      .from('reserva_solicitudes')
      .select('barbero_id, cliente_id')
      .eq('id', solicitudId)
      .maybeSingle();
    const barberoId = solicitud?.barbero_id ?? clientSolicitudActual?.barbero_id;
    const clienteId = solicitud?.cliente_id ?? session?.user?.id;
    const { data: clienteProfile } = clienteId
      ? await supabase
        .from('profiles')
        .select('nombre')
        .eq('id', clienteId)
        .maybeSingle()
      : { data: null };
    const nombreCliente = pickDisplayName(clienteProfile, session);
    if (barberoId) {
      const { data: barberoProfile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', barberoId)
        .maybeSingle();
      if (barberoProfile?.push_token) {
        await sendPushNotification({
          to: barberoProfile.push_token,
          title: '✅ Aplazamiento aceptado',
          body: `${nombreCliente} aceptó el cambio de fecha que propusiste.`,
          data: { tipo: 'respuesta_aplazamiento', acepto: true, solicitudId },
        });
      }
    }
  }

  async function handleClientRechazar(solicitudId) {
    const { data, error } = await supabase.rpc('responder_aplazamiento', {
      p_solicitud_id: solicitudId,
      p_acepta: false,
    });
    if (error || !data?.ok) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data: solicitud } = await supabase
      .from('reserva_solicitudes')
      .select('barbero_id, cliente_id')
      .eq('id', solicitudId)
      .maybeSingle();
    const barberoId = solicitud?.barbero_id ?? clientSolicitudActual?.barbero_id;
    const clienteId = solicitud?.cliente_id ?? session?.user?.id;
    const { data: clienteProfile } = clienteId
      ? await supabase
        .from('profiles')
        .select('nombre')
        .eq('id', clienteId)
        .maybeSingle()
      : { data: null };
    const nombreCliente = pickDisplayName(clienteProfile, session);
    if (barberoId) {
      const { data: barberoProfile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', barberoId)
        .maybeSingle();
      if (barberoProfile?.push_token) {
        await sendPushNotification({
          to: barberoProfile.push_token,
          title: '❌ Aplazamiento rechazado',
          body: `${nombreCliente} rechazó el cambio de fecha que propusiste.`,
          data: { tipo: 'respuesta_aplazamiento', acepto: false, solicitudId },
        });
      }
    }
  }

  function handleClientNuevaReserva(barberoSlug) {
    setClientSolicitudQueue((prev) => prev.slice(1));
    if (barberoSlug && navigation) {
      navigation.navigate('BarberProfile', { slug: barberoSlug });
    }
  }

  if (!ready) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.champagne} />
      </View>
    );
  }

  return (
    <>
      {isBarber && barberSlug ? (
        <BarberTabs bottomPad={bottomPad} slug={barberSlug} colors={colors} mode={mode} />
      ) : role === 'admin_barberia' ? (
        <AdminBarberTabs bottomPad={bottomPad} slug={adminBarberSlug} colors={colors} mode={mode} />
      ) : role === 'barbero_empleado' ? (
        <EmpleadoTabs bottomPad={bottomPad} slug={empleadoSlug} colors={colors} mode={mode} />
      ) : (
        <ClientTabs bottomPad={bottomPad} colors={colors} mode={mode} />
      )}

      {!isBarber && clientSolicitudActual && (
        <SolicitudPopup
          solicitud={clientSolicitudActual}
          role="cliente"
          onClose={handleClientSolicitudClose}
          onAceptar={handleClientAceptar}
          onRechazar={handleClientRechazar}
          onNuevaReserva={handleClientNuevaReserva}
        />
      )}
    </>
  );
}

