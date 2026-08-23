"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

// Builds a lookup of "how do I stand with this user" from the raw
// connection_requests rows (I might be the sender or the receiver).
function buildStatusMap(requests, myId) {
  const map = new Map();
  for (const r of requests) {
    const otherId = r.sender_id === myId ? r.receiver_id : r.sender_id;
    const iAmSender = r.sender_id === myId;
    map.set(otherId, {
      requestId: r.id,
      status: r.status, // pending | accepted | declined
      iAmSender,
      conversationId: r.conversation_id,
    });
  }
  return map;
}

export default function PeopleModal({ currentUserId, onClose, onOpenConversation, initialTab = "people" }) {
  const supabase = createClient();
  const [tab, setTab] = useState(initialTab); // "people" | "requests"
  const [people, setPeople] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");

    const [{ data: profiles, error: profilesError }, { data: requests, error: requestsError }] =
      await Promise.all([
        supabase.from("profiles").select("id, username").neq("id", currentUserId).order("username"),
        supabase
          .from("connection_requests")
          .select("id, sender_id, receiver_id, status, conversation_id")
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`),
      ]);

    setLoading(false);

    if (profilesError || requestsError) {
      setError((profilesError || requestsError).message);
      return;
    }

    setPeople(profiles || []);
    setStatusMap(buildStatusMap(requests || [], currentUserId));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendRequest(otherUser) {
    setBusyId(otherUser.id);
    setError("");

    const { data, error } = await supabase
      .from("connection_requests")
      .insert({ sender_id: currentUserId, receiver_id: otherUser.id, status: "pending" })
      .select()
      .single();

    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }

    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(otherUser.id, { requestId: data.id, status: "pending", iAmSender: true, conversationId: null });
      return next;
    });
  }

  async function acceptRequest(otherId, entry) {
    setBusyId(otherId);
    setError("");

    // Creates the conversation, adds both participants, and marks the
    // request accepted — all atomically, server-side, so we never hit the
    // RLS visibility race (or leave an orphaned conversation) that the old
    // three-step client-side version did.
    const { data: conv, error: acceptError } = await supabase.rpc("accept_connection_request", {
      request_id: entry.requestId,
    });

    setBusyId(null);
    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(otherId, { ...entry, status: "accepted", conversationId: conv.id });
      return next;
    });

    onOpenConversation(conv);
    onClose();
  }

  async function declineRequest(otherId, entry) {
    setBusyId(otherId);
    setError("");

    const { error: updateError } = await supabase
      .from("connection_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", entry.requestId);

    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(otherId, { ...entry, status: "declined" });
      return next;
    });
  }

  function openExistingChat(entry) {
    if (!entry?.conversationId) return;
    onOpenConversation({ id: entry.conversationId, is_ai: false, title: undefined });
    onClose();
  }

  const incomingPending = people
    .map((p) => ({ person: p, entry: statusMap.get(p.id) }))
    .filter(({ entry }) => entry?.status === "pending" && !entry.iAmSender);

  const peopleToShow = tab === "requests" ? incomingPending.map((r) => r.person) : people;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-chat p-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm">People</h2>
          <button onClick={onClose} className="text-subtext hover:text-text text-sm">
            ✕
          </button>
        </div>

        <div className="flex gap-1 mb-3 bg-panelAlt rounded-chat p-1">
          <button
            onClick={() => setTab("people")}
            className={`flex-1 text-xs font-medium rounded-chat py-1.5 transition-colors ${
              tab === "people" ? "bg-signal text-ink" : "text-subtext hover:text-text"
            }`}
          >
            Everyone
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 text-xs font-medium rounded-chat py-1.5 transition-colors relative ${
              tab === "requests" ? "bg-signal text-ink" : "text-subtext hover:text-text"
            }`}
          >
            Requests
            {incomingPending.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] leading-none">
                {incomingPending.length}
              </span>
            )}
          </button>
        </div>

        {error && <p className="text-danger text-xs mb-2">{error}</p>}
        {loading && <p className="text-subtext text-xs mb-2">Loading…</p>}

        <div className="space-y-1 overflow-y-auto flex-1">
          {!loading && peopleToShow.length === 0 && (
            <p className="text-subtext text-xs px-3 py-2">
              {tab === "requests" ? "No pending requests." : "No one else has signed up yet."}
            </p>
          )}

          {peopleToShow.map((u) => {
            const entry = statusMap.get(u.id);
            const isBusy = busyId === u.id;

            return (
              <div
                key={u.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-chat hover:bg-panelAlt transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-panelAlt flex items-center justify-center text-xs shrink-0">
                  {u.username[0].toUpperCase()}
                </div>
                <span className="text-sm flex-1 truncate">{u.username}</span>

                {!entry && (
                  <button
                    disabled={isBusy}
                    onClick={() => sendRequest(u)}
                    className="text-xs rounded-chat bg-signal text-ink px-2.5 py-1.5 font-medium hover:bg-signalDim transition-colors disabled:opacity-60 shrink-0"
                  >
                    {isBusy ? "…" : "Send request"}
                  </button>
                )}

                {entry?.status === "pending" && entry.iAmSender && (
                  <span className="text-xs text-subtext px-2 py-1.5 shrink-0">Requested</span>
                )}

                {entry?.status === "pending" && !entry.iAmSender && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      disabled={isBusy}
                      onClick={() => acceptRequest(u.id, entry)}
                      className="text-xs rounded-chat bg-signal text-ink px-2.5 py-1.5 font-medium hover:bg-signalDim transition-colors disabled:opacity-60"
                    >
                      {isBusy ? "…" : "Accept"}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => declineRequest(u.id, entry)}
                      className="text-xs rounded-chat bg-panelAlt border border-line px-2.5 py-1.5 font-medium hover:text-danger transition-colors disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {entry?.status === "accepted" && (
                  <button
                    onClick={() => openExistingChat(entry)}
                    className="text-xs rounded-chat bg-panelAlt border border-line px-2.5 py-1.5 font-medium hover:border-signal hover:text-signal transition-colors shrink-0"
                  >
                    Message
                  </button>
                )}

                {entry?.status === "declined" && (
                  <span className="text-xs text-subtext px-2 py-1.5 shrink-0">Declined</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
