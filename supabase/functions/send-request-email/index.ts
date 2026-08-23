// Supabase Edge Function: send-request-email
//
// Called automatically (via a DB trigger + pg_net) whenever a new row is
// inserted into public.connection_requests. Looks up both users, then
// emails the receiver letting them know someone wants to connect.
//
// Secrets set in Supabase Dashboard > Edge Functions > Secrets:
//   RESEND_API_KEY   - from resend.com
//   WEBHOOK_SECRET    - shared secret checked against the DB trigger
//   APP_URL           - e.g. https://your-app.vercel.app
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY - auto-provided by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const payload = await req.json();
    const { sender_id, receiver_id } = payload;

    if (!sender_id || !receiver_id) {
      return new Response(JSON.stringify({ error: "Missing sender_id/receiver_id" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: sender }, { data: receiverAuth }, { data: receiverProfile }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", sender_id).single(),
      supabase.auth.admin.getUserById(receiver_id),
      supabase.from("profiles").select("username").eq("id", receiver_id).single(),
    ]);

    const receiverEmail = receiverAuth?.user?.email;
    if (!receiverEmail) {
      return new Response(JSON.stringify({ error: "Receiver has no email on file" }), { status: 404 });
    }

    const senderName = sender?.username ?? "Someone";
    const receiverName = receiverProfile?.username ?? "";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Signal <onboarding@resend.dev>",
        to: [receiverEmail],
        subject: `${senderName} wants to connect on Signal`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>New connection request</h2>
            <p>Hi ${receiverName || "there"},</p>
            <p><strong>${senderName}</strong> sent you a request on Signal.</p>
            <p><a href="${APP_URL}/chat" style="display:inline-block;background:#4FD1C5;color:#0B0E14;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open Signal to respond</a></p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return new Response(JSON.stringify({ error: "Resend failed", detail: errText }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
