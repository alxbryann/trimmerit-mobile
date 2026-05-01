export const DEFAULT_SERVICES = [
  { id: 'corte', label: 'CORTE CLÁSICO', price: 40000, duration: '45 min', icon: 'cut-outline' },
  { id: 'barba', label: 'BARBA', price: 30000, duration: '30 min', icon: 'brush-outline' },
  { id: 'combo', label: 'COMBO FULL', price: 65000, duration: '75 min', icon: 'layers-outline' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nombre a mostrar del local (misma prioridad que Editar/Empleado: barberías → barberos.nombre_barberia → slug).
 * @param {null|undefined|{ nombre_barberia?: string|null, slug?: string|null, barberias?: { nombre?: string|null }|null }} barberoRow
 * @param {{ fallback?: string }} [options] — prioridad mínima antes de "Trimmerit" (p. ej. nombre de perfil del barbero)
 * @returns {string}
 */
export function resolveLocalDisplayName(barberoRow, options = {}) {
  const b = barberoRow;
  const fallback = typeof options.fallback === 'string' && options.fallback?.trim() ? options.fallback.trim() : null;
  if (!b) return fallback ?? 'Trimmerit';
  const fromJoin = b.barberias?.nombre?.trim();
  if (fromJoin) return fromJoin;
  const raw = (b.nombre_barberia ?? '').trim();
  if (raw && !localNameLooksCorrupt(raw)) {
    return raw;
  }
  const fromSlug = typeof b.slug === 'string' && b.slug.trim() ? b.slug.replace(/-/g, ' ').trim() : '';
  if (fromSlug) return fromSlug;
  return fallback ?? 'Trimmerit';
}

function localNameLooksCorrupt(s) {
  if (UUID_RE.test(s)) return true;
  if (s.length > 0 && s.length <= 12 && !/\s/.test(s) && /^[0-9a-f]+$/i.test(s)) {
    return true;
  }
  return false;
}

/** True if `s` looks like a Postgres uuid (servicios.id). Default booking slugs like "corte" are not uuids. */
export function isUuidString(s) {
  return typeof s === 'string' && UUID_RE.test(s);
}

export const TIMES_MORNING = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
export const TIMES_AFTERNOON = [
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
];
export const TIMES_EVENING = ['17:00', '17:30', '18:00', '18:30', '19:00'];

const BOGOTA_TZ = 'America/Bogota';

/** Calendar Y-M-D in a given IANA zone (avoids `new Date(localeString)` which breaks on Hermes/RN). */
function getYmdInTimeZone(date, timeZone) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = f.formatToParts(date);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  } catch (_) {
    /* fall through */
  }
  return null;
}

/**
 * “Today” in Bogotá as a local Date at noon (used only for calendar day + weekday).
 */
export function getTodayBogota() {
  const now = new Date();
  const ymd = getYmdInTimeZone(now, BOGOTA_TZ);
  if (ymd) {
    return new Date(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0, 0);
  }
  const l = new Date(now);
  return new Date(l.getFullYear(), l.getMonth(), l.getDate(), 12, 0, 0, 0);
}

/**
 * Current clock (hour/minute) in Bogotá for slot filtering.
 */
export function getBogotaClock(date = new Date()) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: BOGOTA_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = f.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return { hour, minute };
    }
  } catch (_) {
    /* fall through */
  }
  const l = new Date(date);
  return { hour: l.getHours(), minute: l.getMinutes() };
}

export function getDays() {
  const days = [];
  const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const monthNames = [
    'ENE',
    'FEB',
    'MAR',
    'ABR',
    'MAY',
    'JUN',
    'JUL',
    'AGO',
    'SEP',
    'OCT',
    'NOV',
    'DIC',
  ];
  const today = getTodayBogota();
  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      label: String(d.getDate()).padStart(2, '0'),
      day: dayNames[d.getDay()],
      month: monthNames[d.getMonth()],
      fullDate: d,
    });
  }
  return days;
}

export function heroNameLines(raw) {
  const s = raw.trim().replace(/-/g, ' ');
  const brand = 'TRIMMERIT';
  if (!s) return { primary: '', secondary: '' };
  const upper = s.toUpperCase();
  const parts = upper.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts.slice(1).join(' ') };
  }
  const one = parts[0];
  if (one.length > brand.length && one.endsWith(brand)) {
    return { primary: one.slice(0, -brand.length), secondary: '' };
  }
  return { primary: one, secondary: '' };
}

export function fmtPrice(price) {
  return price.toLocaleString('es-CO');
}

export function initialsFromNombre(nombre, slug) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return slug.slice(0, 2).toUpperCase();
}
