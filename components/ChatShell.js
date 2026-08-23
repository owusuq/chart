"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import PeopleModal from "@/components/PeopleModal";

export default function ChatShell({ currentUser, initialConversations }) {
  const router = useRouter();
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] = useState(
    initialConversations.find((c) => c.is_ai) || initialConversations[0] || null
  );
  const [showPeople, setShowPeople] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshPendingCount() {
    const { count } = await supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");
    setPendingCount(count || 0);
  }

  useEffect(() => {
    refreshPendingCount();

    // Live-update the badge when someone sends/accepts a request.
    const channel = supabase
      .channel("connection_requests_badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        () => refreshPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function openConversation(conv) {
    // We may only have the id + is_ai (e.g. reopening an already-accepted
    // connection) — resolve the current name of the other participant
    // rather than trusting any stale "title" snapshot.
    let full = conv;
    const existing = conversations.find((c) => c.id === conv.id);

    if (existing) {
      full = existing;
    } else if (!full.is_ai) {
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id, profiles(username)")
        .eq("conversation_id", conv.id);

      const other = (participants || []).find((p) => p.user_id !== currentUser.id);
      full = { id: conv.id, is_ai: false, title: other?.profiles?.username || "Conversation" };
    }

    setConversations((prev) => (prev.some((c) => c.id === full.id) ? prev : [...prev, full]));
    setActiveConversation(full);
    setShowChatOnMobile(true);
    refreshPendingCount();
  }

  function selectConversation(conv) {
    setActiveConversation(conv);
    setShowChatOnMobile(true);
  }

  return (
    <main className="h-dvh flex bg-ink text-text overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`w-full sm:w-72 sm:shrink-0 border-r border-line flex-col h-full ${
          showChatOnMobile ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-chat bg-signal/10 border border-signal/30 flex items-center justify-center">
              <span className="text-signal font-display font-bold text-sm">S</span>
            </div>
            <span className="font-display font-semibold text-sm">Signal</span>
          </div>
          <button
            onClick={() => setShowPeople(true)}
            title="People"
            className="relative h-8 w-8 rounded-chat bg-panel hover:bg-panelAlt border border-line flex items-center justify-center text-subtext hover:text-text transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] leading-4 text-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        <ConversationList
          conversations={conversations}
          activeId={activeConversation?.id}
          onSelect={selectConversation}
          currentUserId={currentUser.id}
        />

        <div className="border-t border-line px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-panelAlt flex items-center justify-center text-xs font-medium shrink-0">
              {currentUser.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm truncate">{currentUser.username}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-subtext hover:text-danger transition-colors shrink-0"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main chat window */}
      <section
        className={`flex-1 min-w-0 h-full ${showChatOnMobile ? "flex" : "hidden sm:flex"} flex-col`}
      >
        {activeConversation ? (
          <ChatWindow
            key={activeConversation.id}
            conversation={activeConversation}
            currentUser={currentUser}
            onBack={() => setShowChatOnMobile(false)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-subtext text-sm">
            Select or start a conversation
          </div>
        )}
      </section>

      {showPeople && (
        <PeopleModal
          currentUserId={currentUser.id}
          onClose={() => setShowPeople(false)}
          onOpenConversation={openConversation}
          initialTab={pendingCount > 0 ? "requests" : "people"}
        />
      )}
    </main>
  );
}
