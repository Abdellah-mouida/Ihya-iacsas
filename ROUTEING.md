# ROUTEING.md — Ihyaa Program (`dev` Branch)

Complete, code-verified routing, API, Server Action, middleware, and external integration reference for the **`dev`** branch of the Ihyaa Program web platform (`Next.js 16.3.2` App Router, React 19, NextAuth v5, Prisma 6 + PostgreSQL/Neon).

---

## 1. Architecture & Request Lifecycle Overview

Requests enter through `src/middleware.ts` before reaching App Router pages, internal cookie-authenticated Route Handlers, Server Actions, or versioned external REST endpoints under `/api/v1/*`:

1. **Static & Media Bypass (`config.matcher`)**:
   `_next/static`, `_next/image`, `favicon.ico`, `icon.png`, `apple-icon.png`, `/images/*`, and static extensions (`svg|png|jpg|jpeg|gif|webp|avif|ico`) skip middleware completely.
2. **External REST API & App Link Bypass (`/api/v1/*`, `/.well-known/*`)**:
   Middleware immediately returns `NextResponse.next()` for `/api/v1/*` and `/.well-known/*` so Bearer-authenticated clients (mobile, React SPA, external services) and iOS/Android Universal/App Link verifiers are never redirected to `/login` or `/onboarding`, and never blocked by cookie-session CSRF origin checks. Security for `/api/v1/*` is enforced per handler via `withV1()`, `requireApiActor()`, `handleCorsPreflight()`, Zod schemas, and `checkRateLimit()`.
3. **Cross-Origin Mutation CSRF Guard (Internal Cookie APIs)**:
   `POST`, `PATCH`, `PUT`, and `DELETE` requests to `/api/chat/*`, `/api/admin/*`, `/api/notifications*`, `/api/upload*`, `/api/user/*`, and `/api/themes*` are rejected with `403` when `sec-fetch-site: cross-site` or when the `Origin` header host does not match `x-forwarded-host` / `host`.
4. **Legacy Redirects**:
   - `/account` & `/account/*` → `308` permanent redirect to `/profile` / `/profile/*` (preserving query string).
   - `/admin/login` → redirect to `/login?callbackUrl=<safeNext>` (validated via `isSafeRelativeUrl`, rejecting `//`, `/\`, control chars, and auth loops; defaults to `/admin`).
5. **Onboarding Gate (`decideOnboardingRedirect` in `src/lib/onboarding-guard.ts`)**:
   Authenticated users with `onboardingComplete !== true` on non-exempt pages are redirected to `/onboarding` (preserving `callbackUrl`). `/api/*`, `/onboarding`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/change-password`, `/privacy`, `/terms`, and `/403` are exempt.
6. **Public Auth Route Guard (`/login`, `/signup`, `/forgot-password`, `/reset-password`)**:
   Already-authenticated users are redirected to a safe `callbackUrl` or `/`.
7. **Protected User & Admin Route Enforcement**:
   - **Protected user prefixes**: `/settings`, `/profile`, `/change-password`, `/onboarding`, `/chat`, `/messages`, `/notifications`, `/u` → unauthenticated requests redirect to `/login?callbackUrl=...`.
   - **Admin prefixes (`/admin*`)**: unauthenticated → `/login?callbackUrl=...`; role `USER` → `/403`; role `MODERATOR` → `/403` on `/admin/users`, `/admin/audit`, `/admin/logs`, `/admin/settings`.
   - **Defense-in-depth**: Every Server Action and Route Handler also re-verifies live authentication, `User.sessionVersion`, DB `role`, and `can(role, permission)` independently of middleware.

---

## 2. Role-Based Access Control (RBAC) Matrix

Defined in `src/lib/permissions.ts`:

| Role | Granted Permissions |
|---|---|
| `USER` | `events:view` |
| `MODERATOR` | `events:view`, `events:create`, `events:update`, `bookings:view`, `bookings:manage`, `gallery:manage`, `carousel:manage`, `contacts:view`, `contacts:manage`, `branches:manage`, `chat:moderate` |
| `ADMIN` | All `MODERATOR` permissions + `events:delete`, `bookings:export`, `users:view`, `users:manage_roles`, `users:delete`, `audit:view`, `settings:manage` |

Role escalation protection:
- Every new signup / Google OAuth login is forced to `USER`.
- No self-demotion; last remaining `ADMIN` cannot be demoted or deleted (`src/lib/services/users.ts`, `src/app/actions/users.ts`).
- Role updates increment `User.sessionVersion` and revoke all active `ApiSession` and `ApiRefreshToken` records.

---

## 3. Frontend Page Routes (`src/app/**/page.tsx`)

| Route | Auth / Access | Onboarding | Purpose |
|---|---|---|---|
| `/` | Public | No | Landing page (program overview, carousel, gallery preview, events, contact) |
| `/events` | Public | No | Public upcoming & past events listing |
| `/events/[slug]/book` | Public page (booking requires login + onboarding) | Booking gated | Event detail and booking form by slug |
| `/events/majlis-ihyaa/book` | Public page (booking requires login + onboarding) | Booking gated | Dedicated booking route for Majlis Ihyaa |
| `/book` | Public page (booking requires login + onboarding) | Booking gated | Direct booking page for the default/featured active event |
| `/gallery` | Public | No | Full photo gallery |
| `/privacy` | Public | No | Privacy policy |
| `/terms` | Public | No | Terms of service |
| `/403` | Public | No | Forbidden / insufficient permissions page |
| `/login` | Guest-only (redirects if signed in) | No | Email/password & Google OAuth login |
| `/signup` | Guest-only (redirects if signed in) | No | User registration (always `USER`) |
| `/verify-email` | Public | No | Email OTP verification |
| `/forgot-password` | Guest-only (redirects if signed in) | No | Password reset request & OTP reset |
| `/onboarding` | Authenticated | Required if incomplete | Complete profile (phone, city, age, etc.) |
| `/profile` | Authenticated | Enforced if incomplete | User profile, bio, city, bookings history, cancel booking |
| `/settings` | Authenticated | Enforced if incomplete | Theme, cover image, privacy settings, account deletion |
| `/change-password` | Authenticated | No | Change password (revokes web & API sessions) |
| `/notifications` | Authenticated | Enforced if incomplete | Notification inbox & read controls |
| `/u/[id]` | Authenticated | Enforced if incomplete | Public member profile view (respects `profileVisibility`) |
| `/chat` | Authenticated | Enforced if incomplete | Friends, DMs, rooms, invites, live messaging |
| `/chat/invite/[token]` | Authenticated | Enforced if incomplete | Preview & accept/decline chat room link invite |
| `/messages` | Authenticated | Enforced if incomplete | Messages view / entry point |
| `/admin` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Admin dashboard stats & quick links |
| `/admin/bookings` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Review, approve, reject, promote, delete bookings |
| `/admin/events` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Create/edit/toggle/delete events |
| `/admin/gallery` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Upload/manage gallery photos |
| `/admin/carousel` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Manage homepage carousel posts |
| `/admin/contacts` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Read & delete contact form submissions |
| `/admin/branches` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Manage branches |
| `/admin/moderation` | `ADMIN` or `MODERATOR` | Enforced if incomplete | Chat moderation dashboard (reports, bans, timeouts, global kill-switch) |
| `/admin/users` | `ADMIN` only (`MODERATOR` → `/403`) | Enforced if incomplete | Manage users, roles, deletion/anonymization, user audit logs |
| `/admin/logs` | `ADMIN` only (`MODERATOR` → `/403`) | Enforced if incomplete | Platform activity & security audit logs |

---

## 4. Internal Cookie-Authenticated REST APIs (`src/app/api/*`, excluding `/api/v1/*`)

All mutating routes below require a valid NextAuth cookie session and pass the middleware cross-origin CSRF guard.

| Method(s) | Path | Auth / Permission | Purpose |
|---|---|---|---|
| `GET` | `/.well-known/assetlinks.json` | Public | Android App Links Digital Asset Links JSON (`ANDROID_APP_PACKAGE`, `ANDROID_SHA256_CERT_FINGERPRINTS`) |
| `GET` | `/.well-known/apple-app-site-association` | Public | iOS Universal Links AASA JSON (`APPLE_APP_ID`) |
| `GET`, `POST` | `/api/auth/[...nextauth]` | Public / NextAuth | Auth.js v5 session, CSRF, credentials & Google OAuth callbacks |
| `GET` | `/api/themes` | Public (read-only) | Active theme metadata list |
| `POST` | `/api/upload` | Authenticated | Upload validated image (magic bytes + rate limit) to Cloudinary; returns `{ url, publicId, uploadProof }` |
| `GET`, `PATCH` | `/api/user/preferences` | Authenticated | Get/update theme & cover image (requires HMAC `uploadProof` for cover changes) |
| `PATCH` | `/api/user/privacy` | Authenticated | Update `profileVisibility`, `showEmail`, `showPhone`, `showOnlineStatus` |
| `GET`, `PATCH` | `/api/notifications` | Authenticated | List notifications & mark all read |
| `GET` | `/api/notifications/summary` | Authenticated | Unread notification summary count |
| `GET`, `PATCH` | `/api/notifications/[id]` | Authenticated (owner) | Read/mark single notification read |
| `POST` | `/api/chat/terms` | Authenticated | Accept chat terms |
| `GET` | `/api/chat/unread` | Authenticated + chat terms | Unread message & friend request badge counts |
| `GET`, `POST` | `/api/chat/friends` | Authenticated + chat terms | Friends dashboard & friend/block actions |
| `GET` | `/api/chat/users/search` | Authenticated + chat terms | Search users by name prefix |
| `GET` | `/api/chat/conversations` | Authenticated + chat terms | List user conversations |
| `POST` | `/api/chat/conversations/dm` | Authenticated + chat terms | Open/create DM conversation |
| `POST` | `/api/chat/conversations/[id]/read` | Authenticated + member | Mark conversation read |
| `PATCH` | `/api/chat/conversations/[id]/mute` | Authenticated + member | Mute/unmute conversation |
| `GET`, `POST` | `/api/chat/messages` | Authenticated + member | Paginate or send encrypted messages |
| `GET`, `PATCH`, `DELETE` | `/api/chat/messages/[id]` | Authenticated + member/author | Read, edit, or delete message |
| `POST` | `/api/chat/reports` | Authenticated + chat terms | Report chat message |
| `POST` | `/api/chat/rooms` | Authenticated + chat terms | Create group chat room |
| `GET`, `PATCH`, `DELETE` | `/api/chat/rooms/[id]` | Authenticated + member/owner | Room details, update settings, delete room |
| `POST` | `/api/chat/rooms/[id]/leave` | Authenticated + member | Leave room |
| `POST` | `/api/chat/rooms/[id]/transfer` | Authenticated + room owner | Transfer room ownership |
| `DELETE` | `/api/chat/rooms/[id]/members/[memberId]` | Authenticated + room owner | Remove room member |
| `POST` | `/api/chat/rooms/[id]/invites` | Authenticated + member | Create direct or link room invite |
| `DELETE` | `/api/chat/invites/item/[inviteId]` | Authenticated + inviter/owner | Revoke room invite |
| `POST` | `/api/chat/invites/message/[inviteId]/respond` | Authenticated + invitee | Accept/decline direct message invite |
| `GET` | `/api/chat/invites/link/[token]` | Authenticated | Inspect link invite metadata |
| `POST` | `/api/chat/invites/link/[token]/respond` | Authenticated + chat terms | Accept/decline link invite |
| `GET` | `/api/chat/realtime/token` | Authenticated | Issue short-lived realtime subscription token |
| `GET` | `/api/chat/realtime/stream` | Realtime token | Local SSE realtime event stream |
| `POST` | `/api/chat/realtime/typing` | Authenticated + member | Broadcast typing indicator |
| `GET`, `POST` | `/api/chat/realtime/presence` | Authenticated | Read online users / update presence |
| `GET` | `/api/chat/realtime/backfill` | Authenticated + member | Backfill missed messages since cursor |
| `GET` | `/api/admin/moderation` | `chat:moderate` | Moderation dashboard (reports, timeouts, bans, settings) |
| `PATCH` | `/api/admin/moderation/settings` | `chat:moderate` | Toggle global chat enabled/disabled |
| `PATCH` | `/api/admin/moderation/reports/[id]` | `chat:moderate` | Resolve/dismiss chat report |
| `DELETE` | `/api/admin/moderation/messages/[id]` | `chat:moderate` | Moderate-delete public chat message |
| `POST` | `/api/admin/moderation/users/[id]/ban` | `chat:moderate` | Ban/unban user from chat |
| `POST` | `/api/admin/moderation/users/[id]/timeout` | `chat:moderate` | Timeout user from public chat |

---

## 5. Server Actions (`src/app/actions/*.ts`)

Used by Next.js Client Components with NextAuth cookie session validation (`auth()`, `requirePermission()`, `checkRateLimit()`, Zod validation):

| File | Exported Actions | Authorization |
|---|---|---|
| `auth.ts` | `signUpWithCredentials`, `verifyAccountEmail`, `resendAccountVerificationOtp`, `requestPasswordReset`, `changePassword`, `getOnboardingProfile`, `completeOnboarding` | Public (rate-limited) for signup/OTP/reset; Authenticated for `changePassword` (revokes NextAuth + `ApiSession`) and onboarding |
| `account.ts` | `getUserAccountData`, `updateUserProfile`, `updateUserAvatar`, `cancelUserBooking`, `deleteOwnAccount` | Authenticated owner only; `updateUserAvatar` validates magic bytes; `cancelUserBooking` uses `FOR UPDATE` waitlist promotion |
| `bookings.ts` | `getBookingUserState`, `createAuthenticatedBooking`, `isEventBookedByVisitor`, `getBookings`, `approveBooking`, `rejectBooking`, `promoteWaitlistBooking`, `deleteBooking` | `createAuthenticatedBooking` requires auth + onboarding; admin actions require `bookings:view` / `bookings:manage` |
| `events.ts` | `getEvents`, `getPublicEvents`, `getEventById`, `createEvent`, `updateEvent`, `toggleEventStatus`, `deleteEvent` | Public reads filtered; create/update/toggle require `events:create` / `events:update`; delete requires `events:delete` |
| `gallery.ts` | `getGalleryPhotos`, `getPublicGalleryPhotos`, `createGalleryPhoto`, `updateGalleryPhoto`, `deleteGalleryPhoto` | Public reads; mutations require `gallery:manage` |
| `carousel.ts` | `getCarouselPosts`, `createCarouselPost`, `updateCarouselPost`, `toggleCarouselActive`, `deleteCarouselPost` | Public reads; mutations require `carousel:manage` |
| `contacts.ts` | `submitContactMessage`, `getContactMessages`, `deleteContactMessage` | `submitContactMessage` public + rate-limited (`5/600s`); list/delete require `contacts:view` / `contacts:manage` |
| `users.ts` | `getAdminUsers`, `updateUserRole`, `deleteOrAnonymizeUser`, `getUserAuditLogs` | `users:view`, `users:manage_roles`, `users:delete`, `audit:view` (`ADMIN` only); revokes `ApiSession` on role change or anonymization |
| `branches.ts` | `getAdminBranches`, `createBranch`, `updateBranch`, `setBranchActive`, `deleteBranch` | `branches:manage` |
| `audit.ts` | `getAdminAuditLogs` | `audit:view` (`ADMIN` only) |
| `dashboard.ts` | `getDashboardStats` | `ADMIN` or `MODERATOR` (`events:view` + admin panel access) |
| `themes.ts` | `getThemes` | Public |
| `translate.ts` | `translateText` | Authenticated admin helper |

---

## 6. External Versioned REST API (`/api/v1/*`)

Designed for mobile apps, React SPAs, and third-party integrations. Built on the shared service layer (`src/lib/services/*`) with strict separation from cookie auth.

### 6.1 Security, Token & Header Contract

- **Base path**: `/api/v1`
- **Authentication**: `Authorization: Bearer <accessToken>` (HS256 JWT signed with `API_TOKEN_SECRET`, min 32 chars, `15m` TTL). Every `requireApiActor()` call verifies signature, `iss`/`aud`/`token_type: "api_access"`, `ApiSession` non-revoked/non-expired, and live `User.sessionVersion` + `role` in PostgreSQL.
- **Refresh Tokens**: Opaque 48-byte tokens stored SHA-256 hashed in `ApiRefreshToken` (`30d` TTL), bound to `ApiSession` + `familyId`. Refresh rotates atomically (`usedAt` + `replacedById`). Reusing a rotated/revoked token revokes the entire token family + session (`REUSE_DETECTED`).
- **CORS (`src/lib/api/v1/cors.ts`)**: Strict exact-origin allowlist from `API_ALLOWED_ORIGINS` (comma-separated). Wildcard `*` is rejected. Non-browser clients (no `Origin` header) are allowed; disallowed browser origins receive `403 CORS_FORBIDDEN` on preflight and no `Access-Control-Allow-Origin` header.
- **Response Envelope (`src/lib/api/v1/errors.ts`)**:
  - Success: returns the JSON payload object directly (`{ ... }`) with `Cache-Control: no-store, max-age=0` (unless overridden, e.g. public cacheable GETs `/api/v1/events`, `/api/v1/gallery`, `/api/v1/carousel`, `/api/v1/branches`).
  - Error: `{ "error": { "code": "...", "message": "...", "details"?: ... } }` with safe status codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`, `502`).
- **Standard Headers**:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json` (or `multipart/form-data` for `/api/v1/upload`)
  - `X-Device-Name`, `X-Client-Platform` (optional device metadata on login/refresh; also parsed from JSON body `deviceName` / `platform`)
  - `X-Realtime-Token` (allowed in CORS for SSE stream subscriptions)

### 6.2 Complete `/api/v1/*` Endpoint Table (73 Routes)

#### A. Auth & Sessions (12 routes)

| Method(s) | Endpoint | Auth | Rate Limit / Rules | Purpose |
|---|---|---|---|---|
| `POST`, `OPTIONS` | `/api/v1/auth/register` | Public | IP + email rate-limited; forces `role: "USER"` | Register user & send email verification OTP |
| `POST`, `OPTIONS` | `/api/v1/auth/verify-email` | Public | IP + email rate-limited | Verify email OTP (`6`-digit HMAC hash) |
| `POST`, `OPTIONS` | `/api/v1/auth/resend-otp` | Public | IP + email rate-limited; neutral response | Resend email verification OTP |
| `POST`, `OPTIONS` | `/api/v1/auth/login` | Public | `auth_login:<email>` (`5/15m`) + `api_login_ip:<ip>` (`25/15m`); requires verified email | Email/password login → returns `{ tokenType, accessToken, accessTokenExpiresIn, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, sessionId, user, mustChangePassword? }` |
| `POST`, `OPTIONS` | `/api/v1/auth/google` | Public | `api_google_ip:<ip>` (`20/15m`); `email_verified === true` via Google JWKS | Exchange Google ID token (`AUTH_GOOGLE_ID` / `GOOGLE_ANDROID_CLIENT_ID` / `GOOGLE_IOS_CLIENT_ID` / `AUTH_GOOGLE_MOBILE_IDS`) for API tokens |
| `POST`, `OPTIONS` | `/api/v1/auth/refresh` | Public (Refresh Token) | `api_refresh_ip:<ip>` (`60/15m`); atomic rotation + reuse family revocation | Rotate refresh token & return new access + refresh tokens |
| `POST`, `OPTIONS` | `/api/v1/auth/forgot-password` | Public | `auth_pwd_reset:<email>` (`3/15m`); neutral response | Email a temporary password (`mustChangePassword: true` on next login) |
| `POST`, `OPTIONS` | `/api/v1/auth/logout` | Bearer or Refresh Token | — | Revoke current `ApiSession` |
| `POST`, `OPTIONS` | `/api/v1/auth/logout-all` | Bearer | Increments `sessionVersion` | Revoke all `ApiSession` + `ApiRefreshToken` rows for user |
| `POST`, `OPTIONS` | `/api/v1/auth/change-password` | Bearer | Increments `sessionVersion` | Change password & revoke all active sessions |
| `GET`, `OPTIONS` | `/api/v1/auth/sessions` | Bearer | — | List active/recent `ApiSession` devices |
| `DELETE`, `OPTIONS` | `/api/v1/auth/sessions/[id]` | Bearer (owner) | — | Revoke a specific device session |

#### B. Users, Profile & Uploads (8 routes)

| Method(s) | Endpoint | Auth / Permission | Purpose |
|---|---|---|---|
| `GET`, `PATCH`, `DELETE`, `OPTIONS` | `/api/v1/users/me` | Bearer | Get self DTO, update profile fields, or delete own account |
| `POST`, `OPTIONS` | `/api/v1/users/me/onboarding` | Bearer | Complete onboarding (`phone`, `city`, `age`, etc.) |
| `PATCH`, `OPTIONS` | `/api/v1/users/me/preferences` | Bearer | Update `theme`, `locale`, `reduceMotion`, & `coverImage` (requires valid `uploadProof` for custom cover) |
| `PATCH`, `OPTIONS` | `/api/v1/users/me/privacy` | Bearer | Update `friendRequestPolicy`, `showOnlineStatus`, & `showFriendCount` |
| `PATCH`, `OPTIONS` | `/api/v1/users/me/avatar` | Bearer | Update avatar (`imageUrl`, `uploadProof`) from `/api/v1/upload` |
| `GET`, `OPTIONS` | `/api/v1/users/search` | Bearer + onboarding | Search visible users (`?q=...`, min 3 chars) |
| `GET`, `OPTIONS` | `/api/v1/users/[id]` | Bearer (or optional viewer) | Public profile DTO respecting `profileVisibility` |
| `POST`, `OPTIONS` | `/api/v1/upload` | Bearer | Upload validated image (`multipart/form-data`); returns `{ url, publicId, uploadProof }` |

#### C. Events & Bookings (7 routes)

| Method(s) | Endpoint | Auth / Permission | Purpose |
|---|---|---|---|
| `GET`, `POST`, `OPTIONS` | `/api/v1/events` | `GET`: Public; `POST`: `events:create` | List public events or create event |
| `GET`, `PATCH`, `DELETE`, `OPTIONS` | `/api/v1/events/[id]` | `GET`: Public; `PATCH`: `events:update`; `DELETE`: `events:delete` | Get event by id/slug, update, or delete |
| `GET`, `POST`, `OPTIONS` | `/api/v1/bookings` | `GET`: Bearer (`?scope=admin` requires `bookings:view`); `POST`: Bearer + onboarding | List own/admin bookings or create booking (`FOR UPDATE` capacity + waitlist) |
| `GET`, `DELETE`, `OPTIONS` | `/api/v1/bookings/[id]` | Owner or `bookings:view` / `bookings:manage` | Inspect or cancel/delete booking (auto-promotes next waitlisted booking) |
| `POST`, `OPTIONS` | `/api/v1/bookings/[id]/approve` | `bookings:manage` | Approve pending/waitlisted booking |
| `POST`, `OPTIONS` | `/api/v1/bookings/[id]/reject` | `bookings:manage` | Reject booking & promote waitlist if seat freed |
| `POST`, `OPTIONS` | `/api/v1/bookings/[id]/promote` | `bookings:manage` | Manually promote waitlisted booking |

#### D. Public Content, Notifications & Admin (13 routes)

| Method(s) | Endpoint | Auth / Permission | Purpose |
|---|---|---|---|
| `POST`, `OPTIONS` | `/api/v1/contacts` | Public (rate-limited `5/600s`) | Submit contact form message |
| `GET`, `OPTIONS` | `/api/v1/gallery` | Public | Paginated public gallery photos (`?skip=&take=`) |
| `GET`, `OPTIONS` | `/api/v1/carousel` | Public | Active carousel slides (`?all=1` optional) |
| `GET`, `OPTIONS` | `/api/v1/branches` | Public | Active branches |
| `GET`, `PATCH`, `OPTIONS` | `/api/v1/notifications` | Bearer | List notifications / mark all read |
| `GET`, `OPTIONS` | `/api/v1/notifications/summary` | Bearer | Unread notification count |
| `PATCH`, `DELETE`, `OPTIONS` | `/api/v1/notifications/[id]` | Bearer (owner) | Mark notification read or delete |
| `GET`, `OPTIONS` | `/api/v1/dashboard/stats` | `events:view` + (`ADMIN` or `MODERATOR`) | Admin dashboard metrics (`?locale=ar|en`) |
| `GET`, `OPTIONS` | `/api/v1/admin/users` | `users:view` (`ADMIN`) | Paginated user list + role counts |
| `PATCH`, `OPTIONS` | `/api/v1/admin/users/[id]/role` | `users:manage_roles` (`ADMIN`) | Change user role (revokes `ApiSession`s) |
| `DELETE`, `OPTIONS` | `/api/v1/admin/users/[id]` | `users:delete` (`ADMIN`) | Delete or anonymize user (blocks self/last-admin) |
| `GET`, `OPTIONS` | `/api/v1/admin/contacts` | `contacts:view` | List contact messages |
| `DELETE`, `OPTIONS` | `/api/v1/admin/contacts/[id]` | `contacts:manage` | Delete contact message |

#### E. Chat, Rooms, Realtime & Moderation (33 routes)

| Method(s) | Endpoint | Auth / Permission | Purpose |
|---|---|---|---|
| `POST`, `OPTIONS` | `/api/v1/chat/terms` | Bearer (not chat-banned) | Accept chat terms |
| `GET`, `OPTIONS` | `/api/v1/chat/unread` | Bearer + chat terms | Unread counts & `mutedConversationIds` |
| `GET`, `POST`, `OPTIONS` | `/api/v1/chat/friends` | Bearer + chat terms | Friends dashboard & send/accept/decline/cancel/unfriend/block/unblock |
| `GET`, `OPTIONS` | `/api/v1/chat/conversations` | Bearer + chat terms | List conversations (includes `keyEpoch`, `memberStates`) |
| `POST`, `OPTIONS` | `/api/v1/chat/conversations/dm` | Bearer + chat terms | Open/create DM conversation |
| `GET`, `OPTIONS` | `/api/v1/chat/conversations/[id]/key` | Bearer + member | Export HKDF-derived conversation key material (`keyVersion`, `keyEpoch`, `keys`) |
| `POST`, `OPTIONS` | `/api/v1/chat/conversations/[id]/delivered` | Bearer + member | Record monotonic delivery ack (`lastDeliveredAt`) & publish `delivered` event |
| `POST`, `OPTIONS` | `/api/v1/chat/conversations/[id]/read` | Bearer + member | Mark conversation read |
| `PATCH`, `OPTIONS` | `/api/v1/chat/conversations/[id]/mute` | Bearer + member | Mute/unmute conversation |
| `GET`, `POST`, `OPTIONS` | `/api/v1/chat/messages` | Bearer + member | List messages (`?wire=1` for client E2EE ciphertext) or send encrypted message |
| `GET`, `PATCH`, `DELETE`, `OPTIONS` | `/api/v1/chat/messages/[id]` | Bearer + member/author | Get, edit, or delete message |
| `POST`, `OPTIONS` | `/api/v1/chat/reports` | Bearer + chat terms | Report chat message |
| `POST`, `OPTIONS` | `/api/v1/chat/rooms` | Bearer + chat terms | Create group chat room |
| `GET`, `PATCH`, `DELETE`, `OPTIONS` | `/api/v1/chat/rooms/[id]` | Bearer + member/owner | Room details, update settings, delete room |
| `POST`, `OPTIONS` | `/api/v1/chat/rooms/[id]/leave` | Bearer + member | Leave room |
| `POST`, `OPTIONS` | `/api/v1/chat/rooms/[id]/transfer` | Bearer + room owner | Transfer room ownership |
| `DELETE`, `OPTIONS` | `/api/v1/chat/rooms/[id]/members/[memberId]` | Bearer + room owner | Remove room member |
| `POST`, `OPTIONS` | `/api/v1/chat/rooms/[id]/invites` | Bearer + member | Create message or link room invite |
| `DELETE`, `OPTIONS` | `/api/v1/chat/invites/item/[inviteId]` | Bearer + inviter/owner | Revoke room invite |
| `POST`, `OPTIONS` | `/api/v1/chat/invites/message/[inviteId]/respond` | Bearer + invitee | Accept/decline direct message invite |
| `GET`, `OPTIONS` | `/api/v1/chat/invites/link/[token]` | Bearer | Inspect link invite |
| `POST`, `OPTIONS` | `/api/v1/chat/invites/link/[token]/respond` | Bearer + chat terms | Accept/decline link invite |
| `GET`, `OPTIONS` | `/api/v1/chat/realtime/token` | Bearer | Issue realtime SSE/Ably subscription token |
| `GET`, `OPTIONS` | `/api/v1/chat/realtime/stream` | Bearer or `X-Realtime-Token` / `?token=` | SSE realtime stream |
| `POST`, `OPTIONS` | `/api/v1/chat/realtime/typing` | Bearer + member | Broadcast typing event |
| `GET`, `POST`, `OPTIONS` | `/api/v1/chat/realtime/presence` | Bearer | Query online users / update presence |
| `GET`, `OPTIONS` | `/api/v1/chat/realtime/backfill` | Bearer + member | Fetch messages missed after cursor |
| `GET`, `OPTIONS` | `/api/v1/admin/moderation` | `chat:moderate` | List moderation reports, active timeouts, bans, settings |
| `PATCH`, `OPTIONS` | `/api/v1/admin/moderation/settings` | `chat:moderate` | Enable/disable global chat |
| `PATCH`, `OPTIONS` | `/api/v1/admin/moderation/reports/[id]` | `chat:moderate` | Resolve/dismiss report |
| `DELETE`, `OPTIONS` | `/api/v1/admin/moderation/messages/[id]` | `chat:moderate` | Moderate-delete public message |
| `POST`, `OPTIONS` | `/api/v1/admin/moderation/users/[id]/ban` | `chat:moderate` | Ban/unban user from chat |
| `POST`, `OPTIONS` | `/api/v1/admin/moderation/users/[id]/timeout` | `chat:moderate` | Timeout user from public chat |

---

## 7. External Client Integration Examples (`cURL`)

```bash
BASE_URL="http://localhost:3000"

# 1. Login and capture accessToken + refreshToken
LOGIN_JSON=$(curl -sS -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Device-Name: IhyaaMobile" \
  -H "X-Client-Platform: android" \
  -d '{"email":"member@example.test","password":"YourStrongPassword123!"}')

ACCESS_TOKEN=$(echo "$LOGIN_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.accessToken)")
REFRESH_TOKEN=$(echo "$LOGIN_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.refreshToken)")

# 2. Fetch current user profile
curl -sS "$BASE_URL/api/v1/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. List public events and create a booking
curl -sS "$BASE_URL/api/v1/events"

curl -sS -X POST "$BASE_URL/api/v1/bookings" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"majlis-ihyaa","motive":"Community learning","locale":"ar"}'

# 4. Rotate refresh token (never reuse the old refreshToken!)
curl -sS -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"

# 5. Logout current device session
curl -sS -X POST "$BASE_URL/api/v1/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### Environment Variables for `/api/v1/*`

| Variable | Required | Purpose |
|---|---|---|
| `API_TOKEN_SECRET` | Yes (prod/API) | Signing secret (`>= 32` chars) for HS256 `/api/v1/*` JWTs |
| `API_ALLOWED_ORIGINS` | Yes (browser SPAs) | Comma-separated exact origins allowed for CORS (e.g. `https://app.ihyaa.ma,http://localhost:5173`) |
| `AUTH_GOOGLE_ID` | If Google OAuth used | Web OAuth client ID accepted by `/api/v1/auth/google` |
| `AUTH_GOOGLE_MOBILE_IDS` | Optional | Comma-separated iOS/Android Google OAuth client IDs accepted by `/api/v1/auth/google` |
