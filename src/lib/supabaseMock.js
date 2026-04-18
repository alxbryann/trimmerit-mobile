/**
 * CLIENTE MOCK DE SUPABASE — BarberIT
 *
 * Replica la API de @supabase/supabase-js con datos en memoria.
 * Se activa con EXPO_PUBLIC_USE_MOCK=true en el .env
 *
 * Cuentas de prueba:
 *   cliente@test.com  / test123   → Juan Mesa (cliente)
 *   barbero@test.com  / test123   → Carlos Barbero (barbero)
 *   barbero2@test.com / test123   → Luisa Mendoza (barbero)
 */

import { buildInitialDB, MOCK_IDS } from './mockData';

// ─── Estado global del mock ──────────────────────────────────────────────────
const MOCK_USERS = {
  'cliente@test.com': {
    id: MOCK_IDS.userJuan,
    email: 'cliente@test.com',
    password: 'test123',
    user_metadata: { nombre: 'Juan Mesa', role: 'cliente' },
  },
  'barbero@test.com': {
    id: MOCK_IDS.userCarlos,
    email: 'barbero@test.com',
    password: 'test123',
    user_metadata: { nombre: 'Carlos Barbero', role: 'barbero' },
  },
  'barbero2@test.com': {
    id: MOCK_IDS.userLuisa,
    email: 'barbero2@test.com',
    password: 'test123',
    user_metadata: { nombre: 'Luisa Mendoza', role: 'barbero' },
  },
};

const mockState = {
  db: buildInitialDB(),
  currentUser: MOCK_USERS['cliente@test.com'],   // sesión activa por defecto
  authListeners: [],
};

/** Restaura la base de datos al estado inicial (útil en tests) */
export function resetMockDB() {
  mockState.db = buildInitialDB();
}

/** Cambia el usuario activo (para pruebas manuales en dev) */
export function switchMockUser(email) {
  const u = MOCK_USERS[email];
  if (!u) throw new Error(`Usuario mock no existe: ${email}`);
  mockState.currentUser = u;
  const session = buildSession(u);
  mockState.authListeners.forEach((cb) => cb('SIGNED_IN', session));
}

// ─── Helpers internos ────────────────────────────────────────────────────────
let idCounter = 1000;
function genId() {
  return `mock-${Date.now()}-${idCounter++}`;
}

function buildSession(user) {
  if (!user) return null;
  return {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
  };
}

function delay(ms = 40) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Query Builder ───────────────────────────────────────────────────────────
class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._op = 'select';
    this._payload = null;
    this._conds = [];
    this._orderCol = null;
    this._orderAsc = true;
    this._isSingle = false;
    this._isMaybe = false;
    this._selectStr = '*';
    this._upsertConflict = null;
  }

  // ── Operaciones ──
  select(cols = '*') { this._selectStr = cols; this._op = 'select'; return this; }
  insert(payload)    { this._op = 'insert'; this._payload = payload; return this; }
  update(payload)    { this._op = 'update'; this._payload = payload; return this; }
  delete()           { this._op = 'delete'; return this; }
  upsert(payload, opts) {
    this._op = 'upsert';
    this._payload = payload;
    this._upsertConflict = opts?.onConflict ?? null;
    return this;
  }

  // ── Filtros ──
  eq(col, val)   { this._conds.push({ t: 'eq',  col, val });  return this; }
  neq(col, val)  { this._conds.push({ t: 'neq', col, val });  return this; }
  in(col, vals)  { this._conds.push({ t: 'in',  col, vals }); return this; }
  gte(col, val)  { this._conds.push({ t: 'gte', col, val });  return this; }
  lte(col, val)  { this._conds.push({ t: 'lte', col, val });  return this; }
  is(col, val)   { this._conds.push({ t: 'is',  col, val });  return this; }

  // ── Orden y paginación ──
  order(col, opts = {}) { this._orderCol = col; this._orderAsc = opts.ascending !== false; return this; }
  limit(n) { this._limitN = n; return this; }

  // ── Terminadores ──
  single()      { this._isSingle = true; return this._exec(); }
  maybeSingle() { this._isMaybe  = true; return this._exec(); }

  // thenable: await queryBuilder sin .single()
  then(resolve, reject) { return this._exec().then(resolve, reject); }

  // ── Ejecución ────────────────────────────────────────────────────────────
  async _exec() {
    await delay();

    if (!mockState.db[this._table]) {
      mockState.db[this._table] = [];
    }
    const table = mockState.db[this._table];

    if (this._op === 'select') {
      let rows = this._filter([...table]);
      rows = this._sort(rows);
      if (this._limitN) rows = rows.slice(0, this._limitN);

      if (this._isMaybe) return { data: rows[0] ?? null, error: null };
      if (this._isSingle) {
        if (!rows[0]) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null };
    }

    if (this._op === 'insert') {
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      const created = items.map((p) => ({ id: genId(), created_at: new Date().toISOString(), ...p }));
      mockState.db[this._table] = [...table, ...created];
      if (this._isSingle) return { data: created[0], error: null };
      return { data: created, error: null };
    }

    if (this._op === 'update') {
      let updated = null;
      mockState.db[this._table] = table.map((row) => {
        if (this._matches(row)) {
          updated = { ...row, ...this._payload };
          return updated;
        }
        return row;
      });
      return { data: updated, error: null };
    }

    if (this._op === 'delete') {
      mockState.db[this._table] = table.filter((row) => !this._matches(row));
      return { data: null, error: null };
    }

    if (this._op === 'upsert') {
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      const conflictKey = this._upsertConflict ?? 'id';
      const updated = [];
      for (const p of items) {
        const idx = table.findIndex((r) => {
          if (conflictKey.includes(',')) {
            return conflictKey.split(',').every((k) => r[k.trim()] === p[k.trim()]);
          }
          return r[conflictKey] === p[conflictKey];
        });
        if (idx >= 0) {
          table[idx] = { ...table[idx], ...p };
          updated.push(table[idx]);
        } else {
          const newRow = { id: genId(), created_at: new Date().toISOString(), ...p };
          table.push(newRow);
          updated.push(newRow);
        }
      }
      mockState.db[this._table] = table;
      if (this._isSingle) return { data: updated[0] ?? null, error: null };
      return { data: updated, error: null };
    }

    return { data: null, error: null };
  }

  _filter(rows) {
    return rows.filter((row) =>
      this._conds.every((c) => {
        switch (c.t) {
          case 'eq':  return row[c.col] === c.val;
          case 'neq': return row[c.col] !== c.val;
          case 'in':  return (c.vals ?? []).includes(row[c.col]);
          case 'gte': return row[c.col] >= c.val;
          case 'lte': return row[c.col] <= c.val;
          case 'is':
            return c.val === null
              ? row[c.col] == null
              : row[c.col] === c.val;
          default: return true;
        }
      })
    );
  }

  _matches(row) {
    return this._conds.every((c) => {
      if (c.t === 'eq') return row[c.col] === c.val;
      return true;
    });
  }

  _sort(rows) {
    if (!this._orderCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[this._orderCol] ?? '';
      const bv = b[this._orderCol] ?? '';
      if (av < bv) return this._orderAsc ? -1 : 1;
      if (av > bv) return this._orderAsc ? 1 : -1;
      return 0;
    });
  }
}

// ─── Mock RPC ────────────────────────────────────────────────────────────────
const RPC_HANDLERS = {
  async add_loyalty_stamp({ p_reserva_id }) {
    await delay();
    const reserva = mockState.db.reservas?.find((r) => r.id === p_reserva_id);
    if (!reserva) return { ok: false, reason: 'reserva_not_found' };

    const prog = mockState.db.loyalty_programs?.find(
      (p) => p.barbero_id === reserva.barbero_id && p.activo
    );
    if (!prog) return { ok: false, reason: 'no_active_program' };

    // Verificar duplicado
    const cards = mockState.db.loyalty_cards ?? [];
    let card = cards.find(
      (c) => c.cliente_id === reserva.cliente_id && c.barbero_id === reserva.barbero_id
    );

    const stamps = mockState.db.loyalty_stamps ?? [];
    const alreadyStamped = stamps.some(
      (s) => s.reserva_id === p_reserva_id && card && s.card_id === card.id
    );
    if (alreadyStamped) return { ok: false, reason: 'already_stamped' };

    if (!card) {
      card = {
        id: genId(),
        cliente_id: reserva.cliente_id,
        barbero_id: reserva.barbero_id,
        programa_id: prog.id,
        sellos_acumulados: 0,
        canjeado_at: null,
        created_at: new Date().toISOString(),
        loyalty_programs: {
          sellos_requeridos: prog.sellos_requeridos,
          beneficio_descripcion: prog.beneficio_descripcion,
          beneficio_tipo: prog.beneficio_tipo,
          activo: true,
        },
        barberos: mockState.db.barberos?.find((b) => b.id === reserva.barbero_id)
          ? { nombre_barberia: mockState.db.barberos.find((b) => b.id === reserva.barbero_id).nombre_barberia }
          : {},
        profiles: mockState.db.profiles?.find((p) => p.id === reserva.cliente_id)
          ? { nombre: mockState.db.profiles.find((p) => p.id === reserva.cliente_id).nombre }
          : {},
      };
      mockState.db.loyalty_cards = [...cards, card];
    }

    // Añadir sello
    mockState.db.loyalty_stamps = [
      ...(mockState.db.loyalty_stamps ?? []),
      { id: genId(), card_id: card.id, reserva_id: p_reserva_id, stamped_at: new Date().toISOString() },
    ];

    // Actualizar contador
    card.sellos_acumulados += 1;
    const sellos = card.sellos_acumulados;
    const completado = sellos >= prog.sellos_requeridos;

    return {
      ok: true,
      sellos,
      requeridos: prog.sellos_requeridos,
      completado,
      beneficio: prog.beneficio_descripcion,
    };
  },

  // ─── Solicitudes de cambio ────────────────────────────────────────────────

  async cancelar_reserva({ p_reserva_id, p_razon }) {
    await delay();
    const reservas = mockState.db.reservas ?? [];
    const reserva = reservas.find((r) => r.id === p_reserva_id);
    if (!reserva) return { ok: false, reason: 'not_found' };

    const user = mockState.currentUser;
    if (reserva.barbero_id !== user.id) return { ok: false, reason: 'unauthorized' };

    // Cancelar la reserva
    reserva.estado = 'cancelada';

    // Registrar solicitud
    const sol = {
      id: genId(),
      reserva_id: p_reserva_id,
      barbero_id: reserva.barbero_id,
      cliente_id: reserva.cliente_id,
      tipo: 'cancelacion',
      estado: 'aceptado',
      razon: p_razon,
      nueva_fecha: null,
      nueva_hora: null,
      leido_cliente: false,
      leido_barbero: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // relaciones embebidas
      barberos: mockState.db.barberos?.find((b) => b.id === reserva.barbero_id)
        ? { nombre_barberia: mockState.db.barberos.find((b) => b.id === reserva.barbero_id).nombre_barberia,
            slug: mockState.db.barberos.find((b) => b.id === reserva.barbero_id).slug }
        : { nombre_barberia: 'Barbería', slug: '' },
      profiles: mockState.db.profiles?.find((p) => p.id === reserva.cliente_id)
        ? { nombre: mockState.db.profiles.find((p) => p.id === reserva.cliente_id).nombre }
        : { nombre: 'Cliente' },
    };
    mockState.db.reserva_solicitudes = [...(mockState.db.reserva_solicitudes ?? []), sol];

    return { ok: true };
  },

  async proponer_aplazamiento({ p_reserva_id, p_razon, p_nueva_fecha, p_nueva_hora }) {
    await delay();
    const reservas = mockState.db.reservas ?? [];
    const reserva = reservas.find((r) => r.id === p_reserva_id);
    if (!reserva) return { ok: false, reason: 'not_found' };

    const user = mockState.currentUser;
    if (reserva.barbero_id !== user.id) return { ok: false, reason: 'unauthorized' };

    // Marcar estado especial
    reserva.estado = 'aplazamiento_pendiente';

    // Registrar solicitud
    const sol = {
      id: genId(),
      reserva_id: p_reserva_id,
      barbero_id: reserva.barbero_id,
      cliente_id: reserva.cliente_id,
      tipo: 'aplazamiento',
      estado: 'pendiente',
      razon: p_razon,
      nueva_fecha: p_nueva_fecha,
      nueva_hora: p_nueva_hora,
      leido_cliente: false,
      leido_barbero: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      barberos: mockState.db.barberos?.find((b) => b.id === reserva.barbero_id)
        ? { nombre_barberia: mockState.db.barberos.find((b) => b.id === reserva.barbero_id).nombre_barberia,
            slug: mockState.db.barberos.find((b) => b.id === reserva.barbero_id).slug }
        : { nombre_barberia: 'Barbería', slug: '' },
      profiles: mockState.db.profiles?.find((p) => p.id === reserva.cliente_id)
        ? { nombre: mockState.db.profiles.find((p) => p.id === reserva.cliente_id).nombre }
        : { nombre: 'Cliente' },
    };
    mockState.db.reserva_solicitudes = [...(mockState.db.reserva_solicitudes ?? []), sol];

    return { ok: true };
  },

  async responder_aplazamiento({ p_solicitud_id, p_acepta }) {
    await delay();
    const sols = mockState.db.reserva_solicitudes ?? [];
    const sol = sols.find((s) => s.id === p_solicitud_id);
    if (!sol) return { ok: false, reason: 'not_found' };

    const user = mockState.currentUser;
    if (sol.cliente_id !== user.id) return { ok: false, reason: 'unauthorized' };

    const reservas = mockState.db.reservas ?? [];
    const reserva = reservas.find((r) => r.id === sol.reserva_id);

    if (p_acepta) {
      // Mover la reserva a la nueva fecha/hora propuesta
      if (reserva) {
        reserva.fecha  = sol.nueva_fecha;
        reserva.hora   = sol.nueva_hora;
        reserva.estado = 'pendiente';
      }
      sol.estado = 'aceptado';
    } else {
      // El cliente rechaza → la cita queda cancelada para ambos
      if (reserva) reserva.estado = 'cancelada';
      sol.estado = 'rechazado';
    }

    sol.leido_cliente = true;
    sol.leido_barbero = false;
    sol.updated_at = new Date().toISOString();

    return { ok: true, acepto: p_acepta };
  },

  // ─── Acciones del cliente ─────────────────────────────────────────────────

  async cancelar_reserva_cliente({ p_reserva_id }) {
    await delay();
    const reservas = mockState.db.reservas ?? [];
    const reserva = reservas.find((r) => r.id === p_reserva_id);
    if (!reserva) return { ok: false, reason: 'not_found' };

    const user = mockState.currentUser;
    if (reserva.cliente_id !== user.id) return { ok: false, reason: 'unauthorized' };
    if (!['pendiente', 'aplazamiento_pendiente'].includes(reserva.estado)) {
      return { ok: false, reason: 'invalid_state' };
    }

    reserva.estado = 'cancelada';

    const barbero = mockState.db.barberos?.find((b) => b.id === reserva.barbero_id);
    const cliente = mockState.db.profiles?.find((p) => p.id === reserva.cliente_id);
    const sol = {
      id: genId(),
      reserva_id: p_reserva_id,
      barbero_id: reserva.barbero_id,
      cliente_id: reserva.cliente_id,
      tipo: 'cancelacion_cliente',
      estado: 'aceptado',
      razon: '',
      nueva_fecha: null,
      nueva_hora: null,
      reserva_fecha: reserva.fecha,   // fecha original de la cita cancelada
      reserva_hora: reserva.hora,     // hora original de la cita cancelada
      leido_cliente: true,
      leido_barbero: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      barberos: { nombre_barberia: barbero?.nombre_barberia ?? 'Barbería', slug: barbero?.slug ?? '' },
      profiles: { nombre: cliente?.nombre ?? 'Cliente' },
    };
    mockState.db.reserva_solicitudes = [...(mockState.db.reserva_solicitudes ?? []), sol];

    return { ok: true };
  },

  async cambiar_reserva_cliente({ p_reserva_id, p_nueva_fecha, p_nueva_hora }) {
    await delay();
    const reservas = mockState.db.reservas ?? [];
    const reserva = reservas.find((r) => r.id === p_reserva_id);
    if (!reserva) return { ok: false, reason: 'not_found' };

    const user = mockState.currentUser;
    if (reserva.cliente_id !== user.id) return { ok: false, reason: 'unauthorized' };
    if (reserva.estado !== 'pendiente') return { ok: false, reason: 'invalid_state' };

    // Guardar fecha anterior antes de actualizar
    const oldFecha = reserva.fecha;
    const oldHora  = reserva.hora;

    // Actualizar fecha/hora
    reserva.fecha = p_nueva_fecha;
    reserva.hora  = p_nueva_hora;

    const barbero = mockState.db.barberos?.find((b) => b.id === reserva.barbero_id);
    const cliente = mockState.db.profiles?.find((p) => p.id === reserva.cliente_id);
    const sol = {
      id: genId(),
      reserva_id: p_reserva_id,
      barbero_id: reserva.barbero_id,
      cliente_id: reserva.cliente_id,
      tipo: 'cambio_cliente',
      estado: 'aceptado',
      razon: '',
      nueva_fecha: p_nueva_fecha,
      nueva_hora: p_nueva_hora,
      reserva_fecha: oldFecha,  // fecha anterior (antes del cambio)
      reserva_hora: oldHora,    // hora anterior (antes del cambio)
      leido_cliente: true,
      leido_barbero: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      barberos: { nombre_barberia: barbero?.nombre_barberia ?? 'Barbería', slug: barbero?.slug ?? '' },
      profiles: { nombre: cliente?.nombre ?? 'Cliente' },
    };
    mockState.db.reserva_solicitudes = [...(mockState.db.reserva_solicitudes ?? []), sol];

    return { ok: true };
  },

  async redeem_loyalty_card({ p_card_id }) {
    await delay();
    const cards = mockState.db.loyalty_cards ?? [];
    const card = cards.find((c) => c.id === p_card_id);
    if (!card) return { ok: false, reason: 'card_not_found' };

    const user = mockState.currentUser;
    if (card.barbero_id !== user.id) return { ok: false, reason: 'unauthorized' };

    const prog = mockState.db.loyalty_programs?.find((p) => p.id === card.programa_id);
    if (card.sellos_acumulados < (prog?.sellos_requeridos ?? 999)) {
      return { ok: false, reason: 'not_enough_stamps' };
    }

    // Resetear tarjeta para nuevo ciclo
    card.sellos_acumulados = 0;
    card.canjeado_at = null;

    return { ok: true, beneficio: prog?.beneficio_descripcion ?? '' };
  },
};

// ─── Mock Storage ─────────────────────────────────────────────────────────────
function createStorageBucket(bucket) {
  return {
    async upload(path, _blob, _opts) {
      await delay(100);
      return {
        data: { path },
        error: null,
      };
    },
    getPublicUrl(path) {
      return {
        data: {
          publicUrl: `https://picsum.photos/seed/${path.replace(/\//g, '_')}/400/400`,
        },
      };
    },
    async remove(_paths) {
      await delay(50);
      return { data: null, error: null };
    },
  };
}

// ─── Mock Auth ───────────────────────────────────────────────────────────────
const mockAuth = {
  async getSession() {
    await delay(20);
    const session = buildSession(mockState.currentUser);
    return { data: { session }, error: null };
  },

  async getUser() {
    await delay(20);
    const session = buildSession(mockState.currentUser);
    return { data: { user: session?.user ?? null }, error: null };
  },

  async signInWithPassword({ email, password }) {
    await delay(300);
    const user = MOCK_USERS[email];
    if (!user || user.password !== password) {
      return { data: null, error: { message: 'Email o contraseña incorrectos.' } };
    }
    mockState.currentUser = user;
    const session = buildSession(user);
    setTimeout(() => {
      mockState.authListeners.forEach((cb) => cb('SIGNED_IN', session));
    }, 50);
    return { data: { session, user: session.user }, error: null };
  },

  async signUp({ email, password, options }) {
    await delay(400);
    if (MOCK_USERS[email]) {
      return { data: null, error: { message: 'Este email ya está registrado.' } };
    }
    const metadata = options?.data ?? {};
    const newUser = {
      id: genId(),
      email,
      password,
      user_metadata: metadata,
    };
    MOCK_USERS[email] = newUser;
    // En la app real requiere verificación de email; aquí lo saltamos
    mockState.currentUser = newUser;
    const session = buildSession(newUser);
    setTimeout(() => {
      mockState.authListeners.forEach((cb) => cb('SIGNED_IN', session));
    }, 50);
    return { data: { session, user: session.user }, error: null };
  },

  async signOut() {
    await delay(100);
    mockState.currentUser = null;
    mockState.authListeners.forEach((cb) => cb('SIGNED_OUT', null));
    return { error: null };
  },

  onAuthStateChange(callback) {
    mockState.authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            mockState.authListeners = mockState.authListeners.filter((cb) => cb !== callback);
          },
        },
      },
    };
  },
};

// ─── Cliente principal ────────────────────────────────────────────────────────
export const supabaseMock = {
  auth: mockAuth,

  from(table) {
    return new QueryBuilder(table);
  },

  async rpc(funcName, params = {}) {
    await delay(50);
    const handler = RPC_HANDLERS[funcName];
    if (!handler) {
      console.warn(`[MockSupabase] RPC sin handler: ${funcName}`);
      return { data: null, error: { message: `Función no implementada en mock: ${funcName}` } };
    }
    try {
      const result = await handler(params);
      return { data: result, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  storage: {
    from(bucket) {
      return createStorageBucket(bucket);
    },
  },
};
