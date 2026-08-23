"use client";

import { useRef, useState } from "react";

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSend({ text: text.trim(), file });
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-line p-3">
      {file && (
        <div className="flex items-center gap-2 mb-2 text-xs text-subtext bg-panel border border-line rounded-chat px-3 py-1.5 w-fit">
          <span>📎 {file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="hover:text-danger"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          // Accepts every file type — validation/size limits happen on upload
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="h-10 w-10 shrink-0 rounded-chat bg-panel border border-line flex items-center justify-center cursor-pointer hover:bg-panelAlt transition-colors text-subtext hover:text-text"
          title="Attach a file"
        >
          📎
        </label>

        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Message…"
          className="flex-1 resize-none rounded-chat bg-panel border border-line px-3.5 py-2.5 text-sm placeholder:text-subtext/60 focus:border-signal outline-none max-h-32"
        />

        <button
          type="submit"
          disabled={disabled || (!text.trim() && !file)}
          className="h-10 px-4 shrink-0 rounded-chat bg-signal text-ink text-sm font-medium hover:bg-signalDim transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}
