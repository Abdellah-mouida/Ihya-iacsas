<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MCP Server Instructions & Operational Rules

This project integrates Model Context Protocol (MCP) servers to accelerate development, ensure accessibility, protect databases, and maintain clean asset states. Agents and developers must adhere strictly to the usage rules below.

## Server Directory & Guidelines

### 1. Neon MCP (`https://mcp.neon.tech/mcp`)
- **Purpose**: Serverless PostgreSQL branch, schema, compute, and query management on Neon.
- **When to Use**:
  - Inspecting schema, running migrations, analyzing slow queries on dev branches.
  - Creating isolated temporary branches for previewing schema migrations.
- **When NOT to Use**:
  - Direct execution of raw DDL/DML without specifying a dev or preview branch ID.
  - NEVER touch or execute destructive statements (`DROP`, `TRUNCATE`, bulk `DELETE`) against the production branch (`production` / `br-curly-snow-b2rlthfo`).
- **Core Rules**:
  - **ALWAYS use the development branch**: `dev` (`br-hidden-wind-b20jiqxp`, compute `ep-bold-queen-b2qojux5`).
  - Production database credentials (`ep-square-shape-b24sp3s3`) must NEVER be used for automated tests, development seeding, or testing scripts.
  - All test files and seed scripts MUST invoke `assertDevBranchDatabase()` from `tests/helpers/dev-guard.ts`.
  - Any destructive schema or data change must be explicitly confirmed by the user.

### 2. Context7 MCP (`https://mcp.context7.com/mcp`)
- **Purpose**: Fetch version-accurate, up-to-date documentation and code examples for external packages and frameworks.
- **When to Use**:
  - BEFORE writing or refactoring code involving external libraries (e.g. Next.js 16+, Prisma 6+, React 19, Tailwind v4, Motion, Lucide, Radix UI, NextAuth v5).
  - Verifying API contracts, deprecation notices, and migration paths.
- **When NOT to Use**:
  - Internal project architecture, internal utility functions, or debugging business logic.

### 3. Next.js DevTools MCP (`next-devtools-mcp`)
- **Purpose**: Runtime diagnostics, compilation error tracking, route discovery, and cache inspection directly from the running Next.js development server.
- **When to Use**:
  - Inspecting active route definitions, cache status, and compilation/hydration errors while `next dev` is active.
- **When NOT to Use**:
  - When the Next.js development server is not running or during static production builds.

### 4. Chrome DevTools MCP (`chrome-devtools-mcp`)
- **Purpose**: Real browser inspection, performance tracing, accessibility audits (Lighthouse), CSS inspection, and visual debugging.
- **When to Use**:
  - Running Lighthouse audits (accessibility, performance, SEO, best practices).
  - Profiling Core Web Vitals (LCP, CLS, INP) or inspecting computed styles and live DOM trees.
- **When NOT to Use**:
  - Automated continuous-integration end-to-end tests (use Playwright instead).
- **Core Rules**:
  - Must always run in `--isolated` mode with clean throwaway profiles to protect user credentials, cookies, and personal sessions.

### 5. Playwright MCP (`@playwright/mcp`) & Test Suite
- **Purpose**: Browser automation, form filling, user flows, accessibility scans (`@axe-core/playwright`), and regression testing across viewports and locales.
- **When to Use**:
  - Executing automated E2E test suites, verifying UI state, checking language toggling, responsive layouts, and WCAG AA accessibility compliance.
- **When NOT to Use**:
  - Static code inspection or tasks that do not require an active browser runtime.

### 6. Shadcn MCP (`shadcn@latest mcp`)
- **Purpose**: Component discovery, viewing implementation code, and registry inspection across configured UI registries.
- **When to Use**:
  - Searching for accessible UI primitives and design components across `@shadcn`, `@aceternity`, `@magicui`, and `@react-bits` configured in `components.json`.
- **When NOT to Use**:
  - Arbitrary package installation or editing files that already follow custom project designs.

### 7. Vercel MCP (`https://mcp.vercel.com`)
- **Purpose**: Inspecting deployments, preview URLs, domain configuration, and build logs on Vercel.
- **When to Use**:
  - Checking deployment status and production build logs.
- **When NOT to Use**:
  - Local dev actions or editing local source code.

### 8. Cloudinary MCP (`@cloudinary/asset-management-mcp`)
- **Purpose**: Cloudinary digital asset management, uploads, transformations, and tag management.
- **Policy**: **DISABLED BY DEFAULT** (`"enabled": false` in `opencode.json`).
- **Core Rules**:
  - Least privilege: scoped to `librarian` (read-only exploration).
  - Enable ONLY for specific, intentional asset management tasks, and disable immediately afterwards.
  - NEVER execute automated asset deletions. All cleanup audits must run in read-only report mode (`scripts/report-cloudinary-orphans.ts`).

### 9. Brevo MCP (`https://mcp.brevo.com/v1/brevo/mcp`)
- **Purpose**: Transactional email management, templates, campaign inspection, and delivery analytics.
- **Policy**: **DISABLED BY DEFAULT** (`"enabled": false` in `opencode.json`).
- **Core Rules**:
  - Enable ONLY when explicitly requested to work with email templates or campaigns, and disable immediately afterwards.
  - Never send unsolicited or unconfirmed bulk emails during automated tasks.

## Standing Rules for Ihyaa Web Platform

1. **No Flat Page Backgrounds**:
   - Every page and section must feature rich, layered visuals: radial/mesh gradients, subtle Islamic geometric textures/patterns, delicate glows, soft elevation shadows, and smooth fading edge masks. Never render a bare, flat, single-color background.
2. **Strict Semantic Theme Tokens**:
   - Colors must exclusively use semantic theme variables/classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, etc.).
   - NEVER hardcode arbitrary hex values, arbitrary RGBs, or hardcoded `text-white`/`text-black`/`bg-white`/`bg-black` that break custom themes or AMOLED dark mode.
3. **Glassmorphism + Islamic Elegance**:
   - Modern frosted glass surfaces (`backdrop-blur`, semi-transparent borders, subtle inner highlights) fused with refined Moroccan / Islamic architectural motifs.
   - Flawless bilingual support: full RTL (`dir="rtl"`) for Arabic and LTR (`dir="ltr"`) for English.
   - Ultra-responsive down to 320px mobile viewports without horizontal scrollbar leaks.
   - Full support for `prefers-reduced-motion` across all animations and transitions.
4. **ActiveLink Highlighting**:
   - All navigation links (desktop navbar, mobile menu, user dropdown, footer links, settings subnav, admin sidebar) must clearly highlight the active route using the shared `ActiveLink` component.
5. **Zero Committed Plain-Text Credentials**:
   - Never commit secrets, passwords, or session tokens to git. Automated tests must exclusively use synthetic accounts (`@example.test`) with cryptographically secure random passwords generated at runtime. Auth state files must remain strictly gitignored.
6. **Bilingual Parity & Standard Components**:
   - Strict 100% key parity across `locales/ar.json` and `locales/en.json` (enforced via `npm run check:i18n`).
   - Official branding terminology: "Ihyaa Program" / "برنامج إحياء" across all copy.
   - Use standardized interactive elements: toast notification system, themed loader, accessible confirmation dialog, custom select dropdowns, and interactive image cropper.
7. **Design Tooling & Rigorous Multi-Viewport Verification**:
   - Leverage design registries (`@shadcn`, `@aceternity`, `@magicui`, `@react-bits`), Context7 documentation, and Playwright verification.
   - Capture and verify visual regressions at 360px, 768px, and 1440px viewports in both light/dark themes and Arabic/English locales.

