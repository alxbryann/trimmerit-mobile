/** @type {import('expo/config').ExpoConfig} */
export default {
  name: 'trimmerit',
  slug: 'trimmerit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'trimmerit',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.trimmerit.app',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.trimmerit.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? '',
    eas: {
      projectId: '05af54d2-14ca-4996-b715-4543396d9683',
    },
  },
  plugins: [
    'expo-video',
    'expo-web-browser',
    'expo-font',
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#c8a96a',
        sounds: ['./assets/barber_buzz.wav'],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'trimmerit accede a tu galería para el video hero y fotos de cortes.',
      },
    ],
  ],
};
