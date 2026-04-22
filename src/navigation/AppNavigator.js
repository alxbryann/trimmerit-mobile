import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import BarberProfileScreen from '../screens/BarberProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegistroScreen from '../screens/RegistroScreen';
import CompletarPerfilScreen from '../screens/CompletarPerfilScreen';
import PanelScreen from '../screens/PanelScreen';
import EditarScreen from '../screens/EditarScreen';
import PerfilScreen from '../screens/PerfilScreen';
import HomeScreen from '../screens/HomeScreen';
import CrearBarberiaScreen from '../screens/CrearBarberiaScreen';
import AdminBarberiaScreen from '../screens/AdminBarberiaScreen';
import UnirseBarberiaScreen from '../screens/UnirseBarberiaScreen';
import EmpleadoBarberiaScreen from '../screens/EmpleadoBarberiaScreen';
import LoyaltyConfigScreen from '../screens/LoyaltyConfigScreen';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors } from '../theme';
import { resolvePostAuthDestination, applyPostAuthDestination } from './postAuthRouting';

const Stack = createNativeStackNavigator();

const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const [bootReady, setBootReady] = useState(false);
  /** Estado raíz de React Navigation (barbero con slug → tabs en Mi agenda). */
  const [bootInitialState, setBootInitialState] = useState(undefined);
  const [stackInitialRoute, setStackInitialRoute] = useState('Welcome');
  const [completarInitialParams, setCompletarInitialParams] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!supabaseConfigured) {
        if (!cancelled) {
          setBootInitialState(undefined);
          setStackInitialRoute('Welcome');
          setCompletarInitialParams({});
          setBootReady(true);
        }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        if (session?.user) {
          const dest = await resolvePostAuthDestination(session);
          if (dest.kind === 'reset') {
            setBootInitialState(dest.state);
            setStackInitialRoute('Welcome');
            setCompletarInitialParams({});
          } else if (dest.kind === 'completar') {
            setBootInitialState(undefined);
            setStackInitialRoute('CompletarPerfil');
            setCompletarInitialParams(dest.params ?? {});
          } else {
            setBootInitialState(undefined);
            setStackInitialRoute(dest.name);
            setCompletarInitialParams({});
          }
        } else {
          setBootInitialState(undefined);
          setStackInitialRoute('Welcome');
          setCompletarInitialParams({});
        }
        setBootReady(true);
      }
    }

    boot();

    /** Tras OAuth el contenedor a veces aún no está listo; el nombre vía getRootState() puede fallar. */
    function navigateAfterSignIn(sess) {
      const attempt = (n = 0) => {
        if (!navigationRef.isReady()) {
          if (n < 50) setTimeout(() => attempt(n + 1), 40);
          return;
        }
        const name = navigationRef.getCurrentRoute()?.name;
        if (name === 'Registro' || name === 'CompletarPerfil') return;
        if (name !== 'Welcome' && name !== 'Login') return;

        resolvePostAuthDestination(sess).then((dest) => {
          applyPostAuthDestination(navigationRef, dest);
        });
      };
      attempt();
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        }
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        navigateAfterSignIn(session);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!bootReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.acid} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} initialState={bootInitialState}>
      <Stack.Navigator
        {...(!bootInitialState ? { initialRouteName: stackInitialRoute } : {})}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#080808' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Welcome" component={HomeScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="BarberProfile" component={BarberProfileScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Registro" component={RegistroScreen} />
        <Stack.Screen
          name="CompletarPerfil"
          component={CompletarPerfilScreen}
          initialParams={completarInitialParams}
        />
        <Stack.Screen name="Panel" component={PanelScreen} />
        <Stack.Screen name="Editar" component={EditarScreen} />
        <Stack.Screen name="ClientePerfil" component={PerfilScreen} />
        <Stack.Screen name="CrearBarberia" component={CrearBarberiaScreen} />
        <Stack.Screen name="AdminBarberia" component={AdminBarberiaScreen} />
        <Stack.Screen name="UnirseBarberia" component={UnirseBarberiaScreen} />
        <Stack.Screen name="EmpleadoBarberia" component={EmpleadoBarberiaScreen} />
        <Stack.Screen name="LoyaltyConfig" component={LoyaltyConfigScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
