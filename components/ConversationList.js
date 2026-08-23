"use client";

export default function ConversationList({ conversations, activeId, onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto py-2">
      {conversations.length === 0 && (
        <p className="text-subtext text-xs px-4 py-3">No conversations yet.</p>
      )}
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
            activeId === conv.id ? "bg-panel" : "hover:bg-panel/50"
          }`}
        >
          <div
            className={`h-9 w-9 rounded-chat flex items-center justify-center text-sm font-medium shrink-0 ${
              conv.is_ai
                ? "bg-ai/15 text-ai border border-ai/30"
                : "bg-panelAlt text-text border border-line"
            }`}
          >
            {conv.is_ai ? "AI" : conv.title?.[0]?.toUpperCase() || "#"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {conv.is_ai ? "Bastero" : conv.title || "Conversation"}
            </p>
            <p className="text-xs text-subtext truncate">
              {conv.is_ai ? "Always available" : "Direct message"}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
