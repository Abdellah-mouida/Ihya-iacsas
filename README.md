# إحياء | Ihyaa Community Website

A modern, animated, Arabic-first (RTL by default) website for **Ihyaa**
(إحياء), a youth-focused Islamic community program in Morocco with
branches in Marrakech, Taroudant, Fam Zguid (Tata), and Ouled Teima.

The site presents the program's activities, showcases its events with a
full booking flow (including email verification), and includes an admin
dashboard for managing content — all wrapped in a premium glassmorphism
design with restrained Islamic visual motifs.

---

## ✨ Features

- **Bilingual, RTL-first** — Arabic (RTL) by default with an English (LTR)
  toggle; all UI copy is pulled from locale files, never hardcoded.
- **Modern, animated design** — glassmorphism navigation and cards, 3D
  hover/tilt effects, scroll-triggered animations, and an ambient
  React Three Fiber particle scene in the hero section.
- **Light / dark mode** — full theme support with smooth transitions,
  consistent across every section and the admin dashboard.
- **Branches map** — an interactive map of Morocco pinning each of the
  program's four branch locations.
- **Events & booking flow** — a dedicated events page listing upcoming
  and past events, with a booking flow that collects attendee details
  (name, email, city, age, optional motive) and verifies the attendee's
  email via a one-time password (OTP) before confirming the booking.
- **Gallery** — a curated set of photos on the home page with a
  dedicated, full gallery page grouping every photo by upload date.
- **Card carousel** — a looping poster carousel for featured visual content.
- **Admin dashboard** — manage carousel posts, gallery photos, events,
  view booking submissions and contact form messages, all backed by a
  real database.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router), TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| 3D | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + drei |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) + Base UI primitives |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) |
| Database | [Neon](https://neon.tech/) (serverless PostgreSQL) |
| ORM | [Prisma](https://www.prisma.io/) |
| Image storage | [Cloudinary](https://cloudinary.com/) |
| Transactional email | [MailerSend](https://www.mailersend.com/) (OTP delivery) |
| Icons | [lucide-react](https://lucide.dev/) |
| Testing | [Playwright](https://playwright.dev/) |

## 📁 Project Structure

```
src/
├── app/
│   ├── (site)/              # Public-facing pages (home, events, gallery, contact)
│   ├── events/[event]/book/ # Booking flow (details → OTP → confirmation)
│   ├── admin/                # Admin dashboard (carousel, gallery, events, bookings, contact)
│   └── actions/              # Server Actions (bookings, uploads, OTP)
├── components/
│   ├── sections/              # Home page sections (hero, about, activities, branches, gallery, etc.)
│   ├── common/                 # Shared components (navbar, footer, cards, stepper)
│   ├── three/                   # React Three Fiber scenes
│   └── react-bits/              # React Bits-based background/animation components
├── locales/
│   ├── ar.json                  # Arabic strings
│   └── en.json                  # English strings
prisma/
├── schema.prisma                 # Database schema
└── migrations/                    # Migration history
public/
└── images/
    ├── cards/                      # Carousel poster images
    └── ...                          # Gallery and site images
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech/) PostgreSQL database
- A [Cloudinary](https://cloudinary.com/) account
- A [MailerSend](https://www.mailersend.com/) account (for OTP emails)

### Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   Required variables:
   ```
   DATABASE_URL=              # Neon pooled connection string
   DIRECT_URL=                # Neon direct connection string (for migrations)
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   MAILERSEND_API_TOKEN=
   ```

3. Run the initial database migration:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## 🌍 Internationalization

All UI text lives in `src/locales/ar.json` and `src/locales/en.json`.
Arabic is the default language and direction (RTL); switching to English
flips the document direction to LTR. When adding new UI text, always add
a key to **both** locale files — never hardcode strings in components.

## 🔐 Admin Dashboard

The admin dashboard is available at `/admin` and currently has **no
authentication** — it is not linked from public navigation, but the route
itself is reachable directly. Do not deploy this publicly without adding
proper access control (e.g. a login gate) first.

## 📄 License

Internal project for the Ihyaa (إحياء) youth program. Not licensed for
external reuse.
