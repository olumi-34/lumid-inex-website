// ── supabase/functions/verify-payment/index.ts ──────────────
// Verifies a Paystack payment reference server-side, then writes
// the order using the service role key (bypasses RLS safely,
// because THIS code — not the browser — decides when it's paid).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reference, orderDetails } = await req.json();

    if (!reference || !orderDetails) {
      return new Response(JSON.stringify({ error: 'Missing reference or orderDetails' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Verify the payment directly with Paystack's servers
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Payment could not be verified as successful' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Cross-check the amount Paystack actually received against what we expect
    //    (prevents someone paying for a cheaper item and claiming a pricier order)
    const paidAmountKobo = verifyData.data.amount;
    const expectedAmountKobo = Math.round(orderDetails.subtotal * 100);
    if (paidAmountKobo !== expectedAmountKobo) {
      return new Response(JSON.stringify({ error: 'Paid amount does not match order total' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Payment is genuinely verified — now write the order using the service role
    //    (this bypasses RLS, which is safe here because WE just confirmed payment,
    //    not the browser)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: insertError } = await supabaseAdmin.from('orders').insert({
      customer_name: orderDetails.name,
      customer_phone: orderDetails.phone,
      customer_email: orderDetails.email || null,
      delivery_address: orderDetails.address,
      items: orderDetails.items,
      subtotal: orderDetails.subtotal,
      status: 'paid',
      paystack_reference: reference,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Order save failed: ' + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected error: ' + err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
