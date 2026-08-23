"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-chat bg-signal/10 border border-signal/30 mb-4">
            <span className="text-signal font-display font-bold">S</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-text">Welcome back</h1>
          <p className="text-subtext text-sm mt-1">Sign in to your conversations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-subtext mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-chat bg-panel border border-line px-3.5 py-2.5 text-text text-sm placeholder:text-subtext/60 focus:border-signal outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-subtext mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-chat bg-panel border border-line px-3.5 py-2.5 text-text text-sm placeholder:text-subtext/60 focus:border-signal outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-danger text-xs bg-danger/10 border border-danger/30 rounded-chat px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-chat bg-signal text-ink font-medium text-sm py-2.5 hover:bg-signalDim transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-subtext mt-6">
          No account?{" "}
          <Link href="/signup" className="text-signal hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
