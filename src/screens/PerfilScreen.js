import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { fonts, radii, shadows } from '../theme';
import { useColors } from '../theme/ThemeContext';

export default function PerfilScreen({ navigation }) {
  const colors = useColors();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.black },
    safe: { flex: 1 },
    scroll: { paddingHorizontal: 28, paddingBottom: 32 },
    top: { paddingTop: 12, marginBottom: 28 },
    logo: {
      fontFamily: fonts.display,
      fontSize: 32,
      letterSpacing: 3,
      color: colors.white,
    },
    accent: { color: colors.acid },
    kicker: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 2,
      color: colors.grayMid,
      marginTop: 8,
    },
    center: { paddingVertical: 48, alignItems: 'center' },
    block: { gap: 14 },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 2,
      color: colors.acid,
      marginBottom: 4,
    },
    name: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: colors.white,
      letterSpacing: 1,
    },
    email: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.grayLight,
      marginBottom: 8,
    },
    muted: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.grayLight,
      lineHeight: 22,
      marginBottom: 4,
    },
    primaryWrap: {
      borderRadius: radii.sm,
      overflow: 'hidden',
      marginTop: 8,
      ...shadows.acid,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
      paddingHorizontal: 24,
    },
    primaryText: {
      fontFamily: fonts.display,
      fontSize: 18,
      letterSpacing: 2,
      color: colors.black,
    },
    primaryArrow: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: colors.black,
    },
    secondary: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radii.sm,
      paddingVertical: 16,
      alignItems: 'center',
    },
    secondaryText: {
      fontFamily: fonts.display,
      fontSize: 16,
      letterSpacing: 2,
      color: colors.white,
    },
  });

  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  const displayName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name ??
    session?.user?.email ??
    '';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0d0f08', '#080808']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <Text style={styles.logo}>
              TU<Text style={styles.accent}> CUENTA</Text>
            </Text>
            <Text style={styles.kicker}>Perfil y sesión</Text>
          </View>

          {checking ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.acid} />
            </View>
          ) : session ? (
            <View style={styles.block}>
              <Text style={styles.label}>CONECTADO COMO</Text>
              <Text style={styles.name}>{displayName || 'Usuario'}</Text>
              {session.user?.email ? (
                <Text style={styles.email}>{session.user.email}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.primaryWrap}
                onPress={() => navigation.navigate('CompletarPerfil')}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[colors.acid, colors.acidDim]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>COMPLETAR PERFIL</Text>
                  <Text style={styles.primaryArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondary}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryText}>CERRAR SESIÓN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.block}>
              <Text style={styles.muted}>
                Inicia sesión para guardar tus reservas y gestionar tu perfil.
              </Text>
              <TouchableOpacity
                style={styles.primaryWrap}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[colors.acid, colors.acidDim]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>INICIAR SESIÓN</Text>
                  <Text style={styles.primaryArrow}>→</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => navigation.navigate('Registro')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryText}>CREAR CUENTA</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

