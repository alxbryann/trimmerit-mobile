import Constants from 'expo-constants';
import { supabase } from './supabase';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

export function isStripeBookingEnabled() {
  const pk =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
    extra.stripePublishableKey ||
    '';
  return Boolean(String(pk).trim());
}

/**
 * Crea un PaymentIntent (Edge Function) antes de abrir Payment Sheet.
 * @param {{ barbero_id: string, fecha: string, hora: string, servicio_id: string }} payload
 */
export async function createBookingPayment(payload) {
  const { data, error } = await supabase.functions.invoke('create-booking-payment', {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

/**
 * Tras pago exitoso en el cliente, inserta la reserva verificando el PI en Stripe (Edge Function).
 */
export async function completeBookingPayment(paymentIntentId) {
  const { data, error } = await supabase.functions.invoke('complete-booking-payment', {
    body: { payment_intent_id: paymentIntentId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}
