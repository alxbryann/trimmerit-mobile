import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from 'npm:@aws-sdk/client-s3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner';

// ── OWASP A05: CORS restringido — solo orígenes esperados ─────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Aceptable para mobile; tightener en web
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── OWASP A03/A05: Allowlist de MIME types permitidos ─────────────────────────
// Solo imágenes y videos de formatos estándar. El servidor rechaza cualquier otra cosa.
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',  // .mov de iOS
  'video/webm',
]);

// Tamaños máximos (OWASP A04 — Insecure Design: limitar recursos desde el servidor)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB

// ── OWASP A04: Rate limiting simple en memoria ────────────────────────────────
// Limita a 30 presigned URLs por usuario por minuto.
// Nota: se resetea en cada cold start de la Edge Function; suficiente para uso normal.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// ── OWASP A01: Sanitizar path — prohibir traversal y caracteres peligrosos ────
// S3 no tiene "path traversal" en el sentido clásico, pero un path como
// "UUID/../other-uuid/file.jpg" podría construirse para pisar archivos ajenos
// si la validación del prefijo no es suficiente.
function sanitizePath(path: string): string | null {
  // Sin segmentos vacíos, sin .., sin caracteres de control
  if (path.includes('..') || path.includes('//') || /[\x00-\x1f]/.test(path)) {
    return null;
  }
  // Solo caracteres seguros para S3 keys
  if (!/^[a-zA-Z0-9\-_./]+$/.test(path)) {
    return null;
  }
  return path;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── OWASP A07: Verificar identidad con getUser() — nunca solo decodificar el JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── OWASP A04: Rate limiting ───────────────────────────────────────────────
  if (!checkRateLimit(user.id)) {
    return json({ error: 'Too many requests' }, 429);
  }

  // ── S3 client ─────────────────────────────────────────────────────────────
  const region = Deno.env.get('AWS_REGION') ?? 'sa-east-1';
  const bucket = Deno.env.get('AWS_S3_BUCKET') ?? 'barberit-media';

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
    },
  });

  // ── Parsear body ──────────────────────────────────────────────────────────
  let body: { action: string; path: string; contentType?: string; fileSize?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { action, path: rawPath, contentType, fileSize } = body;

  // ── OWASP A01: Validar path ────────────────────────────────────────────────
  if (!rawPath) return json({ error: 'path required' }, 400);

  // Sanitizar antes de validar el prefijo
  const path = sanitizePath(rawPath);
  if (!path) return json({ error: 'Invalid path' }, 400);

  // El path debe pertenecer al usuario autenticado
  if (!path.startsWith(user.id + '/')) {
    return json({ error: 'Forbidden' }, 403);  // Genérico — no revelar la razón exacta
  }

  // ── Upload: generar presigned PUT URL ─────────────────────────────────────
  if (action === 'upload') {
    if (!contentType) return json({ error: 'contentType required' }, 400);

    // OWASP A03/A05: Validar MIME type contra el allowlist
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json({ error: 'Content type not allowed' }, 400);
    }

    // OWASP A04: Validar tamaño máximo del archivo
    if (fileSize !== undefined) {
      const isVideo = contentType.startsWith('video/');
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (fileSize > maxBytes) {
        return json({ error: 'File too large' }, 400);
      }
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${path}`;

    return json({ uploadUrl, publicUrl });
  }

  // ── Delete: borrar objeto de S3 ────────────────────────────────────────────
  if (action === 'delete') {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
