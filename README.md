<p align="center">
  <img src="public/images/logo-square.jpg" alt="Ihyaa Logo" width="100" height="100" style="border-radius: 50%; object-fit: cover;" />
</p>

<h1 align="center">Ihyaa Community Platform</h1>

<p align="center">
  Official web platform for <strong>Ihyaa</strong> — a Moroccan non-profit youth community association dedicated to personal development, education, spiritual growth, and community service.
</p>

---

## Overview

**Ihyaa** is a non-profit youth community initiative based in Morocco, operating active branches and gatherings across **Marrakech**, **Taroudant**, **Fam Zguid (Tata)**, and **Ouled Teima**.

This web platform serves as the central digital hub for the organization, providing:
- A public-facing web portal for event discovery, community news, activity photo galleries, and youth program registration.
- A secure, rate-limited attendance booking flow with one-time passcode (OTP) email verification.
- An internal administration portal for event scheduling, booking management, gallery curation, carousel controls, and contact inquiries.

---

## Features

### Public Portal
- **Full Bilingual Support (Arabic & English)**: Complete RTL (Right-to-Left) and LTR (Left-to-Right) layout adaptation with persistent language preference via `LocaleProvider`.
- **Interactive 3D Hero Scene**: Custom Three.js and React Three Fiber shader canvas featuring dynamic floating particles and responsive camera interaction.
- **Dynamic Events & Gatherings**:
  - Event catalog with status indicators (Open / Closed / Upcoming).
  - Automated "New" indicators and client-side recognition of booked events.
- **Secure Multi-Step Booking Flow**:
  - Step 1: Attendee details input with an interactive, searchable Moroccan city combobox and allowed email domain validation.
  - Step 2: Rate-limited verification via 6-digit one-time passcodes (OTP), secured by HMAC-SHA256 hashing with salt and 10-minute expirations.
  - Step 3: Registration confirmation displaying a unique booking reference, automatic localStorage persistence, and countdown redirect.
  - Transactional email dispatch powered by MailerSend with branded Arabic and English templates.
- **Activity Gallery**: Responsive media showcase with category filtering, bilingual descriptions, and modal zoom preview.
- **Interactive Morocco Chapter Map**: Visual map component highlighting Ihyaa regional hubs across Morocco.
- **Contact & Inquiries**: Direct messaging form with database logging for administrative review.
- **Dark & Light Mode**: Theme switching with system preference detection powered by `next-themes`.

### Administration Dashboard (`/admin`)
- **Dashboard Overview**: Key metrics covering total bookings, active events, gallery photos, and pending inquiries.
- **Bookings Management**: Filter attendees by event, monitor attendance status, inspect registration motives, and remove invalid entries.
- **Events Management**: Create and edit gatherings, manage event dates, locations, and Cloudinary poster uploads, and toggle booking availability.
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
| **Styling** | Tailwind CSS | `^4` | Utility-first styling with `@tailwindcss/postcss` |
| **Animation** | Framer Motion | `^13.1.1` | Page transitions, step animations, and interactive UI micro-interactions |
| **3D Graphics** | Three.js / React Three Fiber / Drei | `^0.185.1` / `^9.7.0` / `^10.7.8` | Interactive 3D particle canvas on homepage |
| **Database & ORM** | PostgreSQL (Neon) & Prisma ORM | `^6.4.1` | Relational database schema, connection pooling, and typed queries |
| **Media Hosting** | Cloudinary SDK | `^2.11.0` | Cloud media storage and image optimization for posters and gallery |
| **Transactional Email** | MailerSend REST API | — | Secure delivery of branded OTP verification emails |
| **UI Components** | Radix UI Primitives & Lucide Icons | `^1.6.7` / `^1.33.0` | Accessible dialogs, dropdowns, and SVG iconography |
| **Notifications** | Sonner | `^2.0.8` | Toast feedback for administrative actions |
| **End-to-End Testing** | Playwright | `^1.63.0` | Automated testing for booking flow, rate limiting, and OTP logic |

---

## Project Structure

```
.
├── prisma/
│   ├── migrations/              # Prisma SQL migration history (baselined)
│   │   └── 0_init/
│   │       └── migration.sql
│   ├── schema.prisma            # Database schema (Events, Bookings, OTP, RateLimit, etc.)
│   └── seed.ts                  # Optional database seeder
├── public/
│   └── images/                  # Static logos, posters, and placeholder assets
├── src/
│   ├── app/
│   │   ├── actions/             # Next.js Server Actions (bookings, events, gallery, carousel)
│   │   ├── admin/               # Internal Admin Portal routes
│   │   │   ├── bookings/        # Attendee registration management
│   │   │   ├── carousel/        # Homepage banner carousel management
│   │   │   ├── contacts/        # Contact form inquiry inbox
│   │   │   ├── events/          # Event management and scheduling
│   │   │   └── gallery/         # Activity gallery photo uploads
│   │   ├── events/              # Public events listing & booking wizard
│   │   │   └── majlis-ihyaa/
│   │   │       └── book/        # Multi-step booking stepper route
│   │   ├── gallery/             # Public activity photo gallery
│   │   ├── globals.css          # Tailwind CSS v4 design tokens and theme variables
│   │   ├── layout.tsx           # Root layout with Theme and Locale providers
│   │   └── page.tsx             # Homepage landing page
│   ├── components/
│   │   ├── common/              # Shared UI (BookingStepper, CityCombobox, MoroccoMap, ThemeToggle)
│   │   ├── react-bits/          # Custom animated UI components (DecryptedText, ShinyText, etc.)
│   │   ├── sections/            # Page sections (GlassNavbar, Hero, FeaturedEvent, Gallery, Footer)
│   │   ├── three/               # React Three Fiber shader canvas components
│   │   └── ui/                  # Base component primitives (button, input, dialog, card, etc.)
│   ├── i18n/                    # Bilingual translations dictionary and LocaleProvider context
│   └── lib/
│       ├── cloudinary.ts        # Cloudinary uploader utility
│       ├── constants.ts         # Moroccan cities list and allowed email domains
│       ├── email.ts             # MailerSend transactional email templates & client
│       ├── motion.ts            # Framer Motion animation curves and presets
│       ├── prisma.ts            # PrismaClient singleton with connection pooling
│       └── utils.ts             # Tailwind class merging utility
├── tests/                       # Playwright end-to-end test suites
├── next.config.ts               # Next.js configuration and image remote patterns
├── package.json                 # Scripts and package dependencies
└── tsconfig.json                # TypeScript compiler configuration
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure the following variables:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | :---: | --- |
| `ADMIN_PASSWORD` | **Yes** | Password for the temporary access gate protecting `/admin` routes. |
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL (Neon pooled connection string with `?sslmode=require`). |
| `DIRECT_URL` | **Yes** | Direct, unpooled PostgreSQL connection URL used by Prisma for schema migrations. |
| `CLOUDINARY_URL` | Optional | Combined Cloudinary connection string (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`). |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Cloudinary account cloud name (used if `CLOUDINARY_URL` is omitted). |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API access key. |
| `CLOUDINARY_API_SECRET` | **Yes** | Cloudinary API secret key. |
| `MAILERSEND_API_TOKEN` | **Yes** | API authentication token for sending emails via MailerSend. |
| `MAILERSEND_SENDER_EMAIL` | Optional | Verified sender email address configured in MailerSend. |
| `MAILERSEND_SENDER_NAME` | Optional | Sender display name for outgoing emails (e.g. `Ihyaa Association`). |
| `OTP_SECRET` | Optional | Secret salt string used for HMAC-SHA256 OTP hashing (falls back to a default salt in development). |
| `NEXT_PUBLIC_APP_URL` | Optional | Base URL of the deployment (e.g. `https://ihyaa.org`) used for absolute email asset URLs. |
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
Fill in your database credentials and API keys in `.env.local`.

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

## Security Notice: Admin Dashboard

The administrative dashboard located at `/admin` is designed for internal operations (event creation, attendee management, and media uploads).

> **Important**: The `/admin` routes are protected by a temporary password gate (`ADMIN_PASSWORD`) with rate-limiting, timing-safe validation, and session auto-clearing. This is a **stopgap measure** to prevent casual public access and should be replaced with a full authentication solution (such as NextAuth/Auth.js or Clerk) before open public deployment.

---

## License & Internal Use

This repository is proprietary software maintained for the internal operations and community activities of the **Ihyaa Cultural and Development Association** (Morocco). All rights reserved.
