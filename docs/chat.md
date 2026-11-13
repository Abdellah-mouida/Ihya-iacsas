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
- **Zero-content realtime channels:** Realtime events carry **only IDs and event types** (e.g., `message:new` with `{ messageId, conversationId }`, `typing`, `read`, `member:changed`, `friend:updated`, `invite:updated`). Message bodies are **never** published to the realtime provider; clients fetch ciphertext-decrypted messages only from our authenticated HTTPS API after server membership checks.
- **Not true end-to-end encryption (E2EE):** Device-only E2EE (Signal/MLS key exchange, multi-device backup, key recovery) is intentionally out of scope because it prevents server-side moderation of reported messages and reliable multi-device web access.
- **Staff access policy:** Staff and administrators **cannot** browse private conversations (DMs or private rooms). Only messages explicitly reported by a user create an encrypted `Report` snapshot visible to `ADMIN` / `MODERATOR` in the moderation queue.

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
   *(Exact commands will be finalized once T1 migration is created.)*
4. **Enable `chatEnabled` Dark Launch Toggle:**
   - Chat ships **OFF by default** (`SystemSetting.key = "chatEnabled"`, `"false"`).
   - Toggle it on from `/admin/moderation` when ready.

---

## 5. Key Rotation, Security Checklist & Manual Provider Verification
*(Completed alongside T1–T8 implementation.)*
