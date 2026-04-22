/**
 * Iconos de servicio: se guarda el nombre de Ionicons en `servicios.icono`.
 * Compatibilidad con valores antiguos (símbolos Unicode genéricos).
 */
import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Opciones del selector en edición de perfil (orden = uso típico en corte y estilo). */
export const SERVICE_ICON_OPTIONS = [
  { value: 'cut-outline', hint: 'Corte / tijeras' },
  { value: 'brush-outline', hint: 'Barba / perfilado' },
  { value: 'eye-outline', hint: 'Cejas / detalle' },
  { value: 'layers-outline', hint: 'Combo / varios servicios' },
  { value: 'water-outline', hint: 'Lavado' },
  { value: 'sparkles-outline', hint: 'Tratamiento / acabado' },
  { value: 'color-wand-outline', hint: 'Color / estilo' },
  { value: 'flash-outline', hint: 'Servicio rápido' },
];

const KNOWN = new Set(SERVICE_ICON_OPTIONS.map((o) => o.value));

/** Mapa legacy: símbolos viejos del picker → Ionicons */
const LEGACY_TO_IONICON = {
  '✦': 'cut-outline',
  '◈': 'brush-outline',
  '◉': 'layers-outline',
  '✂': 'cut-outline',
  '◆': 'color-wand-outline',
  '●': 'water-outline',
  '★': 'sparkles-outline',
  '▲': 'eye-outline',
};

export function resolveServiceIonicon(stored) {
  if (stored == null || stored === '') return 'cut-outline';
  if (typeof stored === 'string' && LEGACY_TO_IONICON[stored]) {
    return LEGACY_TO_IONICON[stored];
  }
  if (typeof stored === 'string' && KNOWN.has(stored)) return stored;
  return 'cut-outline';
}

export function ServiceIonicon({ name, size, color, style }) {
  return (
    <Ionicons name={resolveServiceIonicon(name)} size={size} color={color} style={style} />
  );
}
