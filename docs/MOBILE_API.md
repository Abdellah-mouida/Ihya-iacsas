# Ihyaa Mobile & External API Guide (`/api/v1`)

Authoritative integration contract for the native Android and iOS clients talking to the Ihyaa Program backend (`Next.js 16` App Router + Prisma + PostgreSQL). All details below reflect the actual route handlers and Zod schemas under `src/app/api/v1/` and `src/lib/api/v1/`.

---

## 1. Base URL, Versioning & Headers

- **Production Base URL**: `https://<your-production-domain>/api/v1`
- **Local Development Base URL**: `http://localhost:3000/api/v1`
- **Versioning**: URL-prefixed (`/api/v1/...`). Middleware (`src/middleware.ts`) bypasses `/api/v1/*` and `/.well-known/*` so native clients never receive web HTML redirects or cookie CSRF blocks.
- **CORS (`src/lib/api/v1/cors.ts`)**: Native mobile requests (no `Origin` header) are always allowed. Browser origins are checked against an exact comma-separated allowlist in `API_ALLOWED_ORIGINS` (wildcard `*` is ignored; rejected origins get `403 CORS_FORBIDDEN`).

### Standard Request Headers

| Header | Required | Notes |
|---|---|---|
| `Authorization` | Authenticated routes | `Bearer <accessToken>` |
| `Content-Type` | JSON / Upload routes | `application/json` (or `multipart/form-data` for `/api/v1/upload`) |
| `X-Device-Name` | Optional | Sent on `/auth/login`, `/auth/google`, `/auth/refresh` (max 120 chars; fallback to body `deviceName`) |
| `X-Client-Platform` | Optional | `"android"`, `"ios"`, `"web"`, etc. (max 40 chars; fallback to body `platform`) |
| `X-Realtime-Token` | SSE stream alt auth | Short-lived token from `GET /api/v1/chat/realtime/token` (or `?token=...` or `Authorization: Bearer ...`) |

All `/api/v1/*` responses default to `Cache-Control: no-store, max-age=0` except public cacheable GET routes (`/events`, `/gallery`, `/carousel`, `/branches`).

---

## 2. Authentication Flow & Token Lifecycle

### Token Model (`src/lib/api/v1/tokens.ts`, `src/lib/api/v1/sessions.ts`)

1. **Access Token**: HS256 JWT signed with `API_TOKEN_SECRET` (`>= 32` chars).
   - Claims: `sub` (user ID), `sid` (`ApiSession.id`), `sv` (`User.sessionVersion`), `role`, `iss: "ihyaa-api"`, `aud: "ihyaa-external"`, `token_type: "api_access"`.
   - **TTL**: `15 minutes` (`900` seconds).
   - Every authenticated request re-checks the `ApiSession` row (`revokedAt == null && expiresAt > now`), `User.sessionVersion === payload.sv`, `User.emailVerified != null`, live `User.role`, and RBAC permissions in PostgreSQL.
2. **Refresh Token**: Opaque `ihyaa_rt_<32-byte base64url>` string.
   - Stored **only as SHA-256 hex** (`tokenHash`) in `ApiRefreshToken`, tied to `sessionId` and `familyId`.
   - **TTL**: `30 days`.
   - **Single-use rotation**: Calling `POST /api/v1/auth/refresh` atomically marks the old token `usedAt` and issues a fresh access + refresh pair in the same `familyId`.
   - **Reuse detection**: Presenting an already-used or revoked refresh token immediately revokes **all** refresh tokens and sessions in that `familyId` (`401 REFRESH_TOKEN_REUSED`) and writes an `ACCESS_DENIED` audit entry. Force the user to log in again if you receive `REFRESH_TOKEN_REUSED`.

### Secure Storage on Device

- **Android**: Store `refreshToken` (and optionally the short-lived `accessToken`) in **Android Keystore**-backed `EncryptedSharedPreferences` (or Tink AEAD + DataStore). Keep `accessToken` in memory when practical. Never use plain `SharedPreferences`, external storage, or `allowBackup="true"`.
- **iOS**: Store `refreshToken` in **iOS Keychain** (`kSecClassGenericPassword`) with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (never `UserDefaults`, plist, or iCloud-synced keychain items if device-bound sessions are desired).

### Step-by-Step Auth Flow

1. **Email Registration (`POST /api/v1/auth/register`)**:
   - Body: `{ "name": "Amina Idrissi", "email": "amina@example.test", "password": "StrongPassword123!", "termsAccepted": true, "locale": "ar" }`
   - Response (`201`): `{ "registered": true, "email": "amina@example.test", "verificationRequired": true }`
   - Sends a 6-digit email OTP (valid 15m).
2. **Verify Email (`POST /api/v1/auth/verify-email`)**:
   - Body: `{ "email": "amina@example.test", "code": "123456", "locale": "ar" }`
   - Response (`200`): `{ "verified": true }`
3. **Password Login (`POST /api/v1/auth/login`)**:
   - Request:
     ```json
     {
       "email": "amina@example.test",
       "password": "StrongPassword123!",
       "deviceName": "Pixel 8",
       "platform": "android",
       "locale": "ar"
     }
     ```
   - Response (`200`):
     ```json
     {
       "tokenType": "Bearer",
       "accessToken": "<jwt>",
       "accessTokenExpiresIn": 900,
       "accessTokenExpiresAt": "2026-11-18T12:15:00.000Z",
       "refreshToken": "ihyaa_rt_...",
       "refreshTokenExpiresAt": "2026-12-18T12:00:00.000Z",
       "sessionId": "cm...",
       "user": {
         "id": "cm...",
         "name": "Amina Idrissi",
         "email": "amina@example.test",
         "role": "USER",
         "image": null,
         "emailVerified": "2026-11-18T11:58:00.000Z",
         "onboardingComplete": false,
         "city": null,
         "age": null,
         "theme": "light",
         "locale": "ar",
         "reduceMotion": false,
         "chatTermsAcceptedAt": null
       }
     }
     ```
   - Note: If the user logged in with a temporary password issued by `/auth/forgot-password`, `mustChangePassword: true` is included. Prompt the user to call `POST /api/v1/auth/change-password`.
4. **Google Native Sign-In (`POST /api/v1/auth/google`)**:
   - Obtain a Google OIDC `idToken` on-device via Credential Manager (Android) or GoogleSignIn SDK (iOS) using the **Web Client ID** as `serverClientId` / `requestIdToken` (or mobile client ID configured in `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` / `AUTH_GOOGLE_MOBILE_IDS`).
   - Request: `{ "idToken": "<google_id_token>", "deviceName": "iPhone 15", "platform": "ios" }`
   - Server verifies the JWT signature against Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`), verifies `iss` (`accounts.google.com` / `https://accounts.google.com`), `aud`, and `email_verified === true`, creates/links the `USER` account (never auto-elevates roles), and returns the same token payload plus `"isNewUser": true|false`.
5. **Onboarding Gate**:
   - If `user.onboardingComplete === false`, chat, user search, and booking creation return `403 ONBOARDING_REQUIRED`. Complete it with `POST /api/v1/users/me/onboarding`.
6. **Refresh & Single-Flight Queue (`POST /api/v1/auth/refresh`)**:
   - Request: `{ "refreshToken": "ihyaa_rt_..." }`
   - Response (`200`): `{ "tokenType": "Bearer", "accessToken": "...", "accessTokenExpiresIn": 900, "accessTokenExpiresAt": "...", "refreshToken": "ihyaa_rt_new...", "refreshTokenExpiresAt": "...", "sessionId": "cm..." }`
   - **Important**: Serialize refresh calls behind a mutex on the client! Concurrent requests with the same `refreshToken` will trigger reuse detection and revoke the entire session family.
7. **Logout, Sessions & Revoke**:
   - `POST /api/v1/auth/logout` with `{ "refreshToken": "..." }` (and optional `Authorization: Bearer ...`) revokes the current session.
   - `GET /api/v1/auth/sessions` lists active/recent device sessions (`current: boolean`).
   - `DELETE /api/v1/auth/sessions/[id]` revokes one device session.
   - `POST /api/v1/auth/logout-all` increments `User.sessionVersion` and revokes every web/API session immediately.

### cURL Examples

```bash
BASE_URL="http://localhost:3000/api/v1"

# 1. Login
LOGIN_JSON=$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Name: Android-Emulator" \
  -H "X-Client-Platform: android" \
  -d '{"email":"member@example.test","password":"ReplaceWithTestPassword!"}')

ACCESS_TOKEN=$(echo "$LOGIN_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.accessToken)")
REFRESH_TOKEN=$(echo "$LOGIN_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.refreshToken)")

# 2. Fetch profile
curl -sS "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. Rotate refresh token (always persist the new refreshToken before next call)
REFRESH_JSON=$(curl -sS -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

# 4. Logout current session
curl -sS -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

---

## 3. Error Format & Pagination

### Error Envelope

Every error (`4xx`/`5xx`) returns JSON:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "email": ["Invalid email"] }
  }
}
```

Common codes: `INVALID_JSON` (`400`), `VALIDATION_ERROR` (`400`), `UNAUTHORIZED` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `REFRESH_TOKEN_REUSED` (`401`), `FORBIDDEN` / `CORS_FORBIDDEN` / `EMAIL_NOT_VERIFIED` / `ONBOARDING_REQUIRED` / `CHAT_DISABLED` / `CHAT_TERMS_REQUIRED` / `CHAT_BANNED` / `CHAT_TIMED_OUT` (`403`), `NOT_FOUND` (`404`), `EMAIL_EXISTS` / `CONFLICT` (`409`), `RATE_LIMITED` (`429`, check `Retry-After` header), `EMAIL_DELIVERY_FAILED` (`502`).

### Pagination

1. **Page-based** (`/events`, `/gallery`, `/bookings?scope=admin`, `/admin/users`, `/admin/contacts`):
   - Query: `?page=1&limit=20` (clamped: `page >= 1`, `limit <= maxLimit`).
   - Response includes `pagination: { page, limit, total, totalPages }`.
2. **Cursor-based** (`/notifications`, `/chat/messages`, `/chat/realtime/backfill`):
   - Query: `?cursor=<id>&limit=30` (clamped).
   - Response includes `nextCursor` and `hasMore` (or `nextCursor` only on `/notifications`).

---

## 4. Complete Endpoint Reference (73 `/api/v1/*` Routes + 2 App-Link Routes)

> Note: Every `/api/v1/*` route also handles `OPTIONS` for CORS preflight.

### A. Auth & Sessions (12 routes)

| Method | Path | Authentication | Permission | Request params and body | Response | Errors | Rate limit |
|---|---|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | — | Body `{ name(2..100), email, password(8..200), termsAccepted(true), locale?("ar"\|"en") }` | `201` `{ registered: true, email, verificationRequired: true }` | `400`, `409`, `429`, `502` | `auth_signup:<ip>` / email |
| `POST` | `/api/v1/auth/verify-email` | Public | — | Body `{ email, code(len 6), locale? }` | `200` `{ verified: true }` | `400`, `404`, `429` | IP + email OTP attempts |
| `POST` | `/api/v1/auth/resend-otp` | Public | — | Body `{ email, locale? }` | `200` `{ sent: true }` | `400`, `404`, `429`, `502` | IP + email cooldown |
| `POST` | `/api/v1/auth/login` | Public | Verified email | Body `{ email, password, deviceName?, platform?, locale? }` | `200` `{ tokenType, accessToken, accessTokenExpiresIn, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, sessionId, user, mustChangePassword? }` | `400`, `401`, `403`, `429` | `auth_login:<email>` `5/15m`; `api_login_ip:<ip>` `25/15m` |
| `POST` | `/api/v1/auth/google` | Public | Google `email_verified` | Body `{ idToken, deviceName?, platform? }` | `200` `{ tokenType, accessToken, accessTokenExpiresIn, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, sessionId, user, isNewUser }` | `400`, `401`, `403`, `429`, `503` | `api_google_ip:<ip>` `20/15m` |
| `POST` | `/api/v1/auth/refresh` | Refresh token | Active session | Body `{ refreshToken }` | `200` `{ tokenType, accessToken, accessTokenExpiresIn, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, sessionId }` | `400`, `401`, `429` | `api_refresh_ip:<ip>` `60/15m` |
| `POST` | `/api/v1/auth/logout` | Optional Bearer | Own session | Body `{ refreshToken? }` | `200` `{ loggedOut: true }` | `400` | — |
| `POST` | `/api/v1/auth/logout-all` | Bearer | Authenticated | Empty body | `200` `{ loggedOutAll: true }` | `401` | — |
| `GET` | `/api/v1/auth/sessions` | Bearer | Authenticated | None | `200` `{ sessions: [...] }` | `401` | — |
| `DELETE` | `/api/v1/auth/sessions/[id]` | Bearer | Session owner | Path `id` | `200` `{ revoked: true, sessionId }` | `401`, `404` | — |
| `POST` | `/api/v1/auth/forgot-password` | Public | — | Body `{ email, locale? }` | `200` `{ accepted: true }` | `400`, `429` | `auth_pwd_reset:<email>` `3/15m` |
| `POST` | `/api/v1/auth/change-password` | Bearer | Authenticated | Body `{ currentPassword, newPassword(8..200), confirmNewPassword?, locale? }` | `200` `{ passwordChanged: true, sessionsRevoked: true }` | `400`, `401`, `429` | Password change RL |

### B. Users, Profile & Uploads (8 routes)

| Method | Path | Authentication | Permission | Request params and body | Response | Errors | Rate limit |
|---|---|---|---|---|---|---|---|
| `GET` | `/api/v1/users/me` | Bearer | Authenticated | None | `200` `{ user }` (own profile + stats + counts) | `401`, `404` | — |
| `PATCH` | `/api/v1/users/me` | Bearer | Authenticated | Body `{ name, city, age(10..120), bio?, studyLevel?, institution?, interests?, skills?, languages?, volunteerAreas?, locale? }` | `200` `{ user }` | `400`, `401` | — |
| `DELETE` | `/api/v1/users/me` | Bearer | Authenticated (not last admin) | Empty body | `200` `{ deleted: true }` | `400`, `401`, `403` | — |
| `POST` | `/api/v1/users/me/onboarding` | Bearer | Authenticated | Body `{ city, age(10..120), name?, termsAccepted(true), locale? }` | `200` `{ onboardingCompleted: true, user }` | `400`, `401` | — |
| `PATCH` | `/api/v1/users/me/avatar` | Bearer | Authenticated | Body `{ imageUrl?, uploadProof?, locale? }` (`null` clears avatar) | `200` `{ image }` | `400`, `401` | — |
| `PATCH` | `/api/v1/users/me/privacy` | Bearer | Authenticated | Body `{ friendRequestPolicy?("EVERYONE"\|"NOBODY"), showOnlineStatus?, showFriendCount? }` | `200` `{ privacy }` | `400`, `401` | — |
| `PATCH` | `/api/v1/users/me/preferences` | Bearer | Authenticated | Body `{ theme?("light"\|"sunset"\|"amoled"\|"black"), locale?("ar"\|"en"), reduceMotion?, coverImage?, uploadProof? }` | `200` `{ preferences }` | `400`, `401` | — |
| `GET` | `/api/v1/users/search` | Bearer | Onboarding complete | Query `?q=<min 3 chars>` | `200` `{ users }` | `400`, `401`, `403`, `429` | `user-search:<actorId>` |
| `GET` | `/api/v1/users/[id]` | Bearer | Authenticated | Path `id` | `200` `{ user }` (privacy-filtered public profile) | `401`, `404` | — |
| `POST` | `/api/v1/upload` | Bearer | Authenticated | `multipart/form-data`: `file` (JPG/PNG/WebP `<= 8MB`), `folder` (`"avatars"\|"covers"`) | `200` `{ url, publicId, imageWidth, imageHeight, uploadProof }` | `400`, `401`, `429`, `500` | `upload:<actorId>` `20/3600s` |

### C. Events & Bookings (7 routes)

| Method | Path | Authentication | Permission | Request params and body | Response | Errors | Rate limit |
|---|---|---|---|---|---|---|---|
| `GET` | `/api/v1/events` | Optional Bearer | Public (`events:view` / active) | Query `?page=1&limit=20` (`max 50`), `?all=true` (admin), `?bookedOnly=1` | `200` `{ events, pagination }` (public cached `30s`) | `400` | — |
| `POST` | `/api/v1/events` | Bearer | `events:create` | Body `{ titleAr, titleEn, descriptionAr?, descriptionEn?, date, time?, location, posterUrl?, isNew?, bookingOpen?, capacityType?, capacity?, slug? }` | `201` `{ event }` | `400`, `401`, `403`, `409` | — |
| `GET` | `/api/v1/events/[id]` | Optional Bearer | Public (id or slug) | Path `id` | `200` `{ event }` | `404` | — |
| `PATCH` | `/api/v1/events/[id]` | Bearer | `events:update` | Path `id`, partial event body | `200` `{ event }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/events/[id]` | Bearer | `events:delete` | Path `id` | `200` `{ deleted: true, id }` | `401`, `403`, `404` | — |
| `GET` | `/api/v1/bookings` | Bearer | Self; `?scope=admin` requires `bookings:view` | Query `?scope=admin&page=1&limit=25&eventId=&status=` (max 100) | `200` `{ bookings }` or `{ bookings, pagination }` | `401`, `403` | — |
| `POST` | `/api/v1/bookings` | Bearer | Onboarding complete | Body `{ eventId?, motive?, locale? }` | `201` `{ bookingId, bookingRef, status, waitlistOrder, eventId }` | `400`, `401`, `403`, `404`, `409`, `429` | Booking RL |
| `GET` | `/api/v1/bookings/[id]` | Bearer | Owner or `bookings:view` | Path `id` | `200` `{ booking }` | `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/bookings/[id]` | Bearer | Owner (cancel) | Path `id` | `200` `{ cancelled: true, id }` | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/bookings/[id]/approve` | Bearer | `bookings:manage` | Path `id` | `200` `{ booking }` | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/bookings/[id]/reject` | Bearer | `bookings:manage` | Path `id` | `200` `{ booking }` | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/bookings/[id]/promote` | Bearer | `bookings:manage` | Path `id` | `200` `{ booking }` | `400`, `401`, `403`, `404` | — |

### D. Public Content, Notifications & Admin (13 routes)

| Method | Path | Authentication | Permission | Request params and body | Response | Errors | Rate limit |
|---|---|---|---|---|---|---|---|
| `GET` | `/api/v1/gallery` | Public | Public | Query `?page=1&limit=12` (`max 48`) | `200` `{ photos, pagination }` (cached `60s`) | — | — |
| `GET` | `/api/v1/carousel` | Public | Public | None | `200` `{ posts }` (cached `60s`) | — | — |
| `GET` | `/api/v1/branches` | Public | Public | None | `200` `{ branches }` (cached `120s`) | — | — |
| `POST` | `/api/v1/contacts` | Public | Public | Body `{ name, email, message }` | `201` `{ contact }` | `400`, `429` | `contact:<ip>` `5/600s` |
| `GET` | `/api/v1/notifications` | Bearer | Owner | Query `?cursor=&limit=20(max 50)&filter=all\|unread` | `200` `{ items, nextCursor, unreadCount }` | `401` | — |
| `PATCH` | `/api/v1/notifications` | Bearer | Owner | Empty body | `200` `{ updated, unreadCount: 0 }` | `401` | — |
| `GET` | `/api/v1/notifications/summary` | Bearer | Owner | None | `200` `{ unreadCount, recent }` | `401` | — |
| `PATCH` | `/api/v1/notifications/[id]` | Bearer | Owner | Path `id`, Body `{ read: boolean }` | `200` `{ notification, unreadCount }` | `400`, `401`, `404` | — |
| `DELETE` | `/api/v1/notifications/[id]` | Bearer | Owner | Path `id` | `200` `{ deleted: true, unreadCount }` | `401`, `404` | — |
| `GET` | `/api/v1/dashboard/stats` | Bearer | `bookings:view` | Query `?locale=ar\|en` | `200` `{ stats }` | `401`, `403` | — |
| `GET` | `/api/v1/admin/contacts` | Bearer | `contacts:view` | Query `?page=1&limit=25` (`max 100`) | `200` `{ contacts, pagination }` | `401`, `403` | — |
| `DELETE` | `/api/v1/admin/contacts/[id]` | Bearer | `contacts:manage` | Path `id` | `200` `{ deleted: true, id }` | `401`, `403`, `404` | — |
| `GET` | `/api/v1/admin/users` | Bearer | `users:view` (`ADMIN`) | Query `?page=1&limit=25(max 100)&search=&role=` | `200` `{ users, pagination, roleCounts }` | `401`, `403` | — |
| `PATCH` | `/api/v1/admin/users/[id]/role` | Bearer | `users:manage_roles` (`ADMIN`) | Path `id`, Body `{ role: "USER"\|"MODERATOR"\|"ADMIN" }` | `200` `{ user }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/admin/users/[id]` | Bearer | `users:delete` (`ADMIN`) | Path `id`, Body `{ action: "delete"\|"anonymize", reason? }` | `200` `{ result }` | `400`, `401`, `403`, `404` | — |

### E. Chat, Rooms, Realtime & Moderation (33 routes)

All non-realtime chat routes require `requireChatEnabled: true` and `requireChatTerms: true` (except `/chat/terms`, `/invites/link/[token]`, and `/realtime/*` token/stream/presence).

| Method | Path | Authentication | Permission | Request params and body | Response | Errors | Rate limit |
|---|---|---|---|---|---|---|---|
| `POST` | `/api/v1/chat/terms` | Bearer | Not chat-banned | Body `{ accepted: true }` | `200` `{ chatTermsAcceptedAt }` | `400`, `401`, `403` | — |
| `GET` | `/api/v1/chat/unread` | Bearer | Chat terms | None | `200` `{ publicUnread, privateUnread, pendingFriendRequests, totalChatUnread, mutedConversationIds }` | `401`, `403` | — |
| `GET` | `/api/v1/chat/friends` | Bearer | Chat terms | None | `200` `{ friends, incoming, outgoing, blocked, ... }` | `401`, `403` | — |
| `POST` | `/api/v1/chat/friends` | Bearer | Chat terms | Body `{ action: "request"\|"accept"\|"decline"\|"cancel"\|"unfriend"\|"block"\|"unblock", targetUserId }` | `200` `{ status, ... }` | `400`, `401`, `403`, `404`, `409`, `429` | Friend action RL |
| `GET` | `/api/v1/chat/conversations` | Bearer | Chat terms | None | `200` `{ conversations }` (includes `keyEpoch`, `memberStates`) | `401`, `403` | — |
| `POST` | `/api/v1/chat/conversations/dm` | Bearer | Chat terms + accepted friends | Body `{ peerId }` | `200` `{ conversation }` | `400`, `401`, `403`, `404` | — |
| `GET` | `/api/v1/chat/conversations/[id]/key` | Bearer | Conversation member | Path `id`, Query `?epoch=<n>` | `200` `{ conversationId, keyVersion, keyEpoch, keys, expiresAt }` | `401`, `403`, `404`, `500` | — |
| `POST` | `/api/v1/chat/conversations/[id]/delivered` | Bearer | Conversation member | Path `id`, Body `{ at?: ISO8601 }` | `200` `{ ok: true, lastDeliveredAt }` | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/conversations/[id]/read` | Bearer | Conversation member | Path `id` | `200` `{ ok: true, lastReadAt }` | `401`, `403`, `404` | — |
| `PATCH` | `/api/v1/chat/conversations/[id]/mute` | Bearer | Conversation member | Path `id`, Body `{ muted: boolean }` | `200` `{ muted }` | `400`, `401`, `403`, `404` | — |
| `GET` | `/api/v1/chat/messages` | Bearer | Conversation member | Query `?conversationId=&cursor=&limit=30&wire=1` | `200` `{ messages, nextCursor, hasMore, keyEpoch, keyBundle?, peerLastReadAt, peerLastDeliveredAt, memberStates }` | `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/messages` | Bearer | Member + not timed out | Body `{ conversationId, body(<=MAX), clientId?, replyToId? }` | `201` (or `200` dedup) `{ message }` | `400`, `401`, `403`, `404`, `429` | Msg + public slow-mode RL |
| `GET` | `/api/v1/chat/messages/[id]` | Bearer | Conversation member | Path `id` | `200` `{ message }` | `401`, `403`, `404` | — |
| `PATCH` | `/api/v1/chat/messages/[id]` | Bearer | Message author | Path `id`, Body `{ body }` | `200` `{ message }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/chat/messages/[id]` | Bearer | Message author | Path `id` | `200` `{ message }` | `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/reports` | Bearer | Chat terms + access | Body `{ messageId, reason }` | `201` `{ report }` | `400`, `401`, `403`, `404`, `409`, `429` | Report RL |
| `POST` | `/api/v1/chat/rooms` | Bearer | Chat terms | Body `{ name, description?, allowMemberInvites?, slowModeSeconds? }` | `201` `{ room }` | `400`, `401`, `403`, `429` | Room create RL |
| `GET` | `/api/v1/chat/rooms/[id]` | Bearer | Room member | Path `id` | `200` `{ room }` | `401`, `403`, `404` | — |
| `PATCH` | `/api/v1/chat/rooms/[id]` | Bearer | Room owner | Path `id`, Body `{ name?, description?, allowMemberInvites?, slowModeSeconds? }` | `200` `{ room }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/chat/rooms/[id]` | Bearer | Room owner | Path `id` | `200` `{ deleted: true }` | `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/rooms/[id]/leave` | Bearer | Room member (not sole owner) | Path `id` | `200` `{ left: true }` (increments `keyEpoch`) | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/rooms/[id]/transfer` | Bearer | Room owner | Path `id`, Body `{ newOwnerId }` | `200` `{ transferred: true }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/chat/rooms/[id]/members/[memberId]` | Bearer | Room owner | Path `id`, `memberId` | `200` `{ removed: true }` (increments `keyEpoch`) | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/rooms/[id]/invites` | Bearer | Room member/owner | Path `id`, Body `{ type: "message"\|"link", inviteeId?, maxUses?, expiresInHours? }` | `201` `{ invite, ... }` | `400`, `401`, `403`, `404`, `429` | Invite RL |
| `DELETE` | `/api/v1/chat/invites/item/[inviteId]` | Bearer | Inviter or room owner | Path `inviteId` | `200` `{ revoked: true }` | `401`, `403`, `404` | — |
| `POST` | `/api/v1/chat/invites/message/[inviteId]/respond` | Bearer | Invitee | Path `inviteId`, Body `{ action: "accept"\|"decline" }` | `200` `{ status, roomId? }` | `400`, `401`, `403`, `404`, `409` | — |
| `GET` | `/api/v1/chat/invites/link/[token]` | Bearer | Authenticated | Path `token` | `200` `{ invite }` | `401`, `404`, `410` | — |
| `POST` | `/api/v1/chat/invites/link/[token]/respond` | Bearer | Chat terms | Path `token`, Body `{ action: "accept"\|"decline" }` | `200` `{ status, roomId? }` | `400`, `401`, `403`, `404`, `409`, `410` | — |
| `GET` | `/api/v1/chat/realtime/token` | Bearer | Authenticated | None | `200` `{ provider, token, channels, expiresAt, showOnlineStatus, streamUrl? }` | `401` | — |
| `GET` | `/api/v1/chat/realtime/stream` | Bearer or `X-Realtime-Token` / `?token=` | Valid token/session | Query `?token=...` (local SSE transport) | `200` `text/event-stream` | `401` | — |
| `POST` | `/api/v1/chat/realtime/typing` | Bearer | Member + chat terms | Body `{ conversationId, typing: boolean }` | `200` `{ ok: true }` | `400`, `401`, `403`, `404` | — |
| `GET` | `/api/v1/chat/realtime/presence` | Bearer | Chat terms | Query `?userIds=id1,id2` | `200` `{ onlineUserIds }` | `401`, `403` | — |
| `POST` | `/api/v1/chat/realtime/presence` | Bearer | Chat terms | Body `{ status: "online"\|"offline" }` | `200` `{ ok: true }` | `400`, `401`, `403` | — |
| `GET` | `/api/v1/chat/realtime/backfill` | Bearer | Conversation member | Query `?conversationId=&afterId=&limit=` | `200` `{ messages }` | `401`, `403`, `404` | — |
| `GET` | `/api/v1/admin/moderation` | Bearer | `chat:moderate` | None | `200` `{ reports, timeouts, bans, settings }` | `401`, `403` | — |
| `PATCH` | `/api/v1/admin/moderation/settings` | Bearer | `settings:manage` + ADMIN/MOD | Body `{ chatEnabled: boolean }` | `200` `{ chatEnabled }` | `400`, `401`, `403` | — |
| `PATCH` | `/api/v1/admin/moderation/reports/[id]` | Bearer | `chat:moderate` | Path `id`, Body `{ status, note? }` | `200` `{ report }` | `400`, `401`, `403`, `404` | — |
| `DELETE` | `/api/v1/admin/moderation/messages/[id]` | Bearer | `chat:moderate` | Path `id` | `200` `{ message }` | `401`, `403`, `404` | — |
| `POST` | `/api/v1/admin/moderation/users/[id]/ban` | Bearer | `chat:moderate` | Path `id`, Body `{ banned: boolean, reason? }` | `200` `{ user }` | `400`, `401`, `403`, `404` | — |
| `POST` | `/api/v1/admin/moderation/users/[id]/timeout` | Bearer | `chat:moderate` | Path `id`, Body `{ minutes: number, reason? }` | `200` `{ user }` | `400`, `401`, `403`, `404` | — |

### F. App / Universal Links (Root Domain, Not Under `/api/v1`)

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/.well-known/assetlinks.json` | Public | Android App Links verification (`ANDROID_APP_PACKAGE`, `ANDROID_SHA256_CERT_FINGERPRINTS`) |
| `GET` | `/.well-known/apple-app-site-association` | Public | iOS Universal Links verification (`APPLE_APP_ID`) |

---

## 5. Chat Encryption, Realtime & Notifications Guide

### 5.1 Realtime Connection

1. Call `GET /api/v1/chat/realtime/token` (Bearer auth, expires in 10 minutes).
2. Response tells you `provider` (`"local"` or `"ably"`), authorized `channels` (`user:<id>`, `presence:global`, `events:public`, `conv:<id>`, plus `admin:global` for `ADMIN`/`MODERATOR`), and `token`.
   - If `provider === "ably"`: initialize the Ably Realtime client using `token` (Ably TokenRequest / JWT) and subscribe to the returned `channels`. Refresh the token before `expiresAt`.
   - If `provider === "local"`: open an SSE connection to `GET /api/v1/chat/realtime/stream` with `X-Realtime-Token: <token>` (or `Authorization: Bearer <accessToken>`).
3. On reconnect or foreground resume:
   - Refresh the realtime token if membership changed (`member.changed` / `invite.updated`).
   - Re-sync visible lists (`/chat/conversations`, `/chat/messages?conversationId=...&wire=1`, `/notifications`) or use `/chat/realtime/backfill`.

### 5.2 Blind Encrypted Push & Local Decryption

Realtime payloads **never carry plaintext**. `message.created` and `message.updated` events carry a `wire` object:

- `wire.ciphertext`: `"<encrypted_base64>.<gcm_tag_base64>"` (AES-256-GCM; 16-byte tag)
- `wire.nonce`: `<12-byte IV base64>`
- `wire.keyVersion`: integer key version (default `1`)
- `wire.keyEpoch`: integer conversation epoch (incremented when a room member leaves or is removed)
- `wire.replyTo`: optional encrypted reply snippet (`ciphertext`, `nonce`, `keyVersion`, `keyEpoch`, `senderId`, `id`, `deletedAt`)

To decrypt on-device:

1. Call `GET /api/v1/chat/conversations/<conversationId>/key` (pass `?epoch=<n>` if decrypting older messages from an earlier `keyEpoch`). Response: `{ conversationId, keyVersion, keyEpoch, keys: [{ conversationId, keyVersion, keyEpoch, keyBase64 }], expiresAt }` (returns `404` if you are not a member).
2. Cache the returned 32-byte `keyBase64` entries **only in RAM** (respect `expiresAt`, 15m). Never persist raw keys to disk.
3. Decrypt using AES-256-GCM:
   - Key: raw 32 bytes decoded from `keyBase64` matching `(keyVersion, keyEpoch)`.
   - IV: 12 bytes decoded from `wire.nonce`.
   - AAD (UTF-8 bytes): `JSON.stringify([conversationId, messageId, senderId])` (no spaces after commas, matching JS `JSON.stringify`).
   - Input bytes: `encryptedBytes || tagBytes` (concatenated ciphertext + 16-byte GCM auth tag, which is what Android `Cipher("AES/GCM/NoPadding")` and iOS `CryptoKit.AES.GCM.SealedBox` expect).
   - Fallback: If key lookup or decryption fails (e.g., key rotation race), fall back to `GET /api/v1/chat/messages/<id>`.

### 5.3 Delivery & Read Acknowledgements

- When a non-`PUBLIC` message arrives over realtime (or is loaded on-device), call `POST /api/v1/chat/conversations/<id>/delivered` with `{ "at": "<iso>" }` (debounce ~200–500ms).
- When the user opens/views the conversation, call `POST /api/v1/chat/conversations/<id>/read`.
- For own messages in `DM` and `ROOM`:
  - `sent`: server accepted (`POST /api/v1/chat/messages` returned 200/201).
  - `delivered`: all other active members have `lastDeliveredAt >= message.createdAt`.
  - `seen`: all other active members have `lastReadAt >= message.createdAt`.

### 5.4 Notifications

- Poll `GET /api/v1/notifications/summary` on launch and listen on `user:<id>` for `notification.created` and `notifications.changed` events.
- Fetch paginated items with `GET /api/v1/notifications?cursor=<id>&limit=20&filter=all|unread`.
- Mark single read (`PATCH /api/v1/notifications/<id>` `{ "read": true }`), mark all read (`PATCH /api/v1/notifications`), or delete (`DELETE /api/v1/notifications/<id>`).

---

## 6. Events & Booking Flow

1. **Discover Events**: `GET /api/v1/events?page=1&limit=20` (and `GET /api/v1/events/<id-or-slug>`). Listen to `events:public` for `events.changed` to refresh capacity/open status live.
2. **Create Booking**: Ensure `user.onboardingComplete === true`, then `POST /api/v1/bookings` with `{ "eventId": "<id-or-slug>", "motive": "...", "locale": "ar" }`.
   - Status returned is `PENDING` (normal queue) or `WAITLISTED` (with `waitlistOrder` when full).
3. **Track & Cancel**: `GET /api/v1/bookings` lists the user's bookings; `DELETE /api/v1/bookings/<id>` cancels an own booking and atomically promotes the next waitlisted user on the server. Listen to `user:<id>` for `bookings.changed`.

---

## 7. What the Mobile App Must NEVER Do

1. **Never embed secrets**: Never bundle `API_TOKEN_SECRET`, `CHAT_ENCRYPTION_KEY`, `ABLY_API_KEY`, `AUTH_SECRET`, or Google client secrets in the APK/IPA.
2. **Never reuse a refresh token**: Always serialize refresh behind a single lock and discard the old token as soon as a new one is persisted.
3. **Never persist raw chat conversation keys on disk**: Keep HKDF keys from `/conversations/[id]/key` strictly in volatile memory.
4. **Never pass plaintext through Ably/SSE**: Always send via `POST /api/v1/chat/messages` and decrypt `wire` payloads locally.
5. **Never trust client-computed permissions or roles**: Always render UI according to `user.role` from `/users/me`, while the backend enforces RBAC on every call.
6. **Never allow cleartext HTTP in release builds**: Enforce TLS (`usesCleartextTraffic="false"` on Android; ATS enabled on iOS).

---

## 8. Setup Checklist (Owner Configuration)

Complete these steps outside the codebase to connect the production website and native Android/iOS apps:

1. **Vercel Environment Variables (Production + Preview)**:
   - `API_TOKEN_SECRET`: random >= 32-char secret (`openssl rand -base64 48`).
   - `API_ALLOWED_ORIGINS`: comma-separated exact origins for any browser SPAs (leave empty if only native Android/iOS apps call `/api/v1/*`).
   - `AUTH_GOOGLE_ID`: Web OAuth 2.0 Client ID (used as `serverClientId` in Android/iOS Google Sign-In).
   - `GOOGLE_ANDROID_CLIENT_ID`: Android OAuth Client ID from Google Cloud Console.
   - `GOOGLE_IOS_CLIENT_ID`: iOS OAuth Client ID from Google Cloud Console.
   - `AUTH_GOOGLE_MOBILE_IDS`: optional comma-separated extra mobile OAuth Client IDs.
   - `CHAT_ENCRYPTION_KEY` (32-byte base64 master key) and `CHAT_ENCRYPTION_KEY_VERSION` (`1`, plus `CHAT_ENCRYPTION_KEYS_PREVIOUS` when rotating).
   - `CHAT_REALTIME_PROVIDER`: `"ably"` (and `ABLY_API_KEY` set for real-time transport in serverless production).
   - `ANDROID_APP_PACKAGE`: Android `applicationId` (e.g. `ma.ihyaa.app`) for `/.well-known/assetlinks.json`.
   - `ANDROID_SHA256_CERT_FINGERPRINTS`: comma-separated SHA-256 signing fingerprints (Play App Signing + upload/debug cert) for `/.well-known/assetlinks.json`.
   - `APPLE_APP_ID`: `<TEAM_ID>.<BUNDLE_ID>` for `/.well-known/apple-app-site-association`.
2. **Mobile App Base URL**:
   - Point release builds to `https://<your-production-domain>/api/v1` and debug builds to your local LAN/tunnel URL.
3. **Google Cloud Console**:
   - Create an **Android** OAuth Client ID with your app's `package_name` and Play App Signing **SHA-1** fingerprint (plus your debug SHA-1 for local dev).
   - Create an **iOS** OAuth Client ID with your Xcode **Bundle Identifier**.
   - Keep the **Web** OAuth Client ID (`AUTH_GOOGLE_ID`) as the `serverClientId` requested in the mobile SDK so the returned ID token verifies cleanly on `/api/v1/auth/google`.
4. **Android Network Security & Pinning**:
   - Set `android:usesCleartextTraffic="false"` in `AndroidManifest.xml` and configure `network_security_config.xml` (optionally pinning your Vercel/edge root/intermediate CA SPKI hashes with backup pins before release).
5. **Verify App / Universal Links**:
   - After deploying, verify `https://<domain>/.well-known/assetlinks.json` and `https://<domain>/.well-known/apple-app-site-association` return `200 OK` with `application/json` and zero placeholder strings.
