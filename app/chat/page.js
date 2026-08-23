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

  const conversations = (participantRows || []).map((r) => r.conversations).filter(Boolean);

  // For 1:1 (non-AI) conversations, always resolve the *current* username of
  // the other participant, rather than trusting the stored "title" snapshot
  // (which can go stale or, if it was ever set incorrectly, stay wrong forever).
  const directConvoIds = conversations.filter((c) => !c.is_ai).map((c) => c.id);

  let otherParticipantsByConvo = {};
  if (directConvoIds.length > 0) {
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, profiles(username)")
      .in("conversation_id", directConvoIds);

    for (const row of allParticipants || []) {
      if (row.user_id === user.id) continue; // skip myself
      otherParticipantsByConvo[row.conversation_id] = row.profiles?.username || "Unknown user";
    }
  }

  const enrichedConversations = conversations.map((c) =>
    c.is_ai ? c : { ...c, title: otherParticipantsByConvo[c.id] || c.title || "Conversation" }
  );

  return <ChatShell currentUser={profile} initialConversations={enrichedConversations} />;
}
