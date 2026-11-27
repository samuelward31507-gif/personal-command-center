# Homepage plan (Sam's verdicts, Nov 26 2026, 21:44)

Direction (decided, hold it): Attio-style. Clean framed sections. Visuals are the thing we sell (real app
screens and real messages, flat and exact) or thin-line drawings. No more 3D renders, except the patch bay.
Keep: black / graphite / bone with crimson, the ribbon, the page frame and ruler ticks. No dot texture behind visuals.

Section by section:
1. Hero: the C must not slide under the "works alongside" tools strip when scrolling. Fix.
2. Where the jobs go: good, but make it a split screen, crisper. The leaks row at the top looks weak.
3. Every missed call (numbers): looks fine but says nothing. Give it real information.
4. First, a free audit: the 6-layer 3D reads as tacky. Redo as simple line geometry (Attio line art).
5. A new lead hears back in seconds: not Attio quality. Pills top right are cramped. No dots. Rebuild as a product piece.
6. Then we build only what you need (patch bay): KEEP. The only 3D on the page.
7. The estimate lands on your calendar: good idea, make it better. Best: a screen from the actual CRM.
8. A quote gets chased: dots look cheap, layout disliked. Redo.
9. What you get back (dial): replace with a stacking design that builds as you scroll.
10. The invoice gets paid: redo, no dots.
11. Reviews: the diagram is not good enough. Redo.
12. Something only your business has: disliked. Redo.
13. If AI can do it, we build it (eight cells): good. Keep.
14. Fifteen minutes, you leave with a plan: good. Keep.
Also: type and fonts across the site feel weak. No voice AI pitched anywhere on the homepage.
Still to capture from attio.com for reference: ask, workflows, enrichment, ai, customers, apps, changelog, pricing.

## Pass 7 (built, on the preview)
- Visuals are now pieces of the app in its own white UI on plain dark panels (classes `.ax`, `.axp`, `.ap*` in home2.css; built in design/patch_home.py; scroll driver in home2.js steps `data-at` / `data-lit` / `data-is` / `data-v` / `data-w`).
- Order: hero, tools, where the jobs go (audit findings card), numbers (+ "In your audit" lines), first a free audit (six layers as line geometry), patch bay (only 3D kept), speed to lead (conversation), calendar screen, quote timeline, invoice, review (bone), custom build (steps), what you get back (Today screen), everything grid, call, close.
- Retired from the homepage: the 3D leak track (cinder-leaks.js), the six-layer render (cinder-unit.js), the dial. Dot textures removed. Hero no longer overlaps the tools strip.
- Class names to avoid on the homepage (already taken by index.html): `.bd`, `.hd`, `.ln`.
- Type: tracking loosened, labels moved from mono to Inter. A different typeface needs a font file from Sam.
