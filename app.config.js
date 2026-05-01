/** @type {import('expo/config').ExpoConfig} */
export default {
  name: 'trimmerit',
  slug: 'trimmerit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/trimmerit-icon-1024 (1).png',
  userInterfaceStyle: 'dark',
  scheme: 'trimmerit',
  newArchEnabled: true,
  splash: {
    image: './assets/trimmerit-icon-1024 (1).png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.trimmerit.app',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
      NSLocationAlwaysUsageDescription:
        'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
    },
  },
  android: {
    package: 'com.trimmerit.app',
    adaptiveIcon: {
      foregroundImage: './assets/trimmerit-icon-1024 (1).png',
      backgroundColor: '#0a0a0a',
    },
    edgeToEdgeEnabled: true,
    permissions: ['android.permission.ACCESS_FINE_LOCATION'],
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
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
        locationAlwaysAndWhenInUsePermission:
          'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
        locationAlwaysPermission:
          'Trimmerit usa tu ubicación para mostrarte las barberías más cercanas.',
      },
    ],
    'expo-font',
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        icon: './assets/trimmerit-icon-1024 (1).png',
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
