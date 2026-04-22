-- Stripe: id de PaymentIntent asociado a la reserva (único para evitar doble uso)
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS reservas_stripe_payment_intent_id_key
  ON reservas (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
