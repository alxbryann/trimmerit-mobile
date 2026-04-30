/**
 * s3Upload.js — helpers para subir/borrar archivos en AWS S3
 *
 * Flujo seguro (las credenciales AWS nunca llegan al cliente):
 *   1. Valida MIME type y tamaño localmente (solo UX — el servidor también valida)
 *   2. Pide una presigned PUT URL a la Edge Function `s3-presign`
 *   3. Sube el archivo directamente a S3 con un plain fetch PUT
 *   4. Devuelve la URL pública del objeto
 *
 * OWASP cubierto:
 *   A01 — credentials nunca en el bundle (EXPO_PUBLIC_* son solo URL y anon key)
 *   A02 — token va en header Authorization, no en query params ni logs
 *   A03 — MIME type pre-validado en cliente (UX) y en servidor (seguridad real)
 *   A04 — tamaño máximo validado antes de iniciar el upload
 */

import { supabase, supabaseConfigured } from './supabase';

// ─── Constantes ────────────────────────────────────────────────────────────────
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const PRESIGN_FN = `${SUPABASE_URL}/functions/v1/s3-presign`;

// OWASP A03: Allowlist de tipos permitidos (espejo del servidor — para feedback rápido al usuario)
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ALLOWED_TYPES = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);

// OWASP A04: Límites de tamaño (espejo del servidor)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB

// ─── Validación cliente (UX pre-check) ────────────────────────────────────────
/**
 * Valida MIME type y tamaño antes de llamar al servidor.
 * Es solo UX — el servidor hace la validación real.
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateFile(mimeType, fileSize) {
  if (!ALLOWED_TYPES.has(mimeType)) {
    return { ok: false, error: `Tipo de archivo no permitido: ${mimeType}` };
  }
  const isVideo = ALLOWED_VIDEO_TYPES.has(mimeType);
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (fileSize && fileSize > maxBytes) {
    const maxMB = Math.round(maxBytes / 1024 / 1024);
    return { ok: false, error: `El archivo supera el límite de ${maxMB} MB` };
  }
  return { ok: true };
}

// ─── uploadToS3 ────────────────────────────────────────────────────────────────
/**
 * Sube un archivo local a S3 y devuelve su URL pública.
 *
 * @param {string} localUri     - URI local del archivo (expo-image-picker asset.uri)
 * @param {string} s3Path       - Ruta dentro del bucket, ej: "USER_ID/hero.mp4"
 * @param {string} contentType  - MIME type, ej: "video/mp4" o "image/jpeg"
 * @param {number} [fileSize]   - Tamaño en bytes (opcional, para validación previa)
 * @returns {Promise<string>}   URL pública del objeto en S3
 */
export async function uploadToS3(localUri, s3Path, contentType, fileSize) {
  if (USE_MOCK || !supabaseConfigured) {
    const seed = Math.floor(Math.random() * 1000);
    return `https://picsum.photos/seed/${seed}/600/600`;
  }

  // OWASP A03: Pre-validar en cliente antes de ir al servidor
  const validation = validateFile(contentType, fileSize);
  if (!validation.ok) throw new Error(validation.error);

  // OWASP A02/A07: Token siempre desde la sesión activa, nunca hardcodeado
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No hay sesión activa. Vuelve a iniciar sesión.');

  // Pedir presigned URL al servidor (el servidor re-valida todo)
  const presignRes = await fetch(PRESIGN_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,  // OWASP A02: header, no query param
    },
    body: JSON.stringify({ action: 'upload', path: s3Path, contentType, fileSize }),
  });

  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    // OWASP A09: log del error para debugging, sin exponer el token
    console.warn('[s3Upload] presign error:', presignRes.status, body.error);
    throw new Error(body.error ?? `Error al preparar la subida (${presignRes.status})`);
  }

  const { uploadUrl, publicUrl } = await presignRes.json();

  // Subir directamente a S3 con la presigned URL
  const blob = await (await fetch(localUri)).blob();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });

  if (!uploadRes.ok) {
    console.warn('[s3Upload] S3 PUT error:', uploadRes.status);
    throw new Error(`Error al subir el archivo (${uploadRes.status})`);
  }

  return publicUrl;
}

// ─── deleteFromS3 ──────────────────────────────────────────────────────────────
/**
 * Borra un objeto de S3.
 * @param {string} s3Path - Ruta dentro del bucket, ej: "USER_ID/galeria/foto.jpg"
 */
export async function deleteFromS3(s3Path) {
  if (USE_MOCK || !supabaseConfigured || !s3Path) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const res = await fetch(PRESIGN_FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: 'delete', path: s3Path }),
  });

  if (!res.ok) {
    console.warn('[s3Upload] delete error:', res.status);
  }
}

// ─── extractS3Path ─────────────────────────────────────────────────────────────
/**
 * Extrae la Key relativa de una URL pública de S3.
 * "https://trimmerit-media.s3.sa-east-1.amazonaws.com/USER_ID/galeria/foto.jpg"
 *  → "USER_ID/galeria/foto.jpg"
 */
export function extractS3Path(publicUrl) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
  } catch {
    return null;
  }
}
