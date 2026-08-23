import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import ChatShell from "@/components/ChatShell";

export default async function ChatPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: participantRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations(id, is_ai, title)")
    .eq("user_id", user.id);

  const conversations = (participantRows || []).map((r) => r.conversations);

  return <ChatShell currentUser={profile} initialConversations={conversations} />;
}
