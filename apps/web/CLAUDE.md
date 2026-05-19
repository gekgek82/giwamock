# Frontend (Next.js) - Claude Code Rules

> See root `CLAUDE.md` for full project context.

## Frontend-Specific Rules

- Default components are Server Components (no directive needed).
- Add `'use client'` at top for interactive components.
- Use Tailwind CSS for styling. Follow mobile-first responsive design.
- Import API routes from `@giwater/shared`: `import { API_ROUTES } from '@giwater/shared';`

## Layout and responsiveness

- **Page width and gutters:** Use `PageContainer` from `@/components/layout/PageContainer` with `maxWidth="app"` (same as the header shell, `max-w-[1360px]`) or `maxWidth="content"` (`max-w-7xl`). Shared padding lives in `@/lib/page-layout` (`PAGE_GUTTER_CLASS`).
- **Responsiveness (default):** Use Tailwind only — responsive prefixes (`sm:`, `md:`, `lg:`, …) compile to CSS media queries, so layout and visibility do **not** need JavaScript. That is the normal and preferred approach.
- **JS breakpoints (rare):** Use `useMediaMinWidth` from `@/hooks/useMediaMinWidth` with keys from `@/lib/breakpoints` only when CSS cannot express what you need (e.g. mount different component trees, run different client-only logic, or integrate a library that requires a JS width/breakpoint). Otherwise skip the hook.
- **Atomic design:** The tree is mostly **feature folders** (`swap/`, `vote/`, `admin/`, …), not strict atoms/molecules/organisms. For new primitives, prefer `components/common/` or shadcn-style `components/ui/` when introduced; keep feature-specific pieces under the feature folder.
- **Route-level views:** Each `app/**/page.tsx` stays thin. Put the **current full screen** in **`{Feature}DesktopPageView`**. **`{Feature}MobilePageView`** is the small-screen implementation (or a temporary `MobileNotSupportedPlaceholder` with a `// TODO: get figma design and generate code.` until Figma is implemented). In `app/**/page.tsx`, switch with Tailwind only, e.g. `<div className="hidden lg:block"><…Desktop /></div>` and `<div className="lg:hidden"><…Mobile /></div>` (both may mount; prefer a single shell later if that becomes a problem). Shared chrome: `SitePageShell` inside each view or a future shared wrapper. **Exception:** `/liquidity` renders **`LiquidityDesktopPageView` only** until a real mobile layout exists (the pool table already scrolls horizontally; the placeholder would hide all pairs below `lg`).

## UX Rules

- **No UI flickering.** When async data changes, use debounce, `keepPreviousData`, CSS transitions, etc. to ensure smooth visual transitions.
- When conditional rendering causes layout shifts, use `visible`/`invisible` to reserve space instead of mounting/unmounting elements.

## Post-Edit Verification (REQUIRED)

After every edit to `apps/web/**`, verify the app still works:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3007
```

## Troubleshooting

- `Cannot find module './NNN.js'`: Run `rm -rf apps/web/.next` then restart dev server.
- `Invalid hook call`: Add `'use client'` directive or restructure.
