# Figma → Code Mapping: Swap Page

**Source:** [Giwater Design — Swap Page (node 1:2)](https://www.figma.com/design/KNgl8AU6HQ6X26TzS20Omy/Giwater---Design?node-id=1-2)
**File key:** `KNgl8AU6HQ6X26TzS20Omy`
**Top-level node:** `1:2` (Canvas `Swap`)

## Scope

Only two sections of the canvas are in scope:

1. **`Main(Swap)-ENG`** (title node `236:23679`, y ≈ -19322) — **desktop** screens at y ≈ -18279 to -14581 (widths 1440).
2. **`Swap`** (title node `527:7696`, y ≈ -18869) — the section immediately to the right of `Main(Swap)-ENG`, which contains all **mobile** screens at y ≈ -17979 to -16413 (widths 390).

Everything else on the canvas is **discarded** and not mapped:

- `Main(Swap)-KOR` (title `946:68277`, y ≈ 3168) and the mirrored mobile `Swap` block at y ≈ 3073 — Korean copy is provided by `next-intl` translation files, not by separate Figma screens.
- Exploratory frames `buying`, `case1`, `case2`, `case3` (y ≈ -10000 to -12495).

## Priority legend

| Priority | Meaning |
|---|---|
| P0 | Core swap screens already in production; primary visual-fidelity target |
| P1 | Existing secondary states (modals, settings) needing rework against Figma |
| P2 | Variants / edge cases / mobile-only auxiliary flows |
| P3 | Out of swap scope (handled by another feature directory) |

---

## Desktop screens (1440 × 1024)

> **Note on Figma metadata:** Many frames have a `data-name` (e.g. `select wallet`) that does NOT match their on-canvas title-text label. The actual state is determined by the **title-text above the frame**, not by `data-name`. The corrections below were made by reading title-text and screenshot content rather than trusting frame names. The originals are noted in italics where they differ.

| Figma component (title-text) | Figma node-id | Current code path | Priority |
|---|---|---|---|
| `Default` (Swap_Main) | `1442:115393` | `apps/web/components/pages/swap/SwapDesktopPageView.tsx` + `apps/web/components/swap/SwapCard.tsx` | P0 |
| `Success Status` — *ready-to-swap with valid input (form populated, button enabled)* | `1446:20930` | Already handled by `SwapCard.tsx` enabled state; no separate component needed | P0 |
| `Error Status` | `1446:21352` | NEW — currently only inline error text inside `SwapButton.tsx`; no dedicated error panel | P0 |
| `Swap flow` #1 — ready-to-submit *(frame data-name "swap")* | `1448:23165` | Already handled by `SwapCard.tsx` enabled state; no separate component needed | P1 |
| `Swap flow` #2 — Waiting for approval in wallet *(frame data-name "swap")* | `1448:23520` | `apps/web/components/swap/SwapPending.tsx` (right-panel mode `pending` in `SwapCard.tsx`) | P0 |
| `Swap flow` #3 — Swap completed / success *(frame data-name "swap")* | `1448:25077` | `apps/web/components/swap/SwapCompleted.tsx` (right-panel mode `completed` in `SwapCard.tsx`) | P0 |
| `Swap - Fail` (swap_fail) | `1448:25270` | NEW — no dedicated fail screen on desktop | P0 |
| `Select Token` *(frame data-name "select wallet")* | `1451:27367` | `apps/web/components/swap/TokenSelectModal.tsx` (trigger: `apps/web/components/swap/TokenSelect.tsx`) | P0 |
| `White list X` — token not whitelisted, variant 1 *(frame data-name "select wallet")* | `1452:27401` | NEW — no whitelist warning UI in current SwapCard; whitelist flow is currently inside `TokenSelectModal.tsx` (inline) | P1 |
| `White list X` — token not whitelisted, variant 2 *(frame data-name "select wallet")* | `1452:27551` | NEW — same as above (variant) | P1 |
| `Selcect wallet` (actual wallet picker) — 3 variants | `625:26309`, `1448:26979`, `1448:33026` | Provided by RainbowKit `<ConnectButton />` in `apps/web/components/layout/Header.tsx`; no custom modal in repo | P2 |
| `Setting_Disconnected` (Setting, wallet disconnected) | `1450:11128` | NEW branch — `SettingsModal.tsx` does not currently differentiate connected/disconnected (Disconnected layout = "Connect your wallet" simplified panel, w=430) | P1 |
| `Setting_Connected` (Setting, wallet connected) | `1450:14907` | `apps/web/components/settings/SettingsModal.tsx` (current default rendering matches this state) | P1 |
| `tooltip` (상단 더보기 메뉴 클릭시) | `1450:14918` | NEW — header overflow/more-menu tooltip not implemented; `Header.tsx` has no overflow menu | P2 |
| `Slippage Tolerance Settings` (slippage) | `1455:30401` | `apps/web/components/swap/SlippageSettings.tsx` | P0 |

## Mobile screens (390 × 844)

| Figma component | Figma node-id | Current code path | Priority |
|---|---|---|---|
| `Swap` — Default | `811:11060` | `apps/web/components/pages/swap/SwapMobilePageView.tsx` + `apps/web/components/swap/SwapMobileCard.tsx` | P0 |
| `Swap` — Main (alt layout) | `811:10650` | `apps/web/components/swap/SwapMobileCard.tsx` (variant) | P0 |
| `Swap` — Success Status | `811:11289` | `apps/web/components/swap/SwapCompleted.tsx` (mobile branch in `SwapMobileFlow.tsx`) | P0 |
| `Swap` — Error Status | `811:11566` | NEW — no dedicated mobile error state component | P0 |
| `Swap` — Risk Message | `811:11817` | NEW — no risk-message UI in current mobile card | P1 |
| `Swap` — Swap - Fail (frame label inaccurate; actual content is the mobile header dropdown menu) | `1457:36597` | `apps/web/components/layout/Header.tsx` (mobile `mobileMenuOpen` dropdown). The real mobile fail UX is the `Swap Flow` extra variant `1457:34516` — pending screen + inline "Transaction failed / Retry" banner, rendered via `SwapMobilePending` `failed`/`onRetry` props. | P0 |
| `Swap Flow` — step 1 | `813:12340` | `apps/web/components/swap/SwapMobileFlow.tsx` (step 1 branch) | P0 |
| `Swap Flow` — step 2 | `813:12933` | `apps/web/components/swap/SwapMobileFlow.tsx` (step 2 branch) | P0 |
| `Swap Flow` — step 3 | `813:13131` | `apps/web/components/swap/SwapMobileFlow.tsx` (step 3 branch) | P0 |
| `Swap Flow` — extra variant | `1457:34516` | `apps/web/components/swap/SwapMobileFlow.tsx` (variant) | P1 |
| `select wallet` (mobile) | `895:50196` | Provided by RainbowKit `<ConnectButton />` (mobile sheet variant) | P2 |
| `Setting_Disconnected` (mobile) | `895:51844`, `1457:36579` | `apps/web/components/settings/SettingsModal.tsx` (mobile state branch) | P1 |
| `Setting_Connected` (mobile) | `895:51986` | `apps/web/components/settings/SettingsModal.tsx` (mobile state branch) | P1 |
| `Swap` — short variant (h=522) | `946:73169` | NEW — likely a collapsed/short-form swap card variant | P2 |
| `Launch Pool` (mobile) — 5 frames | `1457:35828`, `895:50816`, `895:50593`, `946:74092`, `946:74268` | `apps/web/components/pages/pool/launch/LaunchPoolMobilePageView.tsx` — **belongs to /pool/launch, not /swap** | P3 |

## Reusable components (Figma `instance` references)

These appear inside multiple screens above. Mapping is shared regardless of which screen embeds them.

| Figma component | Current code path | Priority |
|---|---|---|
| `Application bar` / `Header` | `apps/web/components/layout/Header.tsx` | P1 |
| `Page header` / `Page header_mobile` | `apps/web/components/common/PageHeader.tsx` + `apps/web/components/common/PageBanner.tsx` | P1 |
| `Swap section_desktop` | `apps/web/components/swap/SwapCard.tsx` | P0 |
| `Swap section_mobile` | `apps/web/components/swap/SwapMobileCard.tsx` | P0 |
| `Swap section` (base) | (shared between SwapCard / SwapMobileCard — no extracted primitive) | P1 |
| `Swap info` | `apps/web/components/swap/SwapInfo.tsx` | P0 |
| `swap info_mobile` | NEW — no dedicated mobile variant; SwapMobileCard renders info inline | P1 |
| `Button-large` / `Button-small` / `Button-mobile` / `CTA` | `apps/web/components/common/Button.tsx` | P1 |
| `CTA/alert-triangle`, `CTA/copy-right` | NEW — Button.tsx does not expose alert / status variants | P1 |
| `Coin Logo` | `apps/web/components/common/TokenIcon.tsx` | P0 |
| `Check mark` | NEW — used in success state; no shared component | P2 |
| `Spinner` | NEW — `SwapPending.tsx` has ad-hoc spinner; no shared primitive | P2 |
| `State message` | NEW — needed for inline success / error / risk messaging | P0 |
| `Search` / `search-01` | `apps/web/components/swap/TokenSelectModal.tsx` (inline `<input>`); no shared Search primitive | P2 |
| `status` / `status bar` | NEW — top-of-card status indicator not implemented | P1 |
| Icons (`alert-triangle`, `arrow-switch-horizontal`, `chevron-down`, `coins-rotate`, `link-external`, `lock-03`, `notification`, `percent-01`, `pie-chart-02`, `wallert-04`, `wind-02`, `x-01`) | Currently inlined SVGs in `SwapCard.tsx` / `SwapMobileCard.tsx` (e.g. `SwapToggleIcon`, `PercentIcon`); no shared icon set | P2 |

---

## Summary of gaps vs existing code

**New components needed (NEW rows above):**
1. `State message` primitive (success / error / risk inline panels) — referenced by error / risk states
2. `Swap_Error` / `swap_fail` dedicated panels (today only inline button text)
3. `White list X` (non-whitelisted token warning) — both desktop and mobile; current whitelist UX is inline inside `TokenSelectModal` (not a standalone screen)
4. `Risk Message` (mobile) — pre-swap risk disclosure
5. `Setting_Disconnected` branch — `SettingsModal` does not currently render the simplified "Connect your wallet" panel when wallet is disconnected
6. `status` / `status bar` indicator
7. `swap info_mobile` extracted variant of `SwapInfo`
8. `CTA/alert-triangle`, `CTA/copy-right` button variants
9. Header overflow `tooltip` menu (P2 — header rework)
10. Shared `Search`, `Spinner`, `Check mark`, icon set (P2 — design-system cleanup)

**Existing code that maps cleanly (no NEW work):**
- Main entry: `SwapCard`, `SwapMobileCard`, `SwapMobileFlow`
- Swap progression: `SwapPending` (1448:23520), `SwapCompleted` (1448:25077)
- Settings: `SettingsModal` (currently only Connected branch — Disconnected is NEW)
- Token select: `TokenSelectModal` (1451:27367)
- Slippage: `SlippageSettings` (1455:30401)
- Wallet select: RainbowKit `<ConnectButton />` for 625:26309 / 1448:26979 / 1448:33026
- Out-of-scope: `Launch Pool` lives under `/pool/launch`, not `/swap`

## Frame data-name vs title-text mismatch (Figma metadata caveat)

The Figma file has several frames where `data-name` and on-canvas title-text disagree. **Always trust title-text over `data-name`.** Confirmed mismatches in the desktop section:

| Node | `data-name` | Actual title-text | What it really is |
|---|---|---|---|
| `1448:23165` | `swap` | (under `Swap flow` group title) | Ready-to-swap state |
| `1448:23520` | `swap` | (under `Swap flow` group title) | Waiting for approval |
| `1448:25077` | `swap` | (under `Swap flow` group title) | Swap completed |
| `1451:27367` | `select wallet` | `Select Token` | Token picker modal |
| `1452:27401` | `select wallet` | `White list X` | Non-whitelisted token warning |
| `1452:27551` | `select wallet` | `White list X` | Non-whitelisted variant |

The `Swap flow` group title (`518:5750`, w=4491) spans 3 frames at x=-14408 through x=-9917, labeling 1448:23165 / 1448:23520 / 1448:25077 collectively as the swap-progression states.
