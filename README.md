<p align="center">
  <img src="public/images/logo-circle.png" alt="Ihyaa Logo" width="100" height="100" />
</p>

<h1 align="center">Ihyaa Community Platform</h1>

<p align="center">
  Official web platform for <strong>Ihyaa Program</strong> (برنامج إحياء) — a Moroccan youth community program dedicated to personal development, education, spiritual growth, and community service.
</p>

---

## Overview

**Ihyaa Program** is a non-profit youth community initiative based in Morocco, operating active gatherings and events across **Marrakech**, **Taroudant**, **Fam Zguid (Tata)**, and **Ouled Teima**.

This web platform serves as the central digital hub for the community:
- A public web portal for event discovery, community photo galleries, and youth registration.
- Complete user authentication and account management powered by **Auth.js v5** (Credentials with email verification & Google OAuth).
- Multi-step onboarding for Moroccan youth with Moroccan city selection, age validation, and profile avatar storage via Cloudinary.
- Authenticated event booking with automatic capacity management (Open vs. Limited), waitlist queuing, admin approval, and automated promotion emails via **Brevo API**.
- Comprehensive legal compliance with bilingual **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy`) governed under the laws of the Kingdom of Morocco.
- An internal administrative portal (`/admin`) for gathering scheduling, attendee approval/rejection, gallery curation, and banner carousel management.

---

## Features

### Public Portal
- **Full Bilingual Support (Arabic & English)**: Complete RTL (Right-to-Left) and LTR (Left-to-Right) layout adaptation with persistent language preference via `LocaleProvider`.
- **Interactive 3D Hero Scene**: Custom Three.js and React Three Fiber shader canvas featuring dynamic floating particles and responsive camera interaction.
- **Dynamic Events & Gatherings**:
  - Event catalog loaded dynamically from PostgreSQL.
  - Automatic classification of events as Open vs. Ended based on date and time.
  - Interactive multi-event carousel with auto-advance, hover pause, and keyboard navigation.
- **User Authentication & Accounts (Auth.js v5)**:
  - Sign up (`/signup`) with real-time password strength validation and 6-digit email verification OTPs via Brevo API.
  - Sign in (`/login`) with credentials or Google OAuth, timing-safe validation, and database-backed rate-limiting lockout.
  - Password recovery (`/forgot-password`) with temporary passwords and forced password changes (`/change-password`).
  - Session revocation across devices via integer `sessionVersion` comparisons.
  - Youth Onboarding (`/onboarding`): Multi-step profile setup (city, age >= 10, Cloudinary avatar upload, and terms acceptance).
  - Account Dashboard (`/account`): Edit personal details, change password, and inspect "My Bookings" with status badges and cancellation.
- **Authenticated Event Booking**:
  - Instant one-click booking for logged-in and onboarded members.
  - User details (name, email, city, age) snapshotted directly into the booking record.
  - Capacity system: Open events auto-confirm; Limited events require admin approval or place attendees on a numbered waitlist.
  - Rejection or cancellation of an approved attendee automatically promotes the next waitlisted applicant with a branded Brevo email notification.
- **Legal & Compliance**:
  - Bilingual Terms of Service (`/terms`) and Privacy Policy (`/privacy`) with sticky Table of Contents sidebar, light/dark mode, and official Moroccan contact details (`0615789337`, Facebook, Instagram).
- **Activity Gallery**: Responsive media showcase with category filtering, bilingual descriptions, and modal zoom preview.
- **Themed UI & Notifications**:
  - Custom sonner toast system with Rub el Hizb (8-pointed Islamic star) iconography, brass accents, and glassmorphism.
  - Reusable accessible in-app confirmation modal (`useConfirmDialog`) replacing all native browser dialogs.
  - Dark & Light mode theme switching powered by `next-themes`.

### Administration Dashboard (`/admin`)
- **Dashboard Overview**: Key metrics covering total bookings, active events, gallery photos, and pending inquiries.
- **Bookings Management**: Filter attendees by event and status (`CONFIRMED`, `PENDING`, `WAITLISTED`, `REJECTED`), approve or reject bookings with waitlist auto-promotion, and manage attendee records.
- **Events Management**: Create and schedule gatherings with configurable capacity (Open vs. Limited), upload posters up to 8MB directly to Cloudinary, and manage attendance availability.
- **Gallery Manager**: Upload high-resolution event photography directly to Cloudinary with bilingual captions and automated translation helper chips.
- **Carousel Manager**: Reorder and toggle homepage banner slides with live previews.
- **Inquiry Inbox**: Review messages submitted through the public contact form.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| **Framework** | Next.js (App Router, Turbopack) | `16.3.2` | Full-stack React framework with server actions and static prerendering |
| **Runtime / Library** | React & React DOM | `19.2.8` | UI component rendering |
| **Language** | TypeScript | `^5` | Strict type safety across client and server |
| **Authentication** | Auth.js (NextAuth v5 beta) | `5.0.0-beta.32` | Credentials & Google OAuth, JWT sessions, Edge-safe middleware |
| **Password Hashing** | bcryptjs | `^3.0.3` | Cost 12 secure password hashing across serverless runtimes |
| **Styling** | Tailwind CSS | `^4` | Utility-first styling with `@tailwindcss/postcss` |
| **Animation** | Framer Motion | `^13.1.1` | Page transitions, step animations, and interactive UI micro-interactions |
| **3D Graphics** | Three.js / React Three Fiber / Drei | `^0.185.1` / `^9.7.0` / `^10.7.8` | Interactive 3D particle canvas on homepage |
| **Database & ORM** | PostgreSQL (Neon) & Prisma ORM | `^6.4.1` | Relational database schema, connection pooling, and typed queries |
| **Media Hosting** | Cloudinary SDK | `^2.11.0` | Cloud media storage and image optimization for posters, gallery, and avatars |
| **Transactional Email** | Brevo REST API (v3) | — | Delivery of branded OTP verification, password recovery, and waitlist emails |
| **UI Components** | Radix UI Primitives & Lucide Icons | `^1.6.7` / `^1.33.0` | Accessible dialogs, selects, dropdowns, and SVG iconography |
| **Notifications** | Sonner | `^2.0.8` | Themed glassmorphic toast notifications with Islamic geometric styling |
| **End-to-End Testing** | Playwright | `^1.63.0` | Automated E2E testing for auth, onboarding, bookings, capacity, and admin flows |

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure the following variables:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | :---: | --- |
| `AUTH_SECRET` | **Yes** | Secret encryption key for Auth.js JWT sessions (generate with `npx auth secret`). |
| `AUTH_GOOGLE_ID` | Optional | Google OAuth 2.0 Client ID for Google sign-in. |
| `AUTH_GOOGLE_SECRET` | Optional | Google OAuth 2.0 Client Secret for Google sign-in. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Base application URL (e.g. `http://localhost:3000` or production domain) for absolute callback URLs. |
| `ADMIN_PASSWORD` | **Yes** | Password for the access gate protecting `/admin` routes. |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL (Neon pooled connection string with `?sslmode=require`). |
| `DIRECT_URL` | **Yes** | Direct, unpooled PostgreSQL connection URL used by Prisma for schema migrations. |
| `CLOUDINARY_URL` | Optional | Combined Cloudinary connection string (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`). |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Cloudinary account cloud name (used if `CLOUDINARY_URL` is omitted). |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API access key. |
| `CLOUDINARY_API_SECRET` | **Yes** | Cloudinary API secret key. |
| `BREVO_API_KEY` | **Yes** | API key for transactional emails via Brevo (v3 REST API). |
| `ALLOWED_DEV_ORIGINS` | Optional | Comma-separated LAN IP addresses or hostnames allowed to access the Next.js dev server. |

---

## Getting Started

### Prerequisites
- **Node.js**: Version 20.x or later (Node 22+ recommended).
- **Package Manager**: `npm` (v10+) or `pnpm`.
- **Database**: An active PostgreSQL instance (e.g. Neon Serverless Postgres).

### 1. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/Abdellah-mouida/Ihya-iacsas.git
cd Ihya-iacsas
npm install
```

> Note: The `postinstall` script will automatically run `prisma generate` to build the local Prisma Client.

### 2. Configure Environment
Set up your local environment file:

```bash
cp .env.example .env.local
```
Fill in your database credentials, `AUTH_SECRET`, and API keys in `.env.local`.

### 3. Apply Database Migrations
Deploy the database schema to your connected database:

```bash
npx prisma migrate deploy
```

If you prefer to inspect the database schema visually:
```bash
npx prisma studio
```

### 4. Run the Development Server
Start the Next.js development server:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

### 5. Running Tests
To run the automated end-to-end Playwright test suite:

```bash
npx playwright test
```

To run translation dictionary parity verification:
```bash
npm run check:i18n
```

### 6. Production Build
To create an optimized production build:

```bash
npm run build
```

To start the production server locally:
```bash
npm run start
```

---

## License & Internal Use

This repository is proprietary software maintained for the internal operations and community activities of **Ihyaa Program** (Morocco). All rights reserved.
