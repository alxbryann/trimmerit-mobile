/**
 * DATOS DUMMY — BarberIT Mock
 *
 * Dos usuarios de prueba:
 *   cliente@test.com  / test123  → Juan (cliente)
 *   barbero@test.com  / test123  → Carlos (barbero)
 *
 * La función resetMockDB() restaura el estado inicial.
 */

// ─── IDs fijos para cruzar relaciones ───────────────────────────────────────
export const MOCK_IDS = {
  userJuan:      'mock-user-juan-001',
  userCarlos:    'mock-user-carlos-001',
  userLuisa:     'mock-user-luisa-001',   // segundo barbero (para catálogo)
  userPedro:     'mock-user-pedro-001',   // segundo cliente
  barberoCarlos: 'mock-user-carlos-001',  // mismo id que user (relación 1-1)
  barberoLuisa:  'mock-user-luisa-001',
  svc1: 'mock-svc-001', svc2: 'mock-svc-002', svc3: 'mock-svc-003',
  svc4: 'mock-svc-004', svc5: 'mock-svc-005',
  res1: 'mock-res-001', res2: 'mock-res-002', res3: 'mock-res-003',
  res4: 'mock-res-004', res5: 'mock-res-005', res6: 'mock-res-006',
  prog1: 'mock-prog-001', prog2: 'mock-prog-002',
  card1: 'mock-card-001', card2: 'mock-card-002', card3: 'mock-card-003',
  sol1: 'mock-sol-001',   // cancelacion de res4 → cliente ve popup
  sol2: 'mock-sol-002',   // aplazamiento pendiente de res6 → para probar flujo cliente
  sol3: 'mock-sol-003',   // aplazamiento aceptado por Juan → barbero ve popup
  sol4: 'mock-sol-004',   // cancelacion_cliente → barbero ve popup
  sol5: 'mock-sol-005',   // cambio_cliente → barbero ve popup
};

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ─── Generador de estado inicial ─────────────────────────────────────────────
export function buildInitialDB() {
  const { MOCK_IDS: M } = { MOCK_IDS };

  return {

    profiles: [
      {
        id: MOCK_IDS.userJuan,
        nombre: 'Juan Mesa',
        telefono: '3001234567',
        role: 'cliente',
      },
      {
        id: MOCK_IDS.userCarlos,
        nombre: 'Carlos Barbero',
        telefono: '3009876543',
        role: 'barbero',
      },
      {
        id: MOCK_IDS.userLuisa,
        nombre: 'Luisa Mendoza',
        telefono: '3005551234',
        role: 'barbero',
      },
      {
        id: MOCK_IDS.userPedro,
        nombre: 'Pedro Gómez',
        telefono: '3007778888',
        role: 'cliente',
      },
    ],

    barberos: [
      {
        id: MOCK_IDS.barberoCarlos,
        slug: 'carlos-barbero',
        bio: 'Especialista en cortes clásicos y modernos. Más de 8 años de experiencia.',
        especialidades: ['fade', 'undercut', 'barba'],
        video_url: null,
        nombre_barberia: 'Barbería El Clásico',
        rating: 4.8,
        total_cortes: 312,
        color_primario: '#CDFF00',
        color_secundario: '#080808',
        // relación embebida (usado por Agenda cliente, catálogo)
        profiles: { nombre: 'Carlos Barbero' },
      },
      {
        id: MOCK_IDS.barberoLuisa,
        slug: 'luisa-mendoza',
        bio: 'Barbería urbana con estilo. Cortes creativos y diseños únicos.',
        especialidades: ['diseño', 'coloración', 'trenzas'],
        video_url: null,
        nombre_barberia: 'Studio Luisa',
        rating: 4.6,
        total_cortes: 187,
        color_primario: '#FF6B6B',
        color_secundario: '#0f0f0f',
        profiles: { nombre: 'Luisa Mendoza' },
      },
    ],

    servicios: [
      { id: MOCK_IDS.svc1, barbero_id: MOCK_IDS.barberoCarlos, nombre: 'Corte Clásico',  precio: 25000, duracion_min: 30, icono: 'cut',       activo: true },
      { id: MOCK_IDS.svc2, barbero_id: MOCK_IDS.barberoCarlos, nombre: 'Barba',          precio: 15000, duracion_min: 20, icono: 'man',       activo: true },
      { id: MOCK_IDS.svc3, barbero_id: MOCK_IDS.barberoCarlos, nombre: 'Combo Full',     precio: 35000, duracion_min: 50, icono: 'star',      activo: true },
      { id: MOCK_IDS.svc4, barbero_id: MOCK_IDS.barberoLuisa,  nombre: 'Corte Moderno',  precio: 30000, duracion_min: 40, icono: 'cut',       activo: true },
      { id: MOCK_IDS.svc5, barbero_id: MOCK_IDS.barberoLuisa,  nombre: 'Diseño',         precio: 40000, duracion_min: 60, icono: 'color-wand', activo: true },
    ],

    reservas: [
      {
        id: MOCK_IDS.res1,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoCarlos,
        servicio_id: MOCK_IDS.svc1,
        fecha: today(-3),
        hora: '10:00',
        precio: 25000,
        estado: 'completada',
        // embebido para pantalla Agenda (cliente)
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero', profiles: { nombre: 'Carlos Barbero' } },
      },
      {
        id: MOCK_IDS.res2,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoCarlos,
        servicio_id: MOCK_IDS.svc3,
        fecha: today(-10),
        hora: '14:00',
        precio: 35000,
        estado: 'completada',
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero', profiles: { nombre: 'Carlos Barbero' } },
      },
      {
        id: MOCK_IDS.res3,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoLuisa,
        servicio_id: MOCK_IDS.svc4,
        fecha: today(-5),
        hora: '11:30',
        precio: 30000,
        estado: 'completada',
        barberos: { nombre_barberia: 'Studio Luisa', slug: 'luisa-mendoza', profiles: { nombre: 'Luisa Mendoza' } },
      },
      {
        id: MOCK_IDS.res4,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoCarlos,
        servicio_id: MOCK_IDS.svc1,
        fecha: today(2),
        hora: '09:00',
        precio: 25000,
        // cancelada para disparar sol1 al cliente
        estado: 'cancelada',
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero', profiles: { nombre: 'Carlos Barbero' } },
      },
      {
        id: MOCK_IDS.res5,
        cliente_id: MOCK_IDS.userPedro,
        barbero_id: MOCK_IDS.barberoCarlos,
        servicio_id: MOCK_IDS.svc2,
        fecha: today(),
        hora: '15:30',
        precio: 15000,
        estado: 'pendiente',
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero', profiles: { nombre: 'Carlos Barbero' } },
      },
      {
        // Cita de Juan para hoy — Carlos ya propuso aplazamiento (sol2), estado consistente
        id: MOCK_IDS.res6,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoCarlos,
        servicio_id: MOCK_IDS.svc3,
        fecha: today(),
        hora: '10:00',
        precio: 35000,
        estado: 'aplazamiento_pendiente',
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero', profiles: { nombre: 'Carlos Barbero' } },
      },
    ],

    galeria_cortes: [
      { id: 'mock-gal-001', barbero_id: MOCK_IDS.barberoCarlos, imagen_url: 'https://picsum.photos/seed/barber1/400/400', tipo: 'imagen', descripcion: 'Fade clásico' },
      { id: 'mock-gal-002', barbero_id: MOCK_IDS.barberoCarlos, imagen_url: 'https://picsum.photos/seed/barber2/400/400', tipo: 'imagen', descripcion: 'Undercut moderno' },
      { id: 'mock-gal-003', barbero_id: MOCK_IDS.barberoCarlos, imagen_url: 'https://picsum.photos/seed/barber3/400/400', tipo: 'imagen', descripcion: 'Barba perfilada' },
      { id: 'mock-gal-004', barbero_id: MOCK_IDS.barberoLuisa,  imagen_url: 'https://picsum.photos/seed/luisa1/400/400',  tipo: 'imagen', descripcion: 'Diseño geométrico' },
    ],

    reseñas: [
      { id: 'mock-rev-001', reserva_id: MOCK_IDS.res1, cliente_id: MOCK_IDS.userJuan, barbero_id: MOCK_IDS.barberoCarlos, estrellas: 5, comentario: 'Excelente trabajo, muy profesional.' },
      { id: 'mock-rev-002', reserva_id: MOCK_IDS.res2, cliente_id: MOCK_IDS.userJuan, barbero_id: MOCK_IDS.barberoCarlos, estrellas: 4, comentario: 'Muy buen corte, el local muy limpio.' },
    ],

    loyalty_programs: [
      {
        id: MOCK_IDS.prog1,
        barbero_id: MOCK_IDS.barberoCarlos,
        sellos_requeridos: 8,
        beneficio_tipo: 'corte_gratis',
        beneficio_descripcion: 'Un corte clásico gratis',
        beneficio_valor: 25000,
        activo: true,
        created_at: new Date().toISOString(),
      },
      {
        id: MOCK_IDS.prog2,
        barbero_id: MOCK_IDS.barberoLuisa,
        sellos_requeridos: 6,
        beneficio_tipo: 'descuento',
        beneficio_descripcion: '50% de descuento en tu próximo corte',
        beneficio_valor: null,
        activo: true,
        created_at: new Date().toISOString(),
      },
    ],

    loyalty_cards: [
      {
        id: MOCK_IDS.card1,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoCarlos,
        programa_id: MOCK_IDS.prog1,
        sellos_acumulados: 5,
        canjeado_at: null,
        created_at: new Date().toISOString(),
        // relaciones embebidas para LoyaltyCardScreen
        loyalty_programs: {
          sellos_requeridos: 8,
          beneficio_descripcion: 'Un corte clásico gratis',
          beneficio_tipo: 'corte_gratis',
          activo: true,
        },
        barberos: { nombre_barberia: 'Barbería El Clásico', profiles: { nombre: 'Carlos Barbero' } },
        // relación para LoyaltyConfigScreen (profile del cliente)
        profiles: { nombre: 'Juan Mesa', telefono: '3001234567' },
      },
      {
        id: MOCK_IDS.card2,
        cliente_id: MOCK_IDS.userJuan,
        barbero_id: MOCK_IDS.barberoLuisa,
        programa_id: MOCK_IDS.prog2,
        sellos_acumulados: 6,   // ← completada
        canjeado_at: null,
        created_at: new Date().toISOString(),
        loyalty_programs: {
          sellos_requeridos: 6,
          beneficio_descripcion: '50% de descuento en tu próximo corte',
          beneficio_tipo: 'descuento',
          activo: true,
        },
        barberos: { nombre_barberia: 'Studio Luisa', profiles: { nombre: 'Luisa Mendoza' } },
        profiles: { nombre: 'Juan Mesa', telefono: '3001234567' },
      },
      {
        id: MOCK_IDS.card3,
        cliente_id: MOCK_IDS.userPedro,
        barbero_id: MOCK_IDS.barberoCarlos,
        programa_id: MOCK_IDS.prog1,
        sellos_acumulados: 8,   // ← completada (para que Carlos vea en su panel)
        canjeado_at: null,
        created_at: new Date().toISOString(),
        loyalty_programs: {
          sellos_requeridos: 8,
          beneficio_descripcion: 'Un corte clásico gratis',
          beneficio_tipo: 'corte_gratis',
          activo: true,
        },
        barberos: { nombre_barberia: 'Barbería El Clásico', profiles: { nombre: 'Carlos Barbero' } },
        profiles: { nombre: 'Pedro Gómez', telefono: '3007778888' },
      },
    ],

    loyalty_stamps: [
      { id: 'mock-stamp-001', card_id: MOCK_IDS.card1, reserva_id: MOCK_IDS.res1, stamped_at: new Date(Date.now() - 3*86400000).toISOString() },
      { id: 'mock-stamp-002', card_id: MOCK_IDS.card1, reserva_id: MOCK_IDS.res2, stamped_at: new Date(Date.now() - 10*86400000).toISOString() },
    ],

    // ─── Solicitudes de cambio ────────────────────────────────────────────────
    reserva_solicitudes: [
      {
        // Sol 1: barbero canceló res4 → Juan debe ver el popup al entrar a Agenda
        id: MOCK_IDS.sol1,
        reserva_id: MOCK_IDS.res4,
        barbero_id: MOCK_IDS.barberoCarlos,
        cliente_id: MOCK_IDS.userJuan,
        tipo: 'cancelacion',
        estado: 'aceptado',       // ya fue procesada (reserva quedó cancelada)
        razon: 'Tuve una emergencia familiar y no podré atenderte ese día. Disculpa los inconvenientes.',
        nueva_fecha: null,
        nueva_hora: null,
        leido_cliente: false,     // ← Juan aún no lo vio → dispara el popup
        leido_barbero: true,
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        // relaciones embebidas para el popup
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero' },
        profiles: { nombre: 'Juan Mesa' },
      },
      {
        // Sol 2: barbero propone aplazamiento para res6 (estado pendiente) — test del flujo cliente
        id: MOCK_IDS.sol2,
        reserva_id: MOCK_IDS.res6,
        barbero_id: MOCK_IDS.barberoCarlos,
        cliente_id: MOCK_IDS.userJuan,
        tipo: 'aplazamiento',
        estado: 'pendiente',
        razon: 'Me surgió un cliente anterior que se extendió. ¿Podemos mover la cita al día siguiente?',
        nueva_fecha: today(1),
        nueva_hora: '11:00',
        leido_cliente: false,     // ← Juan debe verlo también (aparece después del sol1)
        leido_barbero: true,
        created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 3600000).toISOString(),
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero' },
        profiles: { nombre: 'Juan Mesa' },
      },
      {
        // Sol 3: Juan aceptó un aplazamiento → Carlos debe ver la respuesta en su panel
        id: MOCK_IDS.sol3,
        reserva_id: MOCK_IDS.res5,
        barbero_id: MOCK_IDS.barberoCarlos,
        cliente_id: MOCK_IDS.userPedro,
        tipo: 'aplazamiento',
        estado: 'aceptado',       // Pedro aceptó
        razon: 'Necesito reagendar por motivos de agenda.',
        nueva_fecha: today(1),
        nueva_hora: '16:00',
        leido_cliente: true,
        leido_barbero: false,     // ← Carlos no lo ha leído → dispara popup en panel
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 20 * 60000).toISOString(),
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero' },
        profiles: { nombre: 'Pedro Gómez' },
      },
      {
        // Sol 4: Juan canceló su reserva → Carlos ve popup de cancelacion_cliente
        id: MOCK_IDS.sol4,
        reserva_id: MOCK_IDS.res4,
        barbero_id: MOCK_IDS.barberoCarlos,
        cliente_id: MOCK_IDS.userJuan,
        tipo: 'cancelacion_cliente',
        estado: 'aceptado',
        razon: '',
        nueva_fecha: null,
        nueva_hora: null,
        reserva_fecha: today(2),   // fecha original de res4
        reserva_hora: '09:00',     // hora original de res4
        leido_cliente: true,
        leido_barbero: false,
        created_at: new Date(Date.now() - 10 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero' },
        profiles: { nombre: 'Juan Mesa' },
      },
      {
        // Sol 5: Juan cambió fecha de res6 → Carlos ve popup de cambio_cliente
        id: MOCK_IDS.sol5,
        reserva_id: MOCK_IDS.res6,
        barbero_id: MOCK_IDS.barberoCarlos,
        cliente_id: MOCK_IDS.userJuan,
        tipo: 'cambio_cliente',
        estado: 'aceptado',
        razon: '',
        nueva_fecha: today(3),
        nueva_hora: '14:00',
        reserva_fecha: today(),     // fecha original de res6 (hoy)
        reserva_hora: '10:00',      // hora original de res6
        leido_cliente: true,
        leido_barbero: false,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 60000).toISOString(),
        barberos: { nombre_barberia: 'Barbería El Clásico', slug: 'carlos-barbero' },
        profiles: { nombre: 'Juan Mesa' },
      },
    ],

  };
}
