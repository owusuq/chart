// Supabase Edge Function: send-push-notification
//
// Called automatically (via a DB trigger + pg_net) whenever a new row is
// inserted into public.messages. Looks up everyone else in that
// conversation, and sends each of their subscribed devices a real
// Web Push notification (works even if the site/browser is closed).
//
// Secrets needed (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      - e.g. mailto:you@example.com
//   WEBHOOK_SECRET     - same shared secret used by send-request-email
//   APP_URL            - e.g. https://your-app.vercel.app
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY - auto-provided by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:example@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY"),
  Deno.env.get("VAPID_PRIVATE_KEY")
);

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const payload = await req.json();
    const { conversation_id, sender_id, content } = payload;

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "Missing conversation_id" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id, profiles(username)")
      .eq("conversation_id", conversation_id);

    const recipients = (participants || []).filter((p) => p.user_id !== sender_id);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }));
    }

    let senderName = "Someone";
    if (sender_id) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", sender_id)
        .single();
      senderName = senderProfile?.username ?? "Someone";
    } else {
      senderName = "Bastero";
    }

    const bodyPreview = (content || "").slice(0, 120);

    let sent = 0;
    for (const recipient of recipients) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", recipient.user_id);

      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: senderName,
              body: bodyPreview,
              url: APP_URL + "/chat",
              tag: "conversation-" + conversation_id,
            })
          );
          sent++;
        } catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});