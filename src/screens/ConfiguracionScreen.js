import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { fonts } from '../theme';

export default function ConfiguracionScreen() {
  const { theme, mode, toggle } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.root}>
      <Text style={s.title}>Configuración</Text>

      {/* Apariencia */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>APARIENCIA</Text>
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowTitle}>Modo {mode === 'dark' ? 'oscuro' : 'claro'}</Text>
            <Text style={s.rowSub}>{mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}</Text>
          </View>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggle}
            trackColor={{ false: theme.surface, true: theme.gold }}
            thumbColor={theme.fg}
            ios_backgroundColor={theme.surface}
          />
        </View>
      </View>

      {/* Cuenta */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>CUENTA</Text>
        <TouchableOpacity style={s.logoutRow} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={s.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: 24,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: theme.fg,
      marginTop: 24,
      marginBottom: 32,
    },
    section: {
      marginBottom: 32,
    },
    sectionLabel: {
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 3,
      color: theme.fgDim,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowLeft: {
      flex: 1,
      marginRight: 12,
    },
    rowTitle: {
      fontFamily: fonts.bodySemi,
      fontSize: 14,
      color: theme.fg,
    },
    rowSub: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: theme.fgMuted,
      marginTop: 2,
    },
    logoutRow: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderMd,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    logoutText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 1.5,
      color: '#b85e4c',
      textTransform: 'uppercase',
    },
  });
}
