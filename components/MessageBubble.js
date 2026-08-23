"use client";

import { createClient } from "@/lib/supabaseClient";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(type) {
  return type?.startsWith("image/");
}

export default function MessageBubble({ message, isOwn, onDeleted }) {
  const supabase = createClient();
  const isAi = message.sender_id === null;

  async function handleDelete() {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", message.id);
    if (!error && onDeleted) onDeleted(message.id);
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
      <div
        className={`relative max-w-[88%] sm:max-w-[70%] rounded-chat px-3.5 py-2.5 text-sm ${
          isOwn
            ? "bg-signal text-ink"
            : isAi
            ? "bg-ai/15 border border-ai/30 text-text"
            : "bg-panel border border-line text-text"
        }`}
      >
        {isOwn && (
          <button
            onClick={handleDelete}
            title="Delete message"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-panel border border-line text-[10px] text-subtext hover:text-danger hover:border-danger opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            ✕
          </button>
        )}

        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

        {message.file_url && (
          <div className={message.content ? "mt-2" : ""}>
            {isImage(message.file_type) ? (
              <a href={message.file_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.file_url}
                  alt={message.file_name}
                  className="rounded-chat max-h-52 max-w-full border border-line/50"
                />
              </a>
            ) : (
              <a
                href={message.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 rounded-chat px-2.5 py-2 border text-xs ${
                  isOwn ? "border-ink/20 bg-ink/10" : "border-line bg-panelAlt"
                }`}
              >
                <span>📎</span>
                <span className="truncate max-w-[160px]">{message.file_name}</span>
                <span className="opacity-60 shrink-0">{formatSize(message.file_size)}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
