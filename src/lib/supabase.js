import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { supabaseMock } from './supabaseMock';

// ── OWASP A02: almacenamiento seguro de tokens de sesión ──────────────────────
// Los tokens JWT (access_token, refresh_token) no deben quedar en AsyncStorage,
// que en Android es legible sin root vía ADB backup.
// expo-secure-store usa Keychain (iOS) y Android Keystore (Android) — ambos cifrados.
// Las claves de preferencias no sensibles siguen en AsyncStorage.
const SENSITIVE_KEYS = new Set(['supabase.auth.token', 'sb-auth-token']);

const SecureStoreWithFallback = {
  async getItem(key) {
    if (SENSITIVE_KEYS.has(key) || key.includes('auth')) {
      try { return await SecureStore.getItemAsync(key); } catch { /* fallback */ }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    if (SENSITIVE_KEYS.has(key) || key.includes('auth')) {
      try { return await SecureStore.setItemAsync(key, value); } catch { /* fallback */ }
    }
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (SENSITIVE_KEYS.has(key) || key.includes('auth')) {
      try { return await SecureStore.deleteItemAsync(key); } catch { /* fallback */ }
    }
    return AsyncStorage.removeItem(key);
  },
};

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

// ── Mock mode ─────────────────────────────────────────────────────────────────
// Activar con EXPO_PUBLIC_USE_MOCK=true en .env.local
// NO commitear ese archivo (ya está en .gitignore)
const useMock =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_MOCK === 'true') ||
  extra.useMock === true;

if (useMock) {
  console.log('[Trimmerit] 🧪 MOCK MODE activo — usando datos dummy');
}

// ── Supabase real ─────────────────────────────────────────────────────────────
const envUrl =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
  extra.supabaseUrl ||
  '';
const envKey =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  extra.supabaseAnonKey ||
  '';

export const supabaseConfigured = useMock || Boolean(String(envUrl).trim() && String(envKey).trim());

/**
 * createClient('', key) lanza "supabaseUrl is required" al cargar el módulo
 * y la app nunca registra "main". Usamos placeholders solo para poder importar;
 * las pantallas deben comprobar supabaseConfigured antes de usar la API.
 */
const PLACEHOLDER_URL = 'https://configure-env.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder';

const supabaseUrl = supabaseConfigured && !useMock ? envUrl.trim() : PLACEHOLDER_URL;
const supabaseAnonKey = supabaseConfigured && !useMock ? envKey.trim() : PLACEHOLDER_KEY;

const realClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreWithFallback,  // OWASP A02: tokens en Keychain/Keystore cifrado
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabase = useMock ? supabaseMock : realClient;
