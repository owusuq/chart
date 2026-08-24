create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_message()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'YOUR-WEBHOOK-SECRET'
    ),
    body := jsonb_build_object(
      'conversation_id', new.conversation_id,
      'sender_id', new.sender_id,
      'content', new.content
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_created on public.messages;

create trigger on_message_created
  after insert on public.messages
  for each row
  execute procedure public.notify_new_message();