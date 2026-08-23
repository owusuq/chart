"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function AddParticipantModal({ conversationId, currentUserId, onClose, onAdded }) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${query.trim()}%`)
      .neq("id", currentUserId)
      .limit(10);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResults(data || []);
  }

  async function handleAdd(user) {
    setLoading(true);
    setError("");

    const { error } = await supabase.from("conversation_participants").insert({
      conversation_id: conversationId,
      user_id: user.id,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setAdded(true);
    if (onAdded) onAdded(user);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-chat p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm">Add someone to this chat</h2>
          <button onClick={onClose} className="text-subtext hover:text-text text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            className="flex-1 rounded-chat bg-panelAlt border border-line px-3 py-2 text-sm placeholder:text-subtext/60 focus:border-signal outline-none"
          />
          <button
            type="submit"
            className="rounded-chat bg-signal text-ink text-sm px-3 font-medium hover:bg-signalDim transition-colors"
          >
            Search
          </button>
        </form>

        {error && <p className="text-danger text-xs mb-2">{error}</p>}
        {loading && <p className="text-subtext text-xs mb-2">Loading…</p>}
        {added && <p className="text-signal text-xs mb-2">Added! You can add more or close.</p>}

        <div className="space-y-1 max-h-56 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => handleAdd(u)}
              className="w-full text-left px-3 py-2 rounded-chat hover:bg-panelAlt flex items-center gap-2 text-sm transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-panelAlt flex items-center justify-center text-xs">
                {u.username[0].toUpperCase()}
              </div>
              {u.username}
            </button>
          ))}
          {!loading && results.length === 0 && query && (
            <p className="text-subtext text-xs px-3 py-2">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
