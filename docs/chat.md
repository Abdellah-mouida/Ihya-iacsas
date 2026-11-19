# Ihyaa Messaging System — Architecture, Security & Operations

## 1. Realtime Feasibility on Vercel (T0 Decision)

### Why Raw WebSockets Do Not Work in Next.js App Router on Vercel
Vercel Serverless Functions (including Fluid Compute) have finite execution durations (`maxDuration`) and run across horizontally scaled, stateless ephemeral isolates. Next.js App Router route handlers have no built-in cross-instance WebSocket upgrade or pub/sub state:
- Even when a runtime supports `server.upgrade`, a socket held open on one Vercel function isolate cannot broadcast directly to a user connected to another isolate without an external pub/sub broker.
- Connections drop whenever an instance scales down or hits its timeout.

### Realtime Options Comparison

| Option | How it works | Cost (Free / Starter) | Engineering & Ops Effort | Security / Token Model |
|---|---|---|---|---|
| **Managed Realtime: Ably (Chosen)** | Server publishes lightweight signals over HTTPS REST; browsers connect via WSS to Ably using 10-min channel-scoped `TokenRequest`s minted by `/api/chat/realtime/token`. Neon Postgres remains the single source of truth. | **Free:** 6M msgs/month, 200 peak concurrent connections, 100 peak channels. Paid from ~$29/mo if scaled. | **Low:** No separate server or infra to deploy/monitor; matches Vercel serverless natively. | Native multi-channel capability map + 10-min TTL + `clientId` in one signed `TokenRequest` (`subscribe`, `presence`, `publish` scoped per verified room/user). |
| **Managed Realtime: Pusher Channels** | Server triggers events over HTTPS REST; browsers subscribe via WSS with per-channel HMAC auth POSTs (`/api/chat/realtime/auth`). | **Free (Sandbox):** 200k msgs/day (~6M/mo), 100 peak concurrent connections. Paid from $49/mo. | **Low:** Similar serverless ergonomics, but requires one HTTP auth round-trip per private/presence channel join. | Per-channel HMAC auth; harder to enforce short 10-min multi-channel expiry without custom re-auth timers. |
| **Cloudflare Durable Objects** | Separate Cloudflare Worker with `WebSocketPair` + hibernation API per room/user; Next.js posts internal signed requests to Worker. | **$5/mo minimum** Workers Paid plan required for Durable Objects production limits & SQLite storage. | **Medium–High:** Second codebase, separate CI/CD deploy, cross-origin auth token verification, custom presence & fan-out glue. | Custom HMAC/JWT handshake between Next.js and Worker. |
| **Self-Hosted Socket.IO** | Dedicated Node.js server (Fly.io / Railway / VPS) + Redis adapter for pub/sub + TLS termination. | **$5–$15/mo** minimum for always-on container + Redis. | **High:** Separate host, process supervision, autoscaling, Redis maintenance, shared session/JWT verification. | Custom JWT socket auth + per-room authorization sync. |

### Decision
We use **Ably** for production WebSocket fan-out alongside **Neon Postgres** as the single source of truth, behind a small `RealtimeTransport` interface (`src/lib/chat/realtime/transport.ts`) with two implementations:
1. **`local-sse`** (`LocalSseTransport`): In-process event bus delivered over Server-Sent Events (`/api/chat/realtime/stream`) + POST signal endpoint for typing. Used automatically in local development and all automated Playwright/integration tests with zero external accounts or secrets.
2. **`ably`** (`AblyTransport`): Server publishes events via Ably REST API; browser lazily loads the Ably Realtime client after first paint (one connection per tab) using short-lived (~10 min) channel-scoped `TokenRequest`s issued by `/api/chat/realtime/token` after verifying room/user membership.

Active transport selection:
- If `CHAT_REALTIME_PROVIDER="ably"` and `ABLY_API_KEY` is configured, uses `AblyTransport`.
- Otherwise defaults safely to `LocalSseTransport` (for local single-process dev/test).

---

## 2. Encryption & Privacy Guarantee (Honest Scope)

- **In transit:** HTTPS and `wss://` (TLS) for all API and realtime traffic.
- **At rest (application-level):** Every `Message.ciphertext` and `Report.snapshotCiphertext` is encrypted on the server using **AES-256-GCM** with:
  - A 32-byte master secret (`CHAT_ENCRYPTION_KEY`, versioned via `CHAT_ENCRYPTION_KEY_VERSION` + optional `CHAT_ENCRYPTION_KEYS_PREVIOUS` for zero-downtime key rotation).
  - A **per-conversation 256-bit subkey** derived with HKDF-SHA256 (`info = "ihyaa-chat-v1:" + conversationId`).
  - A fresh random 12-byte nonce (`iv`) per message.
  - **Associated Authenticated Data (AAD)** binding `${conversationId}:${messageId}:${senderId}:${keyVersion}` so ciphertext cannot be transplanted across conversations, messages, or senders without failing authentication.
- **Blind encrypted realtime push (`WireEncryptedMessagePayload`):** Realtime events never carry plaintext message bodies. `message.created` and `message.updated` push the AES-256-GCM encrypted payload (`ciphertext`, `nonce`, `keyVersion`, `keyEpoch`, sender/reply/invite metadata) on `conv:{id}` / `user:{id}` channels. Authorized members fetch per-conversation HKDF keys (`keyVersion` + `keyEpoch`, kept in browser memory only with `15m` TTL and `Cache-Control: no-store`) via `GET /api/chat/conversations/[id]/key` and decrypt locally with WebCrypto (`src/lib/chat/client-crypto.ts`), falling back to `GET /api/chat/messages/[id]` on key miss or rotation. Leaving or removing a room member atomically increments `Conversation.keyEpoch`.
- **Delivery & read receipts:** `ConversationMember.lastDeliveredAt` tracks device delivery; receiving clients batch-ack via `POST /api/chat/conversations/[id]/delivered`, which publishes `delivered` events. In DM and ROOM chats, messages progress through sending (spinner) → sent (single check) → delivered (muted double-check when every other member's `lastDeliveredAt >= msg.createdAt`) → seen (double blue check via `--chat-seen` when every other member's `lastReadAt >= msg.createdAt`), or failed (retry trigger). No ticks are shown in `PUBLIC`.
- **Measured Local-Transport Latency (`local-sse` + Neon dev):**
  - *T0 Baseline (signal-then-fetch, 30 alternating DM messages):* `min=4382.5ms`, `p50=6030.9ms`, `p95=8509.6ms`, `max=9061.0ms` (end-to-end click-to-render, dominated by sequential DB roundtrips + `/api/chat/messages/[id]` fetch).
  - *T3 Blind E2EE Wire Push (after commit):* post-commit wire E2EE render **`p50=91.0ms`, `p95=115.4ms`, `max=115.4ms`** (10 messages; target `p50 < 150ms`, `p95 < 400ms`), and end-to-end click-to-render **`p50=3423.6ms`, `p95=4354.9ms`**.
- **Not true end-to-end encryption (E2EE):** Server-derived HKDF keys are intentional because server-side moderation of reported messages and multi-device web access require server decryption on authorized HTTPS routes.
- **Staff access policy:** Staff and administrators **cannot** browse private conversations (DMs or private rooms). Only messages explicitly reported by a user create an encrypted `Report` snapshot visible to `ADMIN` / `MODERATOR` in the moderation queue.

---

## 2.5. Unified Live Sync (`publishChange` & `useLive`)

All DB-backed user-facing surfaces stay live over the single per-tab realtime connection (`src/lib/realtime/publish.ts` on the server, `src/lib/realtime/use-live.ts` on the client), with automatic reconciliation on reconnect, `visibilitychange`, and a 60-second visible-only safety heartbeat.

| Channel / Topic | Subscribers | Triggered By (Server Mutations) | Client Surfaces Updated |
|---|---|---|---|
| `conv:{id}` | Active members of conversation (DM/ROOM/PUBLIC) | `sendMessage`, `editMessage`, `deleteMessage`, `markConversationDelivered`, `markConversationRead`, `removeRoomMember`, `leaveRoom`, `setGlobalChatEnabled` | `ChatWorkspace`, `ChatConversationPane`, `NotificationRealtimeBridge` (grouped toast + delivery ack) |
| `user:{id}` | Authenticated user (`id`) | `createMessageInvite`, `respondToMessageInvite`, `executeFriendAction` / `/api/chat/friends`, `setConversationMuted`, `notify`, `setNotificationReadState`, `markAllNotificationsRead`, booking mutations | `ChatWorkspace`, `NotificationsInbox`, `NotificationRealtimeBridge` (title + badges), `GlassNavbar`, `ProfileView`, `PublicProfileView` |
| `presence:global` | Authenticated chat users | Connect/disconnect/heartbeat in `local-sse` or Ably | `ChatWorkspace`, `PublicProfileView` |
| `events:public` | Authenticated sessions | `createEvent`, `updateEvent`, `toggleEventStatus`, `deleteEvent`, booking capacity changes | `OpenEvents`, `FeaturedEvent`, `GlassNavbar`, `ProfileView` |
| `admin:global` (topics `admin:bookings`, `admin:users`, `admin:moderation`) | `ADMIN` & `MODERATOR` sessions | Booking approvals/rejections/promotions/deletions, `updateUserRole`, `deleteOrAnonymizeUser`, `createMessageReport`, `resolveChatReport`, moderation actions, `setGlobalChatEnabled` | `/admin/bookings`, `/admin/users`, `/admin/moderation` |

---

## 3. Environment Variables

Add to `.env.local` (development) and Vercel Project Environment Variables (production):

```env
# Required for chat message encryption (32-byte base64; generate with: openssl rand -base64 32)
CHAT_ENCRYPTION_KEY=
CHAT_ENCRYPTION_KEY_VERSION=1
# Optional comma-separated "version:base64" pairs for decrypting older versions during rotation
# CHAT_ENCRYPTION_KEYS_PREVIOUS=

# Optional for Ably realtime in production ("local" | "ably")
CHAT_REALTIME_PROVIDER=local
ABLY_API_KEY=
```

*(Never commit real values. `.env.example` contains key names only.)*

---

## 4. What You Must Create / Set Before Enabling Chat in Production

1. **Generate `CHAT_ENCRYPTION_KEY`:**
   ```bash
   openssl rand -base64 32
   ```
   Set `CHAT_ENCRYPTION_KEY` (and `CHAT_ENCRYPTION_KEY_VERSION=1`) in Vercel Production & Preview env vars.
2. **Create an Ably App & API Key:**
   - Sign in at [ably.com](https://ably.com), create an app (e.g. `ihyaa-chat`), and copy the Root or a scoped API key with `publish`, `subscribe`, and `presence` capabilities.
   - Set `CHAT_REALTIME_PROVIDER=ably` and `ABLY_API_KEY=<key>` in Vercel env vars.
3. **Run Production DB Migration & Public Space Seed:**
   ```bash
   npx prisma migrate deploy
   node scripts/seed-chat.mjs
   ```
   *(Confirmed idempotent: `scripts/seed-chat.mjs` ensures the `PUBLIC` conversation and default `chatEnabled="false"` setting exist without touching existing messages or user roles.)*
4. **Enable `chatEnabled` Dark Launch Toggle:**
   - Chat ships **OFF by default** (`SystemSetting.key = "chatEnabled"`, `"false"`).
   - Toggle it on from `/admin/moderation` when ready.

---

## 5. Key Rotation, Security Checklist & Performance Audit (T8)

### Key Rotation (`CHAT_ENCRYPTION_KEY`)
1. Generate a new 32-byte key (`openssl rand -base64 32`).
2. Move the previous key into `CHAT_ENCRYPTION_KEYS_PREVIOUS="1:<old-base64-key>"`.
3. Set `CHAT_ENCRYPTION_KEY="<new-base64-key>"` and increment `CHAT_ENCRYPTION_KEY_VERSION=2`.
4. New messages encrypt under version `2`; historical messages and report snapshots decrypt seamlessly using `keyVersion` lookup.

### Security Best Practices Checklist
- **Authentication & Role Authority**:
  - `requireChatActor` validates `chatEnabled`, NextAuth session, `onboardingCompletedAt`, and `chatBannedAt` on every chat route; `requireAdminApiPermission("chat:moderate")` enforces `ADMIN | MODERATOR` for moderation (`chatEnabled` toggle restricted to `ADMIN` `settings:manage`).
  - No automatic admin promotion; `deleteUserAccount` re-encrypts non-deleted public/room messages under `"anonymized"` AAD (`senderId: null, isAnonymized: true`) and deletes DMs/solo rooms.
- **IDOR & Authorization Boundaries**:
  - Every conversation, message, invite, and report lookup scopes by `userId` membership, `ACCEPTED` friendship (for DMs and friend-only invites), and bidirectional `Block` checks, returning generic `404` for unauthorized IDs or leaked invite links.
  - Link invite tokens are 128-bit `base64url` secrets hashed with SHA-256 at rest and verified via `crypto.timingSafeEqual`.
- **Cross-Origin Mutation & Response Caching Guards**:
  - `src/middleware.ts` enforces same-origin validation (`Sec-Fetch-Site: cross-site` or `Origin` host mismatch -> `403`) on `POST|PATCH|PUT|DELETE` requests to `/api/chat/*` and `/api/admin/moderation*`.
  - Sensitive chat GET endpoints (`/api/chat/conversations`, `/api/chat/messages`, `/api/chat/messages/[id]`, `/api/chat/friends`, `/api/chat/users/search`, `/api/chat/realtime/token`, `/api/chat/realtime/backfill`, `/api/admin/moderation`) emit `Cache-Control: no-store, max-age=0`; `/u/[id]` and `/chat/invite/[token]` force dynamic rendering.
- **Input Validation, XSS & Rate Limits**:
  - Strict `zod` schemas validate payloads and bounded IDs; `parseSafeMessageSegments` renders plain text + `http(s):` links only (`rel="noopener noreferrer"`), rejecting `javascript:` / `data:` / inline HTML.
  - Atomic PostgreSQL `checkRateLimit` enforces friend request daily caps, prefix search limits (40/min), burst/minute message limits, `PUBLIC` slow mode (12s), invite brute-force throttling (30/5m), and report caps (15/24h).
- **Secrets & Logs**:
  - `src/lib/chat/crypto.ts` is marked `import "server-only"`; message ciphertexts, nonces, invite tokens, and plaintexts are never logged to stdout or `AuditLog`.

### Performance & Index Verification (`EXPLAIN` on Neon Dev)
- Verified with `SET LOCAL enable_seqscan = off`:
  - Message pagination & unread counts use `Message_conversationId_createdAt_id_idx`.
  - Sidebar membership uses `ConversationMember_userId_leftAt_idx`.
  - Friends, DMs, blocks, and invites hit `Friendship_pairKey_key`, `Friendship_requesterId_status_idx`, `Friendship_addresseeId_status_idx`, `Block_blockerId_blockedId_key`, and `Invite_tokenHash_key`.
  - Prefix search uses partial expression index `User_name_lower_pattern_idx` (`LOWER("name") text_pattern_ops WHERE "onboardingCompletedAt" IS NOT NULL AND "chatBannedAt" IS NULL`).
  - Moderation queue uses `Report_createdAt_idx`.
- **Bundle Isolation & Adaptive Quality**:
  - `ably` and `ChatWorkspace` live in dynamic/route-scoped chunks (`/` First Load JS does not load `ably` or `ChatWorkspace`).
  - `AnimatedList`, `ClickSpark`, and `/chat` CSS animations automatically degrade to static transitions under `prefers-reduced-motion: reduce` and `html[data-perf="low"]`.

### Manual Production Provider Verification (Ably)
1. Set `CHAT_REALTIME_PROVIDER=ably` and `ABLY_API_KEY=<key>` in `.env.local` (or Vercel preview).
2. Open `/chat` in two sessions, confirm `/api/chat/realtime/token` returns `{ provider: "ably", tokenRequest }`, and verify live delivery, typing, and unread updates over `wss://realtime.ably.io`.

---

## 6. Automated Test Suite (T1–T9)

All automated checks run exclusively against the Neon `dev` branch (`assertDevBranchDatabase()`):

- `tests/chat-crypto.unit.spec.ts` — AES-256-GCM + HKDF round trip, tamper detection, AAD binding, `keyVersion` + `keyEpoch` rotation, `server-only` guard (7 tests).
- `tests/chat-realtime.unit.spec.ts` — 10-minute scoped token signing/expiry, Ably capability scoping, SSE blind wire delivery, membership/block revocation (3 tests).
- `tests/chat-friends.spec.ts` — Friend state transitions, mutual auto-accept, duplicate/block guards, `/u/[id]` `CountUp` & privacy controls, `chatEnabled` 404 flag (2 tests).
- `tests/chat-idor.spec.ts` — Safe `http(s)` linkifier, Public/DM/Room pipeline, cursor pagination, idempotent `clientId`, slow mode, HTTP 404 IDOR matrix (3 tests).
- `tests/chat-rooms.spec.ts` — Private rooms, `ROOM_INVITE` DM cards, SHA-256 link invites, `O -> A -> B` invite chains, `membersCanInvite` toggle, stranger 404 rejection (2 tests).
- `tests/chat-ui.spec.ts` — Guidelines gate, `data-rb` markers (`AnimatedList`, `ClickSpark`, `SpotlightCard`, `ShinyText`, `CountUp`), realtime DM/typing/seen, 320px phone 2-pane nav, Amoled & English checks (1 test).
- `tests/chat-moderation.spec.ts` — Encrypted report snapshots, `/admin/moderation` report resolve, public delete/timeout/ban, global `chatEnabled` toggle, `/privacy#messaging`, account deletion anonymization (2 tests).
- `tests/chat-e2e-full.spec.ts` — Full 4-context multi-user E2E flow across desktop Amoled, 320px Arabic RTL phone, 2-core/2GB `data-perf="low"`, and Moderator sessions (1 test).
- `tests/chat-realtime.spec.ts` — Two-context + Admin E2E suite verifying blind E2EE wire push latency, grouped chat toasts, document title unread prefix, live booking approval, delivered→seen ticks, live invite flip, and offline reconnect backfill (1 test).
- `tests/chat-whatsapp-t4.spec.ts` — WhatsApp-grade UI suite verifying "Public chat" / "الدردشة العامة" rename, compact 320/360/390px DM headers, 5-min grouping + first-message tails, side action menu + Copy animation, self-hosted lazy emoji picker (`emoji-catalog.json`, 0 CDN requests), 1000-message windowing, and all 4 themes (1 test).

