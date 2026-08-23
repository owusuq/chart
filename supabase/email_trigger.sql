-- Email notification on new connection request
-- Already applied directly via the Supabase SQL Editor.
-- Kept here for reference — replace placeholders if re-running elsewhere.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_connection_request()
returns trigger as $$
begin
  perform net.http_post(
    url := ''https://ijcvckqjfohbtfybbgxv.supabase.co/functions/v1/send-request-email'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-webhook-secret'', ''YOUR-WEBHOOK-SECRET''
    ),
    body := jsonb_build_object(
      ''sender_id'', new.sender_id,
      ''receiver_id'', new.receiver_id
    )
  );
  return new;
end;
$$ language plpgsql security definer;
