"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

export default function ConfirmPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace("#", "?"));
    const hashError = hash.get("error_description");

    if (hashError) {
      setStatus("error");
      setMessage(decodeURIComponent(hashError.replace(/\+/g, " ")));
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("success");
        setTimeout(() => router.push("/chat"), 1500);
      } else {
        setStatus("error");
        setMessage("This confirmation link is invalid or has already been used.");
      }
    });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-chat bg-signal/10 border border-signal/30 mb-4">
          <span className="text-signal font-display font-bold">S</span>
        </div>

        {status === "checking" && (
          <>
            <h1 className="font-display text-xl font-semibold text-text mb-2">Confirming your email...</h1>
            <p className="text-subtext text-sm">One moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="font-display text-xl font-semibold text-text mb-2">Email confirmed</h1>
            <p className="text-subtext text-sm">Taking you to your chats...</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="font-display text-xl font-semibold text-text mb-2">Link expired or already used</h1>
            <p className="text-subtext text-sm mb-6">{message || "Please request a new confirmation email."}</p>
            <Link
              href="/signup"
              className="inline-block rounded-chat bg-signal text-ink font-medium text-sm px-4 py-2.5 hover:bg-signalDim transition-colors"
            >
              Back to sign up
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
