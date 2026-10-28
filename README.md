# Nova AI — starter workspace

Nova is a responsive, installable-ready AI chat starter built with Next.js. It includes a polished dark UI, browser-local chat history, streamed answers, basic Markdown/code rendering, a server-side model proxy, and a PWA manifest.

## Important limitations

- This is an application using an external model API, not a new foundation model trained from scratch.
- The default model selector (`openrouter/free`) depends on provider availability, rate limits, and model routing. Free tiers can change or be unavailable.
- Browser history is stored locally in this browser only. There is no cloud account or cross-device sync in this version.
- Web search, document upload, tool execution, and long-term server-side memory are not implemented yet.
- Do not send passwords, API keys, or sensitive personal information. Messages are sent to the configured provider.

## Run locally

1. Install Node.js 20.9+.
2. Copy `.env.example` to `.env.local`.
3. Add an API key from a provider offering free inference at the time you set this up. For OpenRouter, create a key at https://openrouter.ai/keys.
4. Keep the key only in `.env.local` or deployment secrets. Never put it in a `NEXT_PUBLIC_` variable or commit it.
5. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel (free hobby use)

1. Create a new GitHub repository named `nova-ai` and upload these project files (the contents of this folder, not the outer folder).
2. Import that repository into Vercel.
3. In Project Settings → Environment Variables, add:
   - `OPENROUTER_API_KEY` — your provider API key
   - `OPENROUTER_MODEL` — `openrouter/free` (or another available model ID)
   - `NEXT_PUBLIC_APP_URL` — your deployed site URL
4. Deploy. If you later add/change variables, redeploy.

Do not use an API key in client-side code. The `/api/chat` route keeps the key on the server.

## PWA / install

The app includes a web manifest. Once deployed over HTTPS, use the browser's Install app option where supported. A service worker and offline chat are not included yet; AI replies require an internet connection.

## Suggested next milestones

1. Add rate limiting and abuse protection before sharing publicly.
2. Add authentication and server-side database storage before supporting multiple users.
3. Add provider adapters and a model settings page.
4. Add opt-in retrieval over user-provided files, with clear privacy controls.
5. Add web search and sandboxed tools with explicit user approval for consequential actions.
6. Build an evaluation suite before fine-tuning any open model.
