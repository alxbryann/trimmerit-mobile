import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Precios por defecto (mismo criterio que `src/utils/booking.js` — servicios sin fila en DB). */
const DEFAULT_PRICES_COP: Record<string, number> = {
  corte: 40000,
  barba: 30000,
  combo: 65000,
};

function copMajorToStripeMinor(pesos: number): number {
  return Math.round(Number(pesos) * 100);
}

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
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "stripe_not_configured" }), {
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

  let body: {
    barbero_id?: string;
    fecha?: string;
    hora?: string;
    servicio_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const barberoId = body.barbero_id?.trim();
  const fecha = body.fecha?.trim();
  const hora = body.hora?.trim();
  const servicioRef = body.servicio_id?.trim();

  if (!barberoId || !UUID_RE.test(barberoId) || !fecha || !hora || !servicioRef) {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let precioMajor: number;
  let servicioUuid: string | null = null;

  if (UUID_RE.test(servicioRef)) {
    const { data: row, error: qErr } = await supabaseAuth
      .from("servicios")
      .select("id, precio")
      .eq("id", servicioRef)
      .eq("barbero_id", barberoId)
      .eq("activo", true)
      .maybeSingle();

    if (qErr || !row?.precio) {
      return new Response(JSON.stringify({ error: "servicio_not_found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    precioMajor = Number(row.precio);
    servicioUuid = row.id;
  } else {
    const p = DEFAULT_PRICES_COP[servicioRef];
    if (p == null || !Number.isFinite(p) || p <= 0) {
      return new Response(JSON.stringify({ error: "invalid_servicio_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    precioMajor = p;
  }

  const amount = copMajorToStripeMinor(precioMajor);
  if (!Number.isFinite(amount) || amount < 1) {
    return new Response(JSON.stringify({ error: "amount_too_low" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey);

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "cop",
    automatic_payment_methods: { enabled: true },
    metadata: {
      cliente_id: user.id,
      barbero_id: barberoId,
      fecha,
      hora,
      precio: String(precioMajor),
      servicio_id: servicioUuid ?? "",
      servicio_key: servicioUuid ? "" : servicioRef,
    },
  });

  if (!paymentIntent.client_secret) {
    return new Response(JSON.stringify({ error: "no_client_secret" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
