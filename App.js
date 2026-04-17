import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { finalizeOAuthFromUrl } from './src/lib/googleAuth';
import { colors } from './src/theme';
import {
  setupNotificationChannel,
  requestNotificationPermissions,
} from './src/lib/notifications';

export default function App() {
  // Inicializar canal de notificaciones al arrancar la app
  useEffect(() => {
    setupNotificationChannel().catch(() => {});
    requestNotificationPermissions().catch(() => {});
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
    BebasNeue_400Regular,
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.acid} />
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
  root: { flex: 1, backgroundColor: colors.black },
  boot: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});
