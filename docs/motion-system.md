# Cinder motion system

One system across the website, the command center (`app/(agency)`) and the client app (`app/(client)`).
The command center already runs it: see the "Motion system" block in `app/(agency)/cinder.css`.
This doc is the spec for applying the same system to `app/(client)`, which is owned by the Claude Code session working there.

The bar is Linear, Attio, Raycast and Superhuman: motion that answers what the person did, never decoration.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--k-ease-out` | `cubic-bezier(.16, 1, .3, 1)` | anything arriving |
| `--k-ease-in` | `cubic-bezier(.4, 0, 1, 1)` | anything leaving |
| press | 120ms | button and row press, hover colour |
| surface | 180–220ms | dialogs, sheets, menus, toasts |
| page | 320ms | route entrance |

Distances are small: 4px for rows, 6–8px for pages and dialogs. Nothing slides more than 12px. Nothing bounces.

## Rules

1. **Route entrance.** The element directly under the app shell's main panel gets `k-route` (opacity 0→1, translateY 8px→0, 320ms). Animate the routed element itself, not a wrapper: the shell's CSS uses direct-child selectors (`> main`, `> .u-page`), and a wrapper breaks them. A new page mounts a new element, so the entrance replays on every navigation with no JS.
2. **List stagger.** Rows in a list arrive 15ms apart, starting at 40ms, capped at the 8th row (145ms). Rows after that land together. Never stagger more than ~150ms in total: lists must feel instant.
3. **Numbers.** Headline figures settle in with a short rise and a 3px blur clearing (420ms, 120ms delay). Use `font-variant-numeric: tabular-nums` so digits never jitter.
4. **Overlays.** The scrim fades in over 180ms. The dialog or sheet rises 8px and scales from .97 over 220ms, 30ms after the scrim. Bottom sheets on mobile rise from below (translateY 100%→0, 260ms) instead.
5. **Press.** Buttons scale to .97 on `:active`; tappable rows scale to .995. Transition transform over 120ms.
6. **Confirmations.** When an action succeeds (job booked, quote sent, invoice paid), the changed item flashes its tint once (background to the success wash and back, 600ms) and a toast rises from the bottom. The toast copy uses the button's verb: "Send quote" → "Quote sent".
7. **Reduced motion.** Under `prefers-reduced-motion: reduce`, every animation and transition is off. Keep the global kill switch already in each stylesheet.
8. **What never moves.** The sidebar, the top bar, and anything the person is reading or typing into. No scroll-triggered reveals inside the app. No looping animation except a live indicator (one small pulsing dot) and loading states.

## Client app checklist (`app/(client)`)

- [ ] Add the tokens and keyframes (`k-route`, `k-row`, `k-fig`, `k-fade`, `k-pop`) to the client stylesheet. Copy them from `app/(agency)/cinder.css`.
- [ ] Route entrance on the client shell's main child.
- [ ] Stagger on the inbox, jobs list and calendar agenda rows.
- [ ] Figure settle on the Today and Money numbers.
- [ ] Scrim, dialog and mobile bottom sheet entrances.
- [ ] Press states on buttons, rows and the bottom tab bar.
- [ ] Confirmation flash and toast on booking, sending a quote and marking an invoice paid.
- [ ] Reduced-motion kill switch.
- [ ] Check each screen settles cleanly: no element left at opacity 0, and no `position: fixed` child jumping during the 320ms entrance.

## Website

The site uses cross-document view transitions (`@view-transition { navigation: auto; }` in `site/v2.css`). The nav has `view-transition-name: site-nav`, so it stays fixed while the page under it cross-fades: the old page leaves in 160ms, the new one rises in over 340ms. The hero product stage carries the one orchestrated sequence on the site (missed call → text back in 9 seconds → estimate booked); section reveals stay subtle.
