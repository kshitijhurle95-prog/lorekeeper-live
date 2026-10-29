# LoreKeeper Live

**Every stream leaves a story.** A Twitch community memory companion with a React dashboard, chat nominations and votes, streamer moderation, persistent lore, and a transparent live overlay.

## Current scope

- Local demo mode is separate from Twitch and clearly labeled; synthetic viewers are never represented as Twitch users.
- Real Twitch authorization uses the server-side authorization-code flow. EventSub WebSocket receives `channel.chat.message`; `user:read:chat` is required and `user:write:chat` enables command replies.
- Approved memories keep the original nomination as their fallback recap. Add a server-side OpenAI API key to generate and save an optional AI recap from the Memory Archive; generated text is bounded and can be refreshed. Original source text remains preserved.
- One local Node process owns the database, OAuth session, EventSub socket, and SSE fan-out. SQLite is persisted through sql.js (WASM), avoiding native build dependencies.

## Requirements

- Node.js 20.19+ (tested here on 24.22.1) and npm.
- For actual Twitch connection, a Twitch developer app and a channel account that can authorize the requested chat scopes.

## Run locally

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The local demo is enabled by `.env` and begins disconnected. Open **Settings → Enter local demo mode** to exercise the workflow. In **Live Lore**, send `!nominate A memorable moment from the stream`, start its vote, send `!vote <nomination-number>`, close the vote, and approve the winner. Try `!lore` for the latest saved memory. Demo data persists in `data/lorekeeper.sqlite`.

## Twitch setup

1. Register an application at <https://dev.twitch.tv/console/apps>.
2. Set the OAuth redirect URL to `http://127.0.0.1:3001/api/auth/callback` and set the same URL in `TWITCH_REDIRECT_URI`.
3. Copy `.env.example` to `.env` (already present for local development) and fill in `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep `.env` private; it is ignored by Git.
4. Set `APP_ORIGIN=http://127.0.0.1:5173`, then restart the server and choose **Settings → Authorize with Twitch**.
5. Authorize `user:read:chat` for incoming chat and `user:write:chat` for replies. EventSub WebSocket requires a user access token. The broadcaster identity is checked against Twitch’s `/validate` and Helix user responses.

## Optional AI recaps

Set `OPENAI_API_KEY` in the server `.env` and optionally choose an available `OPENAI_MODEL` (default: `gpt-6-astra`). Restart the server. In **Memory Archive**, choose **Generate AI recap** on an approved memory. The original nomination stays stored separately; you can refresh the generated recap. If the key is absent, the app labels the original submission as the non-AI fallback and disables the action. Provider failures do not change the saved memory. The server uses the OpenAI Responses API with `store: false`; input is treated as untrusted source text, and the returned recap is length-validated before saving.

The selected model is an installed chatbot acting as the broadcaster. Bot identity and broadcaster identity are therefore the same account. EventSub access tokens remain in the server-side in-memory session; they are not written to SQLite. Restarting the server ends the session and requires reconnecting.

## Overlay

Use **Stream Overlay → Copy URL** after connecting Twitch or entering demo mode. Add that URL as an OBS Browser Source at 1920 × 1080. It is an opaque, read-only token URL; it exposes only public lore and receives updates over SSE. Treat the URL as public to anyone who has it. Revoke it by deleting its `channel_config` row from the local database (token rotation UI is not yet implemented).

## Commands

```powershell
npm run dev          # Express API + Vite client
npm run typecheck    # Frontend and server TypeScript checks
npm run lint         # Oxlint
npm test             # Domain unit/integration tests
npm run build        # Type checks and production build
npm start             # Serve production build and API on port 3001
npx playwright test  # Browser flow (install Chromium once if needed)
```

For browser tests on this machine, install the Playwright Chromium build with `npx playwright install chromium`. The end-to-end test uses a separate ignored test database.

## Troubleshooting

- If the dashboard cannot reach the API, run both services with `npm run dev` from this project folder and check port 3001.
- If Twitch authorization fails, confirm the exact callback URL in the Twitch developer console and `TWITCH_REDIRECT_URI`, set `APP_ORIGIN`, and verify the broadcaster grants the requested chat scopes.
- If the browser says the session is disconnected after a server restart, reconnect Twitch; session tokens are intentionally memory-only.
- If a Twitch token expires, use **Settings → Authorize with Twitch** again. The server attempts refresh before chat replies.
- If AI recaps are unavailable, check `OPENAI_API_KEY`, `OPENAI_MODEL`, provider access, and server logs. No key is required for nominations, votes, approvals, or overlays.
- If the overlay URL stops working, create a fresh URL after entering the channel session; the URL is an unguessable bearer capability and should be kept private.

## Production notes

Set `NODE_ENV=production`, a unique `SESSION_SECRET` of at least 32 characters, and `APP_ORIGIN` to the HTTPS site origin. Serve behind HTTPS. The built-in Express MemoryStore is for single-process hackathon/local use only; replace it with a protected production session store before multi-process deployment. Back up `data/lorekeeper.sqlite`. There is no managed cloud database requirement.

## Codex and hackathon workflow

Codex is the primary development environment used to inspect the requirements, design and implement the application, integrate Twitch, and build the acceptance checks. Before submission, verify actual Twitch commands with an authorized test channel, review the repository for secrets, publish the source repository, record a sub-three-minute demo video, and run `/status` in the primary Codex thread to retrieve its session ID.

### Project description

LoreKeeper Live turns live Twitch chat moments into shared community history. Viewers nominate moments and vote through chat commands; a broadcaster moderates the winner, preserves it in a searchable archive, and can feature it on a transparent OBS overlay. Codex was used throughout implementation, including product architecture, Twitch OAuth/EventSub integration, responsive dashboard design, security controls, persistence, and automated quality checks. Local demo mode is explicitly separated from live Twitch activity.

### Demo video outline (under three minutes)

1. **0:00–0:20 — Product and Codex (20 sec):** show the LoreKeeper dashboard and briefly show this Codex thread working through the implementation and tests.
2. **0:20–0:55 — Real Twitch connection (35 sec):** show the authorized channel status, then send `!nominate A memorable stream moment` from a real viewer account and show it appear live in the dashboard.
3. **0:55–1:25 — Community vote (30 sec):** start the vote, cast `!vote <nomination-number>` from a viewer, show the count update, and demonstrate duplicate-vote rejection.
4. **1:25–1:55 — Preserve the moment (30 sec):** close voting, approve the winner, optionally generate an AI recap when configured, then feature the memory.
5. **1:55–2:25 — OBS overlay (30 sec):** show the transparent overlay update to the featured memory.
6. **2:25–2:50 — Archive and wrap (25 sec):** show search/persistence and summarize the Codex contribution. Keep the complete video below three minutes and avoid showing secrets or private overlay URLs.

Before submission, run `/status` in the primary Codex development thread and record its session ID. Source repository: <https://github.com/kshitijhurle95-prog/lorekeeper-live>.
