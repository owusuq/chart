import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  baseURL: "https://api.meta.ai",
  apiKey: process.env.MODEL_API_KEY,
});

export async function POST(request) {
  const supabase = createClient();

  // 1. Confirm the caller is a logged-in user (never trust the client body alone)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conversationId } = await request.json();
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // 2. Verify this user actually belongs to this conversation (RLS mirror check)
  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Pull recent history for context (last 20 messages)
  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("sender_id, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  const messages = history
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.sender_id === null ? "assistant" : "user",
      content: m.content,
    }));

  if (messages.length === 0) {
    return NextResponse.json({ error: "Nothing to respond to" }, { status: 400 });
  }

  // 4. Call Claude
  let reply;
  try {
    const response = await anthropic.messages.create({
      model: "muse-spark-1.2",
      max_tokens: 1024,
      messages,
    });
    reply = response.content.find((b) => b.type === "text")?.text ?? "";
  } catch (err) {
    console.error("Anthropic API error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }

  // 5. Store the assistant's reply (sender_id null = AI, allowed by RLS policy)
  const { data: saved, error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: null, content: reply })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: saved });
}

