# React Bits audit and adoption

The `@react-bits` registry is configured in `components.json`. The Shadcn MCP server is not exposed in this Codex runtime; the configured registry was reachable through `npx shadcn@latest search` and `view`.

## T0 deployment/source verification (2026-11-12)

- `FoldText-TS-TW` is the correct public-registry name. `https://reactbits.dev/r/FoldText-TS-TW.json` returned 200; `npx shadcn@latest view @react-bits/FoldText-TS-TW` resolved the same item. Its public source declares `foldStyle`, `hinge`, and `creaseShading`, and asks for `gsap@^3.13.0`. It appears in the public React Bits catalog; the fetched registry metadata has no license field. There is no evidence that this item is Pro-only. The site adaptation is custom CSS and does not copy or bundle GSAP.
- Current implementation: `src/components/sections/hero.tsx` renders local per-word Arabic/per-character English fold spans, but imports no React Bits source and emits no component marker. `src/components/common/spotlight-card.tsx` is the custom SpotlightCard adaptation used in Home activities and the Home gallery preview; its marker is `data-react-bits="SpotlightCard"`, not the requested `data-rb` proof marker. The dedicated `/gallery` page uses a normal image grid and has no React Bits effect. The older table below records previous candidate decisions; task set 08 now makes visible adoption mandatory and overrides those drops.
- At verification, `vercel ls --environment=preview` showed latest Ready Preview `https://ihya-iacsas-ghf2m0hn2-abdellah-projects.vercel.app` with branch alias `ihya-iacsas-git-dev-abdellah-projects.vercel.app`. `vercel inspect` also listed `ihyaa.is-cool.dev` as an alias on that Preview. `vercel curl` bypassed Deployment Protection for read-only inspection: Home HTML contained four `data-react-bits="SpotlightCard"` markers, four hero fold pieces/words, and the reference-line test marker; `/gallery` contained five gallery-card nodes but no React Bits marker. Plain unauthenticated `curl` gets Vercel protection/404, so these findings use authenticated CLI access.
- The Vercel MCP connection is not authorized for team `abdellah-projects` (403); the installed Vercel CLI is authenticated and provides the required read-only deployment inspection, so no reauthorization was needed.

## T1 visible adoption and proof (2026-11-12)

All entries below are custom adaptations of the named public registry item. Registry source code and new animation packages were not copied or added. The existing shared tokens, locale direction, touch behavior, reduced-motion rules, and existing page interactions remain in use. `tests/reactbits.spec.ts` visits each listed route and asserts its markers; it passed on the local production build.

| React Bits item / adaptation | File | Route | `data-rb` | Extra dependencies | Added JS cost |
|---|---|---|---|---|---|
| `FoldText-TS-TW` — paper fold with whole-word Arabic/English spans | `src/components/FoldText.jsx`, `src/components/sections/hero.tsx` | `/` | `FoldText` | `gsap@3.13.0` pinned | Pre-paint `data-motion="on"` gate + `document.fonts.ready`; plays on all non-reduced-motion devices |
| `MorphSlider-JS-CSS` — WebGL displacement slider (`melt`, intensity `0.38`, 3s autoplay) with `<SmoothImage>` crossfade fallback | `src/components/MorphSlider.jsx`, `src/components/sections/home-gallery-slider.tsx` | `/` | `MorphSlider` | `ogl@1.0.11`, `gsap@3.13.0` (dynamic `ssr: false` inside `InViewMount`) | Deferred lazy chunk only; First Load JS unchanged; windowed 3-texture loader (`[prev, current, next]`); stops rendering when off-screen or hidden |
| `SpotlightCard-TS-TW` — existing token radial hover, now with proof marker | `src/components/common/spotlight-card.tsx` | `/` | `SpotlightCard` | None | Existing component; marker only |
| `TiltedCard-TS-TW` — pointer-capability CSS tilt on grouped database photo cards | `src/components/sections/gallery-page-content.tsx` | `/gallery` | `TiltedCard` | None; non-touch and reduced-motion fallback is the existing grid | 0 JS; CSS only |
| `CountUp-TS-TW` — in-view active-branch count updated through one DOM ref, not React state | `src/components/common/count-up.tsx` | `/` (lazy-loaded inside About) | `CountUp` | None | 622 bytes gzip for the module source; route chunk is deferred until the About counter enters view |
| `SpotlightCard-TS-TW` — token radial highlight on event content | `src/components/sections/events-client-view.tsx` | `/events` | `SpotlightCard` | None | Shared CSS only |
| `AnimatedContent-TS-TW` — short transform/opacity entrance on event/settings content | `src/components/sections/events-client-view.tsx`, `src/components/settings/settings-view.tsx` | `/events`, `/settings` | `AnimatedContent` | None | Shared CSS only |
| `BlurText-TS-TW` — transform/opacity title reveal; no blur filter or form animation | `src/components/auth/login-view.tsx` | `/login` | `BlurText` | None | Shared CSS only |
| `ShinyText-TS-TW` — token-based moving sheen on the signup side-panel heading | `src/components/auth/signup-view.tsx` | `/signup` | `ShinyText` | None | Shared CSS only |
| `ProfileCard-TS-TW` — restrained token hover response on the existing cover/avatar card | `src/components/profile/profile-view.tsx` | `/profile` | `ProfileCard` | None | Shared CSS only |
| `MagicBento-TS-TW` — transform-only dashboard metric-card hover | `src/app/admin/page.tsx` | `/admin` | `MagicBento` | None; no canvas | Shared CSS only |

The custom adaptation stylesheet is 2,975 bytes raw (925 bytes gzip); GSAP is the only new dependency. The CountUp source is 622 bytes gzip and is dynamically imported inside an in-view mount. Comparing clean production builds at T0 `0d9f879` and the current T1 output, First Load JS changed by `/` +538 bytes, `/gallery` +168, `/events` +220, `/login` +2,325, `/signup` +211, `/profile` +211, `/settings` +208, and `/admin` +207 gzip bytes. Maximum increase is 2,325 bytes, below the 25KB gate; the 27,119-byte GSAP chunk remains deferred. The Playwright marker/pause test passed across `/`, `/gallery`, `/events`, `/login`, `/signup`, `/profile`, `/settings`, and `/admin`. A cold local 360px production run under 4× CPU throttling recorded LCP 2.340s, CLS 0.00, and TTFB 672ms; this meets the local hero threshold with little margin. This local result does not substitute for field data.

## Components

| Registry component | Site use | Dependency | Decision |
|---|---|---|---|
| `FoldText-TS-TW` | Home hero title (`src/components/sections/hero.tsx`) | Registry asks for `gsap@^3.13.0`; none added | Adapt whole-word fold motion to CSS transforms. Keep Arabic words joined, SSR title visible, static reduced-motion fallback. |
| `SpotlightCard-TS-TW` | Home activity cards and home gallery preview | None | Adapted as a token-based radial highlight updated through CSS variables on fine-pointer events; no hard-coded colors, noise, React state updates or animation loop. `useLowPower({ pointerOnly: true })` turns it off for touch/low-power devices. |
| `BlurText-TS-TW` | Auth side-panel heading | Registry adds `motion@^12.23.12`; dropped in favor of a static CSS glow using `--main` to provide the requested light effect without motion work by signup inputs. No added dependency or bundle cost. |
| `Masonry-TS-TW` | Gallery candidate | Adds `@hugeicons/react` and `@hugeicons/core-free-icons` | Dropped: current responsive grid preserves reading order and reserved image size; source is about 42.8 KB (10.9 KB gzip). |
| `CountUp-TS-TW` | Admin real-stat candidate | Adds `motion@^12.23.12` | Dropped: keep live numbers immediate, without a second motion package or delayed values. |
| `ScrollReveal-TS-TW` | Shared section reveal candidate | GSAP-based registry option | Dropped in favor of one in-view wrapper and the existing Framer Motion dependency. |

The measured compressed sizes above are registry source estimates (gzip), not the final application bundle. T11 records actual route output and removes any adoption that misses the performance budget.

## Shared helpers

- `useLowPower({ pointerOnly })` gates optional effects for reduced motion, Save Data, device memory or hardware concurrency at or below four; pointer-only effects also disable on `(hover: none)`.
- `InViewMount` mounts optional effects near the viewport and unmounts them when out of view or when the document is hidden. `minHeight` can reserve the region while the effect is absent.
- `InViewReveal` uses one shared `IntersectionObserver` and DOM attributes for a transform/opacity reveal; it does not set React state per scroll or hide server-rendered text when JavaScript is unavailable.

No third-party React Bits component has been copied verbatim. Any retained adaptation uses theme tokens, keeps locale content and RTL word boundaries, honors reduced motion and touch, and avoids animation work while idle.


## Remaining page families audited for T10

| Page family | Existing behavior/surface | React Bits replacement considered | Decision |
|---|---|---|---|
| Events | Filtered live open events and live past events with one poster per card; in-view motion and flyer dialog already exist. | Add SpotlightCard per event or replace the page entrance with another reveal. | Dropped: list length is data-driven and pointer listeners would multiply with rows; the page already uses the shared SectionHeading/reveal approach and preserves flyer keyboard behavior. No measured speed win. |
| Event detail and booking flow | Server-loaded event detail plus a multi-step booking form and controlled validation. | Fold/reveal or spotlight on form steps. | Dropped: motion near inputs adds work to a conversion-critical form; no semantic benefit or performance evidence. |
| Onboarding | Three-step profile form with city lookup, image crop and required terms. | Blur/fold text effects or animated cards. | Dropped: preserve field responsiveness, validation and focus while the city/image controls already carry their own interaction. |
| Settings | Profile/photo controls, preference toggles, language/theme selectors and tag editing. | Spotlight or CountUp on control groups. | Dropped: user actions and focus state matter more than decoration; no evidence of an interaction benefit. |
| Terms/privacy | Long-form legal text with sticky section navigation. | Staggered card effects or masonry. | Dropped: linear reading order and anchor navigation are the useful pattern; animation would add movement to content without improving comprehension. |
| 403/404/error | Recovery links, retry controls and a 404 illustration. | Additional registry motion or card effects. | Dropped in T10: no demonstrated usability or speed gain. The 404's existing infinite illustration motion will be assessed with T11 idle CPU measurements before deciding whether to simplify it. |

T10 therefore makes no visual code changes outside the previously completed page-specific tasks. This is deliberate: the candidates either add per-row interaction work, affect forms, disrupt reading order, or lack measured benefit. T11 gathers route and idle metrics before any further performance edits.
