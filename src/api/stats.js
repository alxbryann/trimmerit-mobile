import { supabase } from '../lib/supabase';

/**
 * Devuelve el rango [inicio, fin) (Date) que cubre el periodo seleccionado y
 * el rango previo equivalente (para comparaciones).
 * Periodos: 'dia' | 'semana' | 'mes' | 'anio'
 */
export function rangeForPeriod(periodo, ref = new Date()) {
  // Usar medianoche UTC para ser consistente con isoDate() y con cómo se almacenan
  // las fechas en Supabase (via toISOString().split('T')[0]).
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const end = new Date(start);

  switch (periodo) {
    case 'dia':
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case 'semana': {
      const day = (start.getUTCDay() + 6) % 7; // lunes = 0
      start.setUTCDate(start.getUTCDate() - day);
      end.setTime(start.getTime());
      end.setUTCDate(end.getUTCDate() + 7);
      break;
    }
    case 'anio':
      start.setUTCMonth(0, 1);
      end.setTime(start.getTime());
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;
    case 'mes':
    default:
      start.setUTCDate(1);
      end.setTime(start.getTime());
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
  }

  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span);
  const prevEnd = new Date(start);
  return { start, end, prevStart, prevEnd };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function isoStamp(d) {
  return d.toISOString();
}

/**
 * Ingresos vs Gastos agrupados en 4 puntos del periodo.
 *  - Para periodo 'mes': 4 semanas (Sem 1..Sem 4).
 *  - Para periodo 'anio': trimestres.
 *  - Para periodo 'semana': días de la semana (4 puntos: lun-mar, mié-jue, vie-sáb, dom).
 *  - Para periodo 'dia': franjas (mañana, mediodía, tarde, noche).
 */
export async function loadIngresosGastos(barberiaId, periodo) {
  const { start, end } = rangeForPeriod(periodo);
  const buckets = buildBuckets(start, end, 4, periodo);
  const barberoIds = await listBarberoIds(barberiaId);

  const [{ data: reservas }, { data: gastos }] = await Promise.all([
    supabase
      .from('reservas')
      .select('precio, fecha, hora')
      .eq('estado', 'completada')
      .gte('fecha', isoDate(start))
      .lt('fecha', isoDate(end))
      .in('barbero_id', barberoIds),
    supabase
      .from('gastos')
      .select('monto, fecha')
      .eq('barberia_id', barberiaId)
      .gte('fecha', isoDate(start))
      .lt('fecha', isoDate(end)),
  ]);

  const out = buckets.map((b) => ({ ...b, ingresos: 0, gastos: 0 }));

  for (const r of reservas ?? []) {
    // Para 'dia' combinar fecha+hora para un timestamp preciso; resto usar inicio del día.
    const when = periodo === 'dia'
      ? new Date(`${r.fecha}T${r.hora ?? '00:00'}:00`)
      : new Date(`${r.fecha}T00:00:00`);
    const i = bucketIndex(out, when);
    if (i >= 0) out[i].ingresos += Number(r.precio ?? 0);
  }

  for (const g of gastos ?? []) {
    if (periodo === 'dia') {
      // Los gastos son diarios; distribuirlos proporcionalmente en los 4 slots.
      const porSlot = Number(g.monto ?? 0) / out.length;
      out.forEach((b) => { b.gastos += porSlot; });
    } else {
      const i = bucketIndex(out, new Date(`${g.fecha}T00:00:00`));
      if (i >= 0) out[i].gastos += Number(g.monto ?? 0);
    }
  }

  return out;
}

/**
 * Ocupación: porcentaje de slots reservados sobre slots disponibles.
 * Asume duración promedio 30 min por reserva (igual que [EmpleadoBarberiaScreen.js](../screens/EmpleadoBarberiaScreen.js)).
 */
export async function loadOcupacion(barberiaId, periodo) {
  const { start, end, prevStart, prevEnd } = rangeForPeriod(periodo);

  const { data: bria } = await supabase
    .from('barberias')
    .select('hora_apertura, hora_cierre')
    .eq('id', barberiaId)
    .maybeSingle();

  const aperturaMin = parseHourMin(bria?.hora_apertura ?? '09:00');
  const cierreMin = parseHourMin(bria?.hora_cierre ?? '20:00');
  const minutosPorDia = Math.max(0, cierreMin - aperturaMin);
  const slotsPorDia = Math.floor(minutosPorDia / 30);

  const barberoIds = await listBarberoIds(barberiaId);
  if (barberoIds.length === 0) {
    return { porcentaje: 0, deltaVsPrevio: 0 };
  }

  const diasPeriodo = Math.max(1, Math.round((end - start) / 86_400_000));
  const diasPrev = Math.max(1, Math.round((prevEnd - prevStart) / 86_400_000));

  const slotsDisponibles = barberoIds.length * diasPeriodo * slotsPorDia;
  const slotsDispPrev = barberoIds.length * diasPrev * slotsPorDia;

  const [{ count: reservasNow }, { count: reservasPrev }] = await Promise.all([
    supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .in('barbero_id', barberoIds)
      .neq('estado', 'cancelada')
      .gte('fecha', isoDate(start))
      .lt('fecha', isoDate(end)),
    supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .in('barbero_id', barberoIds)
      .neq('estado', 'cancelada')
      .gte('fecha', isoDate(prevStart))
      .lt('fecha', isoDate(prevEnd)),
  ]);

  const porcentaje = slotsDisponibles > 0
    ? Math.round(((reservasNow ?? 0) / slotsDisponibles) * 100)
    : 0;
  const porcentajePrev = slotsDispPrev > 0
    ? Math.round(((reservasPrev ?? 0) / slotsDispPrev) * 100)
    : 0;

  return { porcentaje, deltaVsPrevio: porcentaje - porcentajePrev };
}

/**
 * Ticket promedio del periodo + serie de los últimos 7 días para sparkline.
 */
export async function loadTicketPromedio(barberiaId, periodo) {
  const { start, end } = rangeForPeriod(periodo);
  const barberoIds = await listBarberoIds(barberiaId);
  if (barberoIds.length === 0) {
    return { promedio: 0, tendencia: [] };
  }

  const { data } = await supabase
    .from('reservas')
    .select('precio, fecha')
    .in('barbero_id', barberoIds)
    .eq('estado', 'completada')
    .gte('fecha', isoDate(start))
    .lt('fecha', isoDate(end));

  const precios = (data ?? []).map((r) => Number(r.precio ?? 0)).filter((p) => p > 0);
  const promedio = precios.length > 0
    ? precios.reduce((a, b) => a + b, 0) / precios.length
    : 0;

  // Tendencia: avg precio por día en los últimos 7 días (UTC-consistente)
  const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const sevenAgo = new Date(todayUtc);
  sevenAgo.setUTCDate(sevenAgo.getUTCDate() - 6);
  const tomorrow = new Date(todayUtc);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const { data: trendData } = await supabase
    .from('reservas')
    .select('precio, fecha')
    .in('barbero_id', barberoIds)
    .eq('estado', 'completada')
    .gte('fecha', isoDate(sevenAgo))
    .lt('fecha', isoDate(tomorrow));

  const byDay = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenAgo);
    d.setUTCDate(d.getUTCDate() + i);
    byDay.set(isoDate(d), { sum: 0, count: 0 });
  }
  for (const r of trendData ?? []) {
    const e = byDay.get(r.fecha);
    if (e) {
      e.sum += Number(r.precio ?? 0);
      e.count += 1;
    }
  }
  const tendencia = Array.from(byDay.values()).map((e) => (e.count > 0 ? e.sum / e.count : 0));

  return { promedio, tendencia };
}

/**
 * Top servicios del periodo: cantidad de citas e ingresos por servicio.
 */
export async function loadTopServicios(barberiaId, periodo, limit = 5) {
  const { start, end } = rangeForPeriod(periodo);
  const barberoIds = await listBarberoIds(barberiaId);
  if (barberoIds.length === 0) return [];

  const { data: reservas } = await supabase
    .from('reservas')
    .select('servicio_id, precio')
    .in('barbero_id', barberoIds)
    .eq('estado', 'completada')
    .gte('fecha', isoDate(start))
    .lt('fecha', isoDate(end));

  const agg = new Map();
  for (const r of reservas ?? []) {
    if (!r.servicio_id) continue;
    const cur = agg.get(r.servicio_id) ?? { citas: 0, ingresos: 0 };
    cur.citas += 1;
    cur.ingresos += Number(r.precio ?? 0);
    agg.set(r.servicio_id, cur);
  }

  const ids = [...agg.keys()];
  if (ids.length === 0) return [];

  const { data: servicios } = await supabase
    .from('servicios')
    .select('id, nombre, icono')
    .in('id', ids);

  return (servicios ?? [])
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      icono: s.icono,
      citas: agg.get(s.id)?.citas ?? 0,
      ingresos: agg.get(s.id)?.ingresos ?? 0,
    }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, limit);
}

/**
 * Top productos vendidos: unidades del periodo + tendencia (delta vs previo).
 */
export async function loadVentaProductos(barberiaId, periodo, limit = 3) {
  const { start, end, prevStart, prevEnd } = rangeForPeriod(periodo);

  const [{ data: ventasNow }, { data: ventasPrev }] = await Promise.all([
    supabase
      .from('productos_ventas')
      .select('producto_id, unidades, monto')
      .eq('barberia_id', barberiaId)
      .gte('fecha', isoStamp(start))
      .lt('fecha', isoStamp(end)),
    supabase
      .from('productos_ventas')
      .select('producto_id, unidades')
      .eq('barberia_id', barberiaId)
      .gte('fecha', isoStamp(prevStart))
      .lt('fecha', isoStamp(prevEnd)),
  ]);

  const aggNow = new Map();
  for (const v of ventasNow ?? []) {
    const cur = aggNow.get(v.producto_id) ?? { unidades: 0, monto: 0 };
    cur.unidades += v.unidades ?? 0;
    cur.monto += Number(v.monto ?? 0);
    aggNow.set(v.producto_id, cur);
  }
  const aggPrev = new Map();
  for (const v of ventasPrev ?? []) {
    aggPrev.set(v.producto_id, (aggPrev.get(v.producto_id) ?? 0) + (v.unidades ?? 0));
  }

  const ids = [...aggNow.keys()];
  if (ids.length === 0) return [];

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, stock, imagen_url, categoria')
    .in('id', ids);

  return (productos ?? [])
    .map((p) => {
      const now = aggNow.get(p.id) ?? { unidades: 0, monto: 0 };
      const prev = aggPrev.get(p.id) ?? 0;
      const delta = prev > 0 ? Math.round(((now.unidades - prev) / prev) * 100) : (now.unidades > 0 ? 100 : 0);
      return {
        id: p.id,
        nombre: p.nombre,
        stock: p.stock,
        imagenUrl: p.imagen_url,
        categoria: p.categoria,
        unidades: now.unidades,
        monto: now.monto,
        deltaPct: delta,
        tendencia: delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat',
      };
    })
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limit);
}

// ── Helpers internos ────────────────────────────────────────────────────────

async function listBarberoIds(barberiaId) {
  const { data } = await supabase
    .from('barberos')
    .select('id')
    .eq('barberia_id', barberiaId);
  return (data ?? []).map((r) => r.id);
}

function parseHourMin(t) {
  const [h = '0', m = '0'] = String(t ?? '').split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

const DAY_ABB = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function buildBuckets(start, end, n, periodo) {
  const total = end.getTime() - start.getTime();
  const step = Math.ceil(total / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const bs = new Date(start.getTime() + step * i);
    const be = new Date(Math.min(start.getTime() + step * (i + 1), end.getTime()));
    let label;
    switch (periodo) {
      case 'dia':
        label = `${String(bs.getUTCHours()).padStart(2, '0')}h`;
        break;
      case 'semana':
        label = DAY_ABB[bs.getUTCDay()];
        break;
      case 'anio':
        label = `T${i + 1}`;
        break;
      case 'mes':
      default:
        label = `Sem ${i + 1}`;
    }
    out.push({ label, start: bs, end: be });
  }
  return out;
}

function bucketIndex(buckets, when) {
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (when >= b.start && when < b.end) return i;
  }
  return -1;
}
