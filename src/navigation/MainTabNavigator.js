import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, supabaseConfigured } from '../lib/supabase';
import BarberosScreen from '../screens/BarberosScreen';
import AgendaScreen from '../screens/AgendaScreen';
import LoyaltyCardScreen from '../screens/LoyaltyCardScreen';
import PanelScreen from '../screens/PanelScreen';
import EditarScreen from '../screens/EditarScreen';
import SolicitudPopup from '../components/SolicitudPopup';
import { notifRespuestaAlBarbero } from '../lib/notifications';
import { colors, fonts } from '../theme';

const Tab = createBottomTabNavigator();

const BarberSlugContext = createContext(null);

function useBarberSlug() {
  return useContext(BarberSlugContext);
}

const CLIENT_ICONS = {
  Catalogo: { focused: 'people', outline: 'people-outline' },
  Agenda: { focused: 'time', outline: 'time-outline' },
  Fidelizacion: { focused: 'ribbon', outline: 'ribbon-outline' },
  CerrarSesion: { focused: 'log-out-outline', outline: 'log-out-outline' },
};

const BARBER_ICONS = {
  MiAgenda: { focused: 'calendar', outline: 'calendar-outline' },
  MiPerfil: { focused: 'person', outline: 'person-outline' },
  CerrarSesion: { focused: 'log-out-outline', outline: 'log-out-outline' },
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

function BarberLogoutStub() {
  return <View style={styles.stub} />;
}

function ClientLogoutStub() {
  return <View style={styles.stub} />;
}

function ClientTabs({ bottomPad }) {
  async function onLogoutPress() {
    await supabase.auth.signOut();
  }

  return (
    <Tab.Navigator
      initialRouteName="Catalogo"
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
        tabBarInactiveTintColor: colors.grayLight,
        tabBarLabelStyle: {
          fontFamily: fonts.bodyBold,
          fontSize: 9,
          letterSpacing: 1.2,
          marginBottom: 4,
          textTransform: 'uppercase',
        },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'CerrarSesion') {
            return <Ionicons name="log-out-outline" size={22} color={colors.grayLight} />;
          }
          const map = CLIENT_ICONS[route.name];
          const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Catalogo"
        component={BarberosScreen}
        options={{ tabBarLabel: 'Catálogo' }}
      />
      <Tab.Screen name="Agenda" component={AgendaScreen} options={{ tabBarLabel: 'Agenda' }} />
      <Tab.Screen
        name="Fidelizacion"
        component={LoyaltyCardScreen}
        options={{ tabBarLabel: 'Sellos' }}
      />
      <Tab.Screen
        name="CerrarSesion"
        component={ClientLogoutStub}
        options={{
          tabBarLabel: 'Cerrar sesión',
          tabBarActiveTintColor: colors.grayLight,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            onLogoutPress();
          },
        }}
      />
    </Tab.Navigator>
  );
}

function BarberTabs({ bottomPad, slug }) {
  async function onLogoutPress() {
    await supabase.auth.signOut();
  }

  return (
    <BarberSlugContext.Provider value={slug}>
      <Tab.Navigator
        initialRouteName="MiAgenda"
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
          tabBarInactiveTintColor: colors.grayLight,
          tabBarLabelStyle: {
            fontFamily: fonts.bodyBold,
            fontSize: 9,
            letterSpacing: 1.2,
            marginBottom: 4,
            textTransform: 'uppercase',
          },
          tabBarIcon: ({ color, focused }) => {
            if (route.name === 'CerrarSesion') {
              return <Ionicons name="log-out-outline" size={22} color={colors.grayLight} />;
            }
            const map = BARBER_ICONS[route.name];
            const name = map ? (focused ? map.focused : map.outline) : 'ellipse-outline';
            return <Ionicons name={name} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="MiAgenda" component={BarberPanelTab} options={{ tabBarLabel: 'Mi agenda' }} />
        <Tab.Screen name="MiPerfil" component={BarberEditarTab} options={{ tabBarLabel: 'Mi perfil' }} />
        <Tab.Screen
          name="CerrarSesion"
          component={BarberLogoutStub}
          options={{
            tabBarLabel: 'Cerrar sesión',
            tabBarActiveTintColor: colors.grayLight,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              onLogoutPress();
            },
          }}
        />
      </Tab.Navigator>
    </BarberSlugContext.Provider>
  );
}

export default function MainTabNavigator({ navigation }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const [ready, setReady] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
  const [barberSlug, setBarberSlug] = useState(null);

  // ─── Cola de solicitudes para el cliente (se carga al arrancar la app) ───────
  const [clientSolicitudQueue, setClientSolicitudQueue] = useState([]);
  const clientSolicitudActual = clientSolicitudQueue[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!supabaseConfigured) {
        if (!cancelled) {
          setIsBarber(false);
          setBarberSlug(null);
          setReady(true);
        }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) {
          setIsBarber(false);
          setBarberSlug(null);
          setReady(true);
        }
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.role === 'barbero') {
        const { data: b } = await supabase
          .from('barberos')
          .select('slug')
          .eq('id', session.user.id)
          .maybeSingle();
        if (b?.slug) {
          if (!cancelled) {
            setBarberSlug(b.slug);
            setIsBarber(true);
            setReady(true);
          }
          return;
        }
      }

      // ── Cliente: cargar solicitudes no leídas al arrancar ──────────────────
      if (!cancelled) {
        const { data: sols } = await supabase
          .from('reserva_solicitudes')
          .select('*')
          .eq('cliente_id', session.user.id)
          .eq('leido_cliente', false)
          .order('created_at', { ascending: true });
        if (!cancelled && sols?.length) {
          setClientSolicitudQueue(sols);
        }
        setIsBarber(false);
        setBarberSlug(null);
        setReady(true);
      }
    }

    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      resolve();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ─── Handlers del popup de solicitudes (rol cliente) ──────────────────────

  async function handleClientSolicitudClose() {
    if (!clientSolicitudActual) return;
    const s = clientSolicitudActual;
    // Solo marcar como leído si tiene estado final (no aplazamiento pendiente)
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
    await notifRespuestaAlBarbero('El cliente', true);
  }

  async function handleClientRechazar(solicitudId) {
    const { data, error } = await supabase.rpc('responder_aplazamiento', {
      p_solicitud_id: solicitudId,
      p_acepta: false,
    });
    if (error || !data?.ok) return;
    await notifRespuestaAlBarbero('El cliente', false);
  }

  function handleClientNuevaReserva(barberoSlug) {
    setClientSolicitudQueue((prev) => prev.slice(1));
    if (barberoSlug && navigation) {
      navigation.navigate('BarberProfile', { slug: barberoSlug });
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  return (
    <>
      {isBarber && barberSlug
        ? <BarberTabs bottomPad={bottomPad} slug={barberSlug} />
        : <ClientTabs bottomPad={bottomPad} />
      }

      {/* Popup global para el cliente — dispara al abrir la app */}
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

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stub: { flex: 1, backgroundColor: colors.black },
});
