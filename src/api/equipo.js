import { supabase } from '../lib/supabase';

/**
 * Carga las estadísticas de equipo para un rango de fechas.
 * @param {string} barberiaId
 * @param {Date} start  — inicio del período (UTC midnight)
 * @param {Date} end    — fin del período (UTC midnight, exclusivo)
 * @returns {{ resumen, barberos }}
 */
export async function loadEquipoStats(barberiaId, start, end) {
  const startStr = isoDate(start);
  const endStr   = isoDate(end);

  // 1. Barberos de la barbería con su % individual y perfil
  const { data: barberosRaw } = await supabase
    .from('barberos')
    .select('id, comision_pct, especialidad, profiles(nombre, avatar_url)')
    .eq('barberia_id', barberiaId);

  // 2. Config global de comisión
  const { data: bria } = await supabase
    .from('barberias')
    .select('hora_apertura, hora_cierre, comision_default_pct')
    .eq('id', barberiaId)
    .maybeSingle();

  const defaultPct = bria?.comision_default_pct ?? 50;

  if (!barberosRaw || barberosRaw.length === 0) {
    return { resumen: { totalServicios: 0, comisionesPendientes: 0, ocupacionPromedio: 0 }, barberos: [] };
  }

  const barberoIds = barberosRaw.map((b) => b.id);

  // 3. Reservas completadas en el período
  const { data: reservas } = await supabase
    .from('reservas')
    .select('id, barbero_id, cliente_id, precio, fecha, hora')
    .in('barbero_id', barberoIds)
    .eq('estado', 'completada')
    .gte('fecha', startStr)
    .lt('fecha', endStr);

  // 4. Reservas ANTES del período para calcular fidelidad (clientes fijos)
  const { data: prevReservas } = await supabase
    .from('reservas')
    .select('barbero_id, cliente_id')
    .in('barbero_id', barberoIds)
    .eq('estado', 'completada')
    .lt('fecha', startStr);

  // 5. Comisiones ya pagadas en este rango
  const { data: pagos } = await supabase
    .from('comisiones_pagos')
    .select('barbero_id, monto')
    .eq('barberia_id', barberiaId)
    .gte('periodo_inicio', startStr)
    .lte('periodo_fin', endStr);

  // 6. Calcular slots disponibles por barbero
  const aperturaMin = parseHourMin(bria?.hora_apertura ?? '09:00');
  const cierreMin   = parseHourMin(bria?.hora_cierre   ?? '20:00');
  const slotsPorDia = Math.max(1, Math.floor((cierreMin - aperturaMin) / 30));
  const diasPeriodo = Math.max(1, Math.round((end - start) / 86_400_000));
  const slotsTotal  = slotsPorDia * diasPeriodo;

  // Agrupar reservas por barbero
  const resByBarbero = new Map();
  for (const r of reservas ?? []) {
    const arr = resByBarbero.get(r.barbero_id) ?? [];
    arr.push(r);
    resByBarbero.set(r.barbero_id, arr);
  }

  // Clientes previos por barbero
  const prevClientesByBarbero = new Map();
  for (const r of prevReservas ?? []) {
    const set = prevClientesByBarbero.get(r.barbero_id) ?? new Set();
    set.add(r.cliente_id);
    prevClientesByBarbero.set(r.barbero_id, set);
  }

  // Pagos por barbero
  const pagosByBarbero = new Map();
  for (const p of pagos ?? []) {
    pagosByBarbero.set(p.barbero_id, (pagosByBarbero.get(p.barbero_id) ?? 0) + Number(p.monto));
  }

  // Construir stats por barbero
  const barberos = barberosRaw.map((b) => {
    const res     = resByBarbero.get(b.id) ?? [];
    const ingresos = res.reduce((s, r) => s + Number(r.precio ?? 0), 0);
    const pct      = b.comision_pct ?? defaultPct;
    const comisionTotal    = Math.round(ingresos * pct / 100);
    const comisionPagada   = pagosByBarbero.get(b.id) ?? 0;
    const comisionPendiente = Math.max(0, comisionTotal - comisionPagada);

    const ocupacion = slotsTotal > 0 ? Math.min(100, Math.round((res.length / slotsTotal) * 100)) : 0;

    // Fidelidad
    const prevClientes = prevClientesByBarbero.get(b.id) ?? new Set();
    const clientesUnicos = new Set(res.map((r) => r.cliente_id));
    const fijos = [...clientesUnicos].filter((c) => prevClientes.has(c)).length;
    const total = clientesUnicos.size;
    const fijosPct  = total > 0 ? Math.round((fijos  / total) * 100) : 0;
    const flujoPct  = 100 - fijosPct;

    return {
      id:                 b.id,
      nombre:             b.profiles?.nombre ?? 'Barbero',
      avatarUrl:          b.profiles?.avatar_url ?? null,
      especialidad:       b.especialidad ?? null,
      comisionPct:        pct,
      servicios:          res.length,
      ingresos,
      comisionTotal,
      comisionPendiente,
      comisionPagada,
      ocupacion,
      fijosPct,
      flujoPct,
    };
  }).sort((a, b) => b.servicios - a.servicios);

  // Resumen global
  const totalServicios       = barberos.reduce((s, b) => s + b.servicios, 0);
  const comisionesPendientes = barberos.reduce((s, b) => s + b.comisionPendiente, 0);
  const ocupacionPromedio    = barberos.length > 0
    ? Math.round(barberos.reduce((s, b) => s + b.ocupacion, 0) / barberos.length)
    : 0;

  return { resumen: { totalServicios, comisionesPendientes, ocupacionPromedio }, barberos };
}

/**
 * Registra el pago de comisión a un barbero.
 */
export async function marcarComisionPagada({ barberiaId, barberoId, monto, periodoInicio, periodoFin }) {
  const { error } = await supabase.from('comisiones_pagos').insert({
    barberia_id:    barberiaId,
    barbero_id:     barberoId,
    monto,
    periodo_inicio: isoDate(periodoInicio),
    periodo_fin:    isoDate(periodoFin),
    pagado_en:      new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Carga la config de comisiones de la barbería (% global + overrides por barbero).
 */
export async function loadComisionConfig(barberiaId) {
  const [{ data: bria }, { data: barberos }] = await Promise.all([
    supabase.from('barberias').select('comision_default_pct').eq('id', barberiaId).maybeSingle(),
    supabase.from('barberos').select('id, comision_pct, profiles(nombre)').eq('barberia_id', barberiaId),
  ]);
  return {
    defaultPct: bria?.comision_default_pct ?? 50,
    barberos: (barberos ?? []).map((b) => ({
      id: b.id,
      nombre: b.profiles?.nombre ?? 'Barbero',
      comisionPct: b.comision_pct ?? null,
    })),
  };
}

/**
 * Guarda la config de comisiones.
 */
export async function saveComisionConfig({ barberiaId, defaultPct, overrides }) {
  const updates = [
    supabase.from('barberias').update({ comision_default_pct: defaultPct }).eq('id', barberiaId),
    ...overrides.map(({ id, pct }) =>
      supabase.from('barberos').update({ comision_pct: pct }).eq('id', id),
    ),
  ];
  await Promise.all(updates);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : d;
}

function parseHourMin(t) {
  const [h = '0', m = '0'] = String(t ?? '').split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}
