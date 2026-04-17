/** @type {import('expo/config').ExpoConfig} */
export default {
  name: 'Barber.it',
  slug: 'barberit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'barberit',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#080808',
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#080808',
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
  },
  plugins: [
    'expo-web-browser',
    'expo-font',
    'expo-video',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Barber.it accede a tu galería para el video hero y fotos de cortes.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#CDFF00',
        sounds: [],
      },
    ],
  ],
};
