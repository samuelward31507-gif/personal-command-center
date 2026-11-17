# Cinder shot list (Higgsfield)

One hero portrait and three cinematic stills tell the story the homepage is about: the call you miss, the customer who moves on, and the estimate Cinder booked instead.
The site already has a slot for each one. Drop a file into `site/media/shots/` with the exact name below and it appears, with its reveal, on the next deploy. A slot with no file stays hidden.

**Every file:** 21:9, 2400 × 1028 px, JPG, under 400 KB (the hero is 4:5, below). No text, no logos, no brand names on trucks, shirts or signs. These are illustrations of the moment, never presented as a real customer.

**One look across all three:** shot on 35mm film, natural light, Colorado Front Range suburb, cedar and dry grass, cool morning shadows with warm sun. The same cast throughout: the installer (man, 30s, work clothes) and Dana (woman, late 30s). Muted, true-to-life colour; not glossy, not stock-photo smiling.

---

## 0. `hero-onsite.jpg` — the homepage hero (most important)

4:5 portrait, 1200 × 1500 px, under 350 KB. The site floats the live Cinder cards over this photo (missed call, text back, her reply, estimate booked), so keep the **left edge, the upper right and the lower right calm**: sky, fence or soft background, no faces there.

**Prompt:**
> Cinematic 35mm film still, vertical 4:5 portrait. A fence installer in his 30s, canvas work jacket and gloves, kneels to set a cedar post in a suburban Colorado backyard, focused on the work, his face in three-quarter profile in the lower centre of the frame. A dusty pickup tailgate in soft focus behind him. Warm late-morning sun from the left, long soft shadows, dry grass, a pale clear sky filling the upper half of the frame. Shallow depth of field, natural muted colour, subtle film grain, documentary realism. No text, no logos, no phone visible.

**Video version (optional, 5 s loop, best for this slot):** he tamps the soil around the post and checks it with a level; the camera drifts slowly in.

## 1. `on-the-job.jpg` — under "The job goes to whoever answers first"

**Caption on the site:** 2:14 PM. Halfway through setting posts. The phone rings on the tailgate, forty feet away.

**Prompt:**
> Cinematic 35mm film still, wide 21:9. A fence installer in his 30s, work gloves, faded canvas jacket, sets a cedar fence post in a fresh hole in a suburban Colorado backyard, focused and mid-motion, slightly out of focus in the mid-ground. In the sharp foreground, a smartphone lies face-up on the dropped tailgate of a dusty pickup, its screen lit with an incoming call, glowing. Stacked cedar pickets, a post-hole digger, bright early afternoon sun, long soft shadows, dry grass, Front Range foothills faint in the distance. Shallow depth of field, natural colour, subtle film grain, documentary feel. No text, no logos.

**Video version (optional, 5 s loop):** the phone screen lights up and buzzes on the tailgate; behind it the installer keeps working and never turns around.

## 2. `the-homeowner.jpg` — under "Same missed call. Two different endings."

**Caption on the site:** Dana. Three tabs open, three fence companies. She hires whoever gets back to her first.

**Prompt:**
> Cinematic 35mm film still, wide 21:9. A woman in her late 30s sits on the front porch steps of a suburban Colorado house in the early evening, typing on her phone, waiting for a reply, slightly impatient. Behind her an old weathered wooden fence leans badly, a few pickets missing. Warm low sun, cool blue shadow on the porch, a dog lying next to her. Shallow depth of field on her face and phone, natural colour, subtle film grain, quiet documentary feel. No text on the screen, no logos.

**Video version (optional):** she glances at her phone, nothing, then puts it to her ear to call the next company.

## 3. `estimate-day.jpg` — top of the booking section

**Caption on the site:** Thursday, 8:00 AM. The estimate Cinder booked while you were working. You just show up.

**Prompt:**
> Cinematic 35mm film still, wide 21:9. Early morning in a quiet Colorado suburb. A clean, unbranded white pickup truck pulls up to the curb in front of a house; the same fence installer steps out holding a tape measure and a clipboard. At the front door, a woman waves him in with a coffee mug. The old leaning fence is visible at the side of the house. Golden low sun, long shadows, dew on the lawn, calm and confident mood. Wide composition with space on both sides, natural colour, subtle film grain. No text, no logos, no lettering on the truck.

**Video version (optional):** the truck rolls to a stop, the door opens, he steps out as she opens the front door.

---

## After generating

1. Pick the strongest of each, and check hands, faces and phones closely for AI artefacts. Reject any with warped fingers or text.
2. Export at 2400 × 1028 and compress to under 400 KB (Squoosh, MozJPEG, quality around 78).
3. Send them to Claude or put them in `site/media/shots/` with these exact names.
