# React Bits audit and adoption

The `@react-bits` registry is configured in `components.json`. The Shadcn MCP server is not exposed in this Codex runtime; the configured registry was reachable through `npx shadcn@latest search` and `view`.

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
