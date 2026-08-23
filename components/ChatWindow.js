"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import MessageBubble from "@/components/MessageBubble";
import MessageInput from "@/components/MessageInput";
import AddParticipantModal from "@/components/AddParticipantModal";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export default function ChatWindow({ conversation, currentUser, onBack }) {
  const supabase = createClient();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState("");
  const [showAddPerson, setShowAddPerson] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (active) {
        if (error) setError(error.message);
        setMessages(data || []);
        setLoading(false);
      }
    }
    loadMessages();

    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking]);

  async function handleSend({ text, file }) {
    setError("");
    setSending(true);

    let fileMeta = {};

    try {
      if (file) {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error("File is larger than 25MB.");
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${currentUser.id}/${conversation.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET || "chat-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });

        if (uploadError) throw uploadError;

        const { data: signed } = await supabase.storage
          .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET || "chat-files")
          .createSignedUrl(path, 60 * 60 * 24 * 7);

        fileMeta = {
          file_url: signed?.signedUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        };
      }

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        content: text || null,
        ...fileMeta,
      });

      if (insertError) throw insertError;

      if (conversation.is_ai) {
        setAiThinking(true);
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversation.id }),
        });
        setAiThinking(false);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "The assistant couldn't respond.");
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-line px-5 py-3.5 flex items-center gap-2">
        <button
          onClick={onBack}
          className="sm:hidden text-subtext hover:text-text mr-1 text-lg leading-none"
        >
          ←
        </button>
        <span className="font-display font-semibold text-sm">
          {conversation.is_ai ? "Bastero" : conversation.title || "Conversation"}
        </span>
        {conversation.is_ai && (
          <span className="text-[10px] uppercase tracking-wide bg-ai/15 text-ai border border-ai/30 rounded px-1.5 py-0.5">
            AI
          </span>
        )}
        {!conversation.is_ai && (
          <button
            onClick={() => setShowAddPerson(true)}
            title="Add someone to this chat"
            className="ml-auto h-8 w-8 rounded-chat bg-panel hover:bg-panelAlt border border-line flex items-center justify-center text-subtext hover:text-text transition-colors text-sm"
          >
            +
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && <p className="text-subtext text-sm">Loading messages…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-subtext text-sm">
            {conversation.is_ai
              ? "Ask the assistant anything, or attach a file for it to look at."
              : "Say hello 👋"}
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.sender_id === currentUser.id}
            onDeleted={(id) => setMessages((prev) => prev.filter((msg) => msg.id !== id))}
          />
        ))}
        {aiThinking && (
          <div className="flex items-center gap-2 text-subtext text-sm">
            <span className="h-2 w-2 rounded-full bg-ai animate-pulse" />
            Assistant is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-danger text-xs px-5 py-1.5 bg-danger/10 border-t border-danger/20">
          {error}
        </p>
      )}

      <MessageInput onSend={handleSend} disabled={sending} />

      {showAddPerson && (
        <AddParticipantModal
          conversationId={conversation.id}
          currentUserId={currentUser.id}
          onClose={() => setShowAddPerson(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}
