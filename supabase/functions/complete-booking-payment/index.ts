import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !serviceRole) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing_auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { payment_intent_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const piId = body.payment_intent_id?.trim();
  if (!piId?.startsWith("pi_")) {
    return new Response(JSON.stringify({ error: "invalid_payment_intent" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey);
  const pi = await stripe.paymentIntents.retrieve(piId);

  if (pi.status !== "succeeded") {
    return new Response(
      JSON.stringify({ error: "payment_not_complete", status: pi.status }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const meta = pi.metadata ?? {};
  if (meta.cliente_id !== user.id) {
    return new Response(JSON.stringify({ error: "metadata_mismatch" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const barberoId = meta.barbero_id?.trim();
  const fecha = meta.fecha?.trim();
  const hora = meta.hora?.trim();
  if (!barberoId || !UUID_RE.test(barberoId) || !fecha || !hora) {
    return new Response(JSON.stringify({ error: "invalid_metadata" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);

  const { data: existing } = await admin
    .from("reservas")
    .select("id")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();

  if (existing?.id) {
    return new Response(
      JSON.stringify({ ok: true, reserva_id: existing.id, duplicate: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sid = meta.servicio_id?.trim();
  const servicioIdDb = sid && UUID_RE.test(sid) ? sid : null;
  const precioRaw = meta.precio?.trim();
  const precio = precioRaw ? Number(precioRaw) : null;

  const { data: inserted, error: insErr } = await admin
    .from("reservas")
    .insert({
      cliente_id: user.id,
      barbero_id: barberoId,
      servicio_id: servicioIdDb,
      fecha,
      hora,
      precio: precio != null && Number.isFinite(precio) ? precio : null,
      estado: "pendiente",
      stripe_payment_intent_id: pi.id,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("[complete-booking-payment]", insErr);
    return new Response(JSON.stringify({ error: "insert_failed", detail: insErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, reserva_id: inserted.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
