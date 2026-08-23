# Signal — secure, smart chat app

A private messaging app where users can:
- Chat 1:1 with other users in real time
- Chat with a built-in AI assistant (powered by Claude)
- Attach **any file type** to a message
- Do all of this behind proper authentication and row-level security

Stack: **Next.js 14** (App Router) + **Supabase** (Auth, Postgres, Realtime, Storage) + **Anthropic API**. No paid tier required to run this — everything fits in Supabase's and Vercel's free tiers for personal/small-team use.

---

## 1. How it's secured

- **Auth**: Supabase email/password auth. Sessions are stored in httpOnly cookies via `@supabase/ssr`, refreshed by `middleware.js`, which also redirects signed-out users away from `/chat`.
- **Row Level Security (RLS)**: every table (`profiles`, `conversations`, `conversation_participants`, `messages`) has RLS enabled. A user can only read/write messages in conversations they're a participant of — enforced at the database level, not just in the UI.
- **File storage**: files upload into a **private** bucket (`chat-files`), one folder per uploader. Storage policies only let a user read a file if they're a participant in the conversation it was attached to. The app hands out short-lived **signed URLs** (7 days) rather than making files public.
- **AI route runs server-side**: your Anthropic API key lives only in `app/api/ai/route.js`, which runs on the server. It's never sent to the browser. The route re-checks (server-side) that the caller really belongs to the conversation before calling Claude or writing a reply — it doesn't just trust the request body.
- **Size limits**: uploads are capped at 25MB both in the UI and at the Supabase bucket level.

None of this makes the app bulletproof — see "Hardening ideas" at the bottom for what to add before handling sensitive data at scale.

---

## 2. Project structure

```
chat-app/
├── app/
│   ├── login/          sign-in page
│   ├── signup/         sign-up page
│   ├── chat/           the chat page (server component, loads initial data)
│   └── api/ai/         server route that calls Claude
├── components/         all client UI (chat window, sidebar, input, modal)
├── lib/                Supabase client helpers (browser + server)
├── middleware.js        route protection / session refresh
└── supabase/schema.sql  full DB schema + RLS policies + storage setup
```

---

## 3. Run it locally

### a) Create a Supabase project
1. Go to https://supabase.com → New project (free tier is fine).
2. Once it's ready, open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**.
   This creates all tables, RLS policies, the realtime publication, and the `chat-files` storage bucket.
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### b) Get an Anthropic API key
Go to https://console.anthropic.com → API Keys → create one. This powers the AI assistant.

### c) Configure environment variables
```bash
cp .env.local.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`.

### d) Install and run
```bash
npm install
npm run dev
```
Visit http://localhost:3000 → you'll land on `/login` → create an account (check your email for the confirmation link if email confirmation is on) → sign in → start chatting.

---

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: secure smart chat app"
gh repo create your-username/signal-chat --public --source=. --remote=origin --push
```
(No `gh` CLI? Create the repo on github.com, then `git remote add origin <url>` and `git push -u origin main`.)

**Double-check `.env.local` is in `.gitignore`** (it already is) so your keys never get committed.

---

## 5. Deploy it live (free)

Easiest path is **Vercel**, made by the Next.js team:

1. Go to https://vercel.com → sign in with GitHub → **Add New Project** → select your repo.
2. In the import screen, expand **Environment Variables** and add the same three variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
3. Click **Deploy**. In ~1 minute you'll get a live URL like `signal-chat.vercel.app`.
4. Back in Supabase → **Authentication → URL Configuration** → set **Site URL** to your Vercel URL (and add it to Redirect URLs) so email confirmation links point to the live site instead of localhost.

That's it — you now have a live, secured chat app on a free stack.

---

## 6. Hardening ideas (before real/sensitive use)

- Turn on **email confirmation** and consider adding rate limiting on signups (Supabase Auth settings).
- Add **virus/malware scanning** on uploads if strangers can message each other (e.g. via a Supabase Edge Function calling a scanning API before a file is trusted).
- Move the AI conversation's system prompt and per-user rate limiting into the `/api/ai` route so one user can't rack up unlimited Claude usage.
- Add a **Content-Security-Policy** header and sanitize any user-generated content if you ever render it as HTML.
- Consider **group chats**: the schema already supports N participants per conversation — the current UI only wires up 1:1, but `conversation_participants` doesn't need to change.
