import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_800ExtraBold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  DMMono_300Light,
  DMMono_400Regular,
} from '@expo-google-fonts/dm-mono';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { finalizeOAuthFromUrl } from './src/lib/googleAuth';
import { registerPushToken } from './src/lib/notifications';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme';
import {
  setupNotificationChannel,
  requestNotificationPermissions,
} from './src/lib/notifications';

export default function App() {
  useEffect(() => {
    setupNotificationChannel().catch(() => {});
    requestNotificationPermissions().catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) registerPushToken();
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') registerPushToken();
    });
    return () => authSub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onUrl({ url }) {
      if (!url) return;
      if (!url.includes('auth/callback')) return;
      finalizeOAuthFromUrl(url).catch(() => {});
    }
    const sub = Linking.addEventListener('url', onUrl);
    Linking.getInitialURL().then((u) => {
      if (u) onUrl({ url: u });
    });
    return () => sub.remove();
  }, []);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium_Italic,
    PlayfairDisplay_700Bold_Italic,
    PlayfairDisplay_800ExtraBold_Italic,
    DMMono_300Light,
    DMMono_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.champagne} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  boot: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
