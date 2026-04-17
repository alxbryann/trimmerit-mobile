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

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const [ready, setReady] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
  const [barberSlug, setBarberSlug] = useState(null);

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
      if (!cancelled) {
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

  if (!ready) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  if (isBarber && barberSlug) {
    return <BarberTabs bottomPad={bottomPad} slug={barberSlug} />;
  }

  return <ClientTabs bottomPad={bottomPad} />;
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stub: { flex: 1, backgroundColor: colors.black },
});
