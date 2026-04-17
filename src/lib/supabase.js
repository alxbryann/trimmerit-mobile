import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { supabaseMock } from './supabaseMock';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

// ── Mock mode ─────────────────────────────────────────────────────────────────
// Activar con EXPO_PUBLIC_USE_MOCK=true en .env.local
// NO commitear ese archivo (ya está en .gitignore)
const useMock =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_MOCK === 'true') ||
  extra.useMock === true;

if (useMock) {
  console.log('[BarberIT] 🧪 MOCK MODE activo — usando datos dummy');
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
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabase = useMock ? supabaseMock : realClient;
