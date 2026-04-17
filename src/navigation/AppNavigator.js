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
import LoyaltyConfigScreen from '../screens/LoyaltyConfigScreen';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

const navigationRef = createNavigationContainerRef();

export default function AppNavigator() {
  const [bootReady, setBootReady] = useState(false);
  const [initialRouteName, setInitialRouteName] = useState('Welcome');

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!supabaseConfigured) {
        if (!cancelled) {
          setInitialRouteName('Welcome');
          setBootReady(true);
        }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setInitialRouteName(session?.user ? 'MainTabs' : 'Welcome');
        setBootReady(true);
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!navigationRef.isReady()) return;
      if (event === 'SIGNED_OUT') {
        navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const state = navigationRef.getRootState();
        const route = state?.routes?.[state?.index ?? 0];
        const name = route?.name;
        if (name === 'Welcome' || name === 'Login' || name === 'Registro') {
          navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
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
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
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
        <Stack.Screen name="CompletarPerfil" component={CompletarPerfilScreen} />
        <Stack.Screen name="Panel" component={PanelScreen} />
        <Stack.Screen name="Editar" component={EditarScreen} />
        <Stack.Screen name="ClientePerfil" component={PerfilScreen} />
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
