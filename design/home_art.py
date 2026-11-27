"""Line illustrations for the homepage. Plain thin-line drawings, no words in them. One red detail each.
Parts tagged data-lit="n" drop in as the scroll reaches step n (driver in site/assets/home2.js)."""
import math

BB = []  # every point drawn, so each drawing can be cropped to what is in it

class Iso:
    """2:1 isometric. x runs down-right, y runs down-left, z is up."""
    def __init__(s, ox, oy, k=1.0): s.ox, s.oy, s.k = ox, oy, k
    def p(s, x, y, z=0):
        q = (round(s.ox + (x - y) * s.k, 1), round(s.oy + (x + y) * .5 * s.k - z * s.k, 1)); BB.append(q); return q
    def path(s, pts, close=True, cls=''):
        d = 'M' + ' L'.join('%s,%s' % s.p(*q) for q in pts) + (' Z' if close else '')
        return '<path%s d="%s"/>' % (' class="%s"' % cls if cls else '', d)
    def slab(s, x, y, z, w, d, h, cls='', shade=0):
        """a box: left face, right face, top. Each face has its own tone, so it reads as solid without extra lines."""
        c = (' ' + cls) if cls else ''
        return (s.path([(x, y + d, z + h), (x + w, y + d, z + h), (x + w, y + d, z), (x, y + d, z)], cls='lf' + c)
                + s.path([(x + w, y + d, z + h), (x + w, y, z + h), (x + w, y, z), (x + w, y + d, z)], cls='rt' + c)
                + s.path([(x, y, z + h), (x + w, y, z + h), (x + w, y + d, z + h), (x, y + d, z + h)], cls='tp' + c))
    def bevel(s, x, y, z, w, d, m=8):
        """an inset line on a top face, the way a machined edge reads"""
        return s.path([(x + m, y + m, z), (x + w - m, y + m, z), (x + w - m, y + d - m, z), (x + m, y + d - m, z)], cls='bv nf')
    def grid(s, cx, cy, half, step=30):
        """a ground grid under the object, faded out toward its edge (mask #ilm lives once in the page)"""
        keep = len(BB); n = int(half // step); g = []
        for i in range(-n, n + 1):
            v = i * step; g.append(s.path([(cx + v, cy - half, 0), (cx + v, cy + half, 0)], False)); g.append(s.path([(cx - half, cy + v, 0), (cx + half, cy + v, 0)], False))
        del BB[keep:]
        return '<g class="gd" mask="url(#ilm)">' + ''.join(g) + '</g>'
    def callout(s, x, y, z, text, side=1, rise=22, run=30, cls='', sub=''):
        """a part's name: a dot on the part, a thin leader, a small label, and under it one quieter line of detail"""
        px, py = s.p(x, y, z); ex = px + side * (abs(rise) * .6 + run); ey = py - rise
        BB.append((ex + side * (max(len(text), len(sub)) * 7.6 + 14), ey - 10))
        if sub: BB.append((ex, ey + 24))
        an = 'start' if side > 0 else 'end'; tx = round(ex + side * 8, 1)
        t2 = '<text class="lb sub" x="%s" y="%s" text-anchor="%s">%s</text>' % (tx, round(ey + 19, 1), an, sub) if sub else ''
        return ('<circle class="cd" cx="%s" cy="%s" r="2.2"/><path class="cl nf" d="M%s,%s l%s,%s h%s"/><text class="lb%s" x="%s" y="%s" text-anchor="%s">%s</text>%s'
                % (px, py, px, py, round(side * abs(rise) * .6, 1), -rise, side * run, (' ' + cls) if cls else '', tx, round(ey + 4, 1), an, text, t2))
    def plus(s, x, y, z=0, r=5):
        """a registration cross lying on a face"""
        return s.path([(x - r, y, z), (x + r, y, z)], False, 'pm nf') + s.path([(x, y - r, z), (x, y + r, z)], False, 'pm nf')
    def foot(s, x, y, w, d, m=11):
        """where an object meets the ground: an outline set just outside it, with a cross at each corner"""
        keep = len(BB); c = [(x - m, y - m), (x + w + m, y - m), (x + w + m, y + d + m), (x - m, y + d + m)]
        o = s.path([(a, b, 0) for a, b in c], cls='fo nf') + ''.join(s.plus(a, b) for a, b in c); del BB[keep:]; return o
    def ticks(s, x, y, z, w, n, h=5, axis='x'):
        """ruler ticks hanging off an edge, every fifth one longer"""
        d = ''
        for i in range(1, n):
            v = i * w / n; q = s.p(x + v, y, z) if axis == 'x' else s.p(x, y + v, z); d += 'M%s,%s v%s ' % (q[0], q[1], h * 1.9 if i % 5 == 0 else h)
        return '<path class="tkk nf" d="%s"/>' % d
    def risers(s, x, y, z0, z1, w, d):
        """something lifted off a face: its outline left behind on the face, and thin lines up to its corners"""
        o = s.path([(x, y, z0), (x + w, y, z0), (x + w, y + d, z0), (x, y + d, z0)], cls='rs ds nf')
        return o + ''.join(s.path([(a, b, z0), (a, b, z1)], False, 'rs ds nf') for a, b in ((x, y + d), (x + w, y + d), (x + w, y)))
    def link(s, pts):
        """the order things happen in: a dashed line from one part to the next, with a small arrowhead"""
        q = [s.p(*p) for p in pts]; (x1, y1), (x2, y2) = q[-2], q[-1]; L = math.hypot(x2 - x1, y2 - y1) or 1; ux, uy = (x2 - x1) / L, (y2 - y1) / L
        ah = 'M%.1f,%.1f L%s,%s L%.1f,%.1f' % (x2 - ux * 7 - uy * 3.5, y2 - uy * 7 + ux * 3.5, x2, y2, x2 - ux * 7 + uy * 3.5, y2 - uy * 7 - ux * 3.5)
        return '<path class="lk ds nf" d="M%s"/><path class="ah nf" d="%s"/>' % (' L'.join('%s,%s' % p for p in q), ah)
    def dial(s, x, y, z, r1, r2, n=12):
        """the minute marks of a dial lying on a face"""
        return '<path class="tkk dl nf" d="%s"/>' % ''.join('M%s,%s L%s,%s ' % (s.p(x + r1 * math.cos(k * 2 * math.pi / n), y + r1 * math.sin(k * 2 * math.pi / n), z) + s.p(x + r2 * math.cos(k * 2 * math.pi / n), y + r2 * math.sin(k * 2 * math.pi / n), z)) for k in range(n))
    def sheet(s, x, y, z, w, d, rows=3):
        """what is printed on a quote or an invoice: a mark, a heading, a rule, rows with an amount each, and the total"""
        o = s.path([(x + 18, y + 18, z), (x + 44, y + 18, z), (x + 44, y + 44, z), (x + 18, y + 44, z)], cls='sk nf')
        o += s.path([(x + 56, y + 24, z), (x + w - 18, y + 24, z)], False, 'sk') + s.path([(x + 56, y + 38, z), (x + w * .62, y + 38, z)], False, 'sk2') + s.path([(x + 18, y + 60, z), (x + w - 18, y + 60, z)], False, 'sk2')
        for i in range(rows):
            v = y + 78 + i * 20; o += s.path([(x + 18, v, z), (x + w * (.56 if i % 2 else .48), v, z)], False, 'sk') + s.path([(x + w - 44, v, z), (x + w - 18, v, z)], False, 'sk')
        v = y + 78 + rows * 20 + 6
        return o + s.path([(x + 18, v, z), (x + w - 18, v, z)], False, 'sk2') + s.path([(x + w - 66, v + 16, z), (x + w - 18, v + 16, z)], False, 'hi nf') + s.path([(x + 18, v + 16, z), (x + 52, v + 16, z)], False, 'sk')
    def lines(s, x, y, z, w, d, rows, cls='sk', inset=14, short=()):
        """skeleton lines of text across a face, running along x"""
        out = []
        for i in range(rows):
            t = y + inset + i * (d - 2 * inset) / max(1, rows - 1)
            out.append(s.path([(x + inset, t, z), (x + (w - inset) * (.55 if i in short else 1), t, z)], False, cls))
        return ''.join(out)
    def hatch(s, x, y, z, w, d, gap=9, cls='ht'):
        return ''.join(s.path([(x, y + t, z), (x + w, y + t, z)], False, cls) for t in [gap * i for i in range(1, int(d // gap))])
    def ring(s, x, y, z, r, cls=''):
        cx, cy = s.p(x, y, z); BB.extend([(cx - r * 1.414 * s.k, cy - r * .707 * s.k), (cx + r * 1.414 * s.k, cy + r * .707 * s.k)]); return '<ellipse%s cx="%s" cy="%s" rx="%s" ry="%s"/>' % (' class="%s"' % cls if cls else '', cx, cy, round(r * 1.414 * s.k, 1), round(r * .707 * s.k, 1))
    def coin(s, x, y, z, r, h, cls=''):
        cx, top = s.p(x, y, z + h); _, bot = s.p(x, y, z); rx, ry = round(r * 1.414 * s.k, 1), round(r * .707 * s.k, 1); c = ' class="%s"' % cls if cls else ''; BB.extend([(cx - rx, top - ry), (cx + rx, bot + ry)])
        c2 = ' class="tp%s"' % ((' ' + cls) if cls else ''); c = ' class="lf%s"' % ((' ' + cls) if cls else '')
        return '<path%s d="M%s,%s V%s A%s,%s 0 0 0 %s,%s V%s Z"/><ellipse%s cx="%s" cy="%s" rx="%s" ry="%s"/>' % (c, cx - rx, top, bot, rx, ry, cx + rx, bot, top, c2, cx, top, rx, ry)
    def note(s, x, y, z, w, d, h, cls='', rows=2, red=False):
        """a message: a thin slab with a small tail at its front edge and lines of writing on it"""
        tail = s.path([(x + 12, y + d, z + h), (x + 12, y + d + 15, z + h), (x + 30, y + d, z + h)], True, cls)
        return tail + s.slab(x, y, z, w, d, h, cls) + s.lines(x, y, z + h, w, d, rows, 'rd nf' if red else 'sk', 13, short=(rows - 1,))
    def check(s, x, y, z, r, cls='hi nf'):
        return s.path([(x - r * .1, y + r * .55, z), (x + r * .45, y + r * .95, z), (x + r, y - r * .35, z)], False, cls)
    def star(s, x, y, z, r, cls=''):
        pts = [(x + (r if i % 2 == 0 else r * .42) * math.cos(-math.pi / 4 + i * math.pi / 5), y + (r if i % 2 == 0 else r * .42) * math.sin(-math.pi / 4 + i * math.pi / 5), z) for i in range(10)]
        return s.path(pts, True, cls)

def svg(body, label, vb=None, pad=36, icon=False):
    if vb is None:
        xs = [a for a, _ in BB]; ys = [b for _, b in BB]; vb = '%d %d %d %d' % (min(xs) - pad, min(ys) - pad - 22, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad + 22)
    del BB[:]
    if icon: return '<svg class="il" viewBox="%s" aria-hidden="true">%s</svg>' % (vb, body)
    return '<svg class="lnv il" viewBox="%s" role="img" aria-label="%s">%s</svg>' % (vb, label, body)
def lit(n, body, cls=''): return '<g data-lit="%d"%s>%s</g>' % (n, ' class="%s"' % cls if cls else '', body)

def funnel():
    """Jobs go in at the top. Fewer come out. Three leave through the side. Six rings, one for each point the audit follows."""
    cx, R = 320, [(60, 214), (128, 178), (196, 142), (264, 106), (332, 74), (400, 46)]; o = []
    o.append('<path class="rs ds nf" d="M%s,26 V512"/>' % cx)   # the axis it turns on
    for k in range(1, 8):   # the surface, as a wireframe: lines running down the near side from ring to ring
        th = math.pi * k / 8; o.append('<path class="wf nf" d="M%s"/>' % ' L'.join('%.1f,%.1f' % (cx + rx * math.cos(th), y + rx * .24 * math.sin(th)) for y, rx in R))
    for i, (y, rx) in enumerate(R):
        ry = round(rx * .24, 1)
        o.append('<path class="ft nf" d="M%s,%s A%s,%s 0 0 1 %s,%s"/>' % (cx - rx, y, rx, ry, cx + rx, y))
        o.append('<path class="wf nf" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (cx - rx + 7, y + 5, rx - 7, round((rx - 7) * .24, 1), cx + rx - 7, y + 5))
        o.append('<path class="nf" data-is="%d" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (i, cx - rx, y, rx, ry, cx + rx, y))
        o.append('<path class="tkk nf" d="M%s,%s h-7 M%s,%s h7"/>' % (cx - rx - 4, y, cx + rx + 4, y))
    for (y1, r1), (y2, r2) in zip(R, R[1:]):
        o.append('<path class="nf" d="M%s,%s L%s,%s M%s,%s L%s,%s"/>' % (cx - r1, y1, cx - r2, y2, cx + r1, y1, cx + r2, y2))
    y, rx = R[-1]; o.append('<path class="nf" d="M%s,%s V%s M%s,%s V%s"/><path class="nf" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (cx - rx, y, y + 50, cx + rx, y, y + 50, cx - rx, y + 50, rx, 11, cx + rx, y + 50))
    seed = 7
    def rnd():
        nonlocal seed; seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648
    for band, n in enumerate([11, 9, 6, 5, 3]):
        (y1, r1), (y2, r2) = R[band], R[band + 1]
        for _ in range(n):
            u = .16 + rnd() * .6; w = (r1 + (r2 - r1) * u) * .7
            o.append('<circle class="dt drip" style="animation-delay:-%.2fs" cx="%.1f" cy="%.1f" r="3"/>' % (rnd() * 3.6, cx + (rnd() * 2 - 1) * w, y1 + (y2 - y1) * u))
    o.append('<circle class="dt drip" style="animation-delay:-.4s" cx="%s" cy="470" r="3"/><circle class="dt drip" style="animation-delay:-2.1s" cx="%s" cy="492" r="3"/>' % (cx - 8, cx + 10))
    NAMES = ['First call', 'Reply', 'Booked', 'Quote', 'Paid', 'Review']; LEFT = ['100 leads in', '71 still here', '58', '39', '34', '22 reviews']; LX = cx + 250
    for i, (y, rx) in enumerate(R):
        o.append('<g class="fl" data-is="%d"><path class="cl nf" d="M%s,%s H%s"/><text class="lb" x="%s" y="%s">%02d  %s</text><text class="lb sub" x="%s" y="%s">%s</text></g>' % (i, cx + rx + 16, y, LX, LX + 10, y + 4, i + 1, NAMES[i], LX + 10, y + 19, LEFT[i]))
    LEAK = {1: ('−$2,400/mo', 'After-hours calls'), 3: ('−$3,100/mo', 'No quote follow-up'), 5: ('−$900/mo', 'Never asked')}
    for n in (1, 3, 5):
        y, rx = R[n]; x = cx - rx; ex, ey = x - 74, y + 70
        o.append(lit(n, '<path class="rd ds flow nf" d="M%.1f,%.1f q-60,4 -74,70"/><circle class="rdt" cx="%.1f" cy="%.1f" r="4"/><text class="lb rdx" x="%.1f" y="%.1f" text-anchor="end">%s</text><text class="lb" x="%.1f" y="%.1f" text-anchor="end">%s</text>' % (x, y, ex, ey, ex - 12, ey + 1, LEAK[n][0], ex - 12, ey + 18, LEAK[n][1]), 'fade'))
    return svg(''.join(o), 'A funnel drawn in thin lines with six rings, one for each point from first call to review. Many dots go in at the top and only a few come out at the bottom. Three red lines leave through its side with what each leak costs a month in this example: 2,400, 3,100 and 900 dollars.', '-110 8 846 520')

def reply():
    """A phone lying flat. A message rises off it, and the answer is already above it."""
    I = Iso(300, 200, 1.0); o = [I.grid(120, 140, 300), I.foot(0, 0, 170, 290), I.slab(0, 0, 0, 170, 290, 12, shade=7), I.path([(12, 14, 12), (158, 14, 12), (158, 276, 12), (12, 276, 12)], cls='ft nf'), I.path([(66, 264, 12), (104, 264, 12)], False, 'nf')]
    o += [I.ring(85, 30, 12.2, 4, 'sk nf'), I.path([(170, 70, 6), (170, 118, 6)], False, 'bv nf'), I.path([(170, 132, 6), (170, 150, 6)], False, 'bv nf'), I.ticks(0, 290, 12, 170, 17, 4)]
    def bubble(x, y, z, w, d, cls, n, rows, red, name, sub, extra=''):
        return lit(n, extra + I.note(x, y, z, w, d, 7, cls, rows, red) + I.callout(x + w, y, z + 7, name, sub=sub))
    o += [bubble(22, 176, 70, 118, 78, '', 0, 3, False, 'Lead, 12:40 AM', 'Web form', I.risers(22, 176, 12, 70, 118, 78)),
          bubble(34, 84, 140, 124, 78, 'hi', 1, 3, True, 'Reply, 6 s later', 'By text, in your name', I.link([(150, 176, 77), (150, 176, 147), (150, 163, 147)])),
          bubble(22, 24, 206, 84, 50, '', 2, 1, False, 'Picks a time', 'Friday, 8:00 AM', I.link([(96, 80, 147), (96, 80, 213), (96, 75, 213)]))]
    o.append(lit(3, I.ring(85, 226, 12.5, 30, "hi nf") + I.check(71, 208, 12.5, 28) + I.callout(55, 256, 12.5, 'Booked', -1, sub='On your calendar')))
    cx, cy = I.p(262, 96, 0); R = DIAL_R; rx, ry = R * 1.414, R * .707
    o.append(I.ring(262, 96, 0, R + 9, 'ft nf') + I.ring(262, 96, 0, R, 'tp hi') + I.dial(262, 96, .5, R * .82, R * .94) + I.ring(262, 96, 0, R * .58, 'bv nf') + I.callout(262 + R * .7, 96 - R * .7, 0, '6 seconds', 1, 20, 26, sub='From form to reply'))
    o.append('<path class="nf" d="M%.1f,%.1f V%.1f"/>' % (cx, cy, cy - ry * .7))
    o.append(lit(1, '<path class="rd nf" d="M%.1f,%.1f L%.1f,%.1f"/><path class="rd nf" d="M%.1f,%.1f A%.1f,%.1f 0 0 1 %.1f,%.1f"/>' % (cx, cy, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15), cx, cy - ry, rx, ry, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15)), 'fade'))
    return svg(''.join(o), 'A phone drawn in thin lines, lying flat. A message lifts off the screen, the reply sits just above it, and a small dial beside it shows only a few seconds gone.')

DIAL_R = 62
def reply_dial():
    """the dial beside the phone, in the drawing's own coordinates: centre x, centre y, radius across, radius down. The portal opens out of it."""
    I = Iso(300, 200, 1.0); c = I.p(262, 96, 0); del BB[:]
    return '%s %s %s %s' % (c[0], c[1], round(DIAL_R * 1.414, 1), round(DIAL_R * .707, 1))

def quote():
    """One quote. Two check-ins set down beside it along a line of days, then the signature."""
    I = Iso(250, 120, 1.0); o = [I.grid(190, 110, 300), I.foot(0, 0, 170, 236)]
    o.append(lit(0, I.slab(0, 0, 0, 170, 236, 4) + I.bevel(0, 0, 4, 170, 236, 9) + I.sheet(0, 0, 4, 170, 236, 3) + I.path([(22, 204, 4), (148, 204, 4)], False, 'sk') + I.callout(170, 0, 4, 'Quote, sent Monday', sub='Day 0')))
    # the days, as a rail on the ground: the check-ins sit on their days
    o.append(I.path([(188, 172, 0), (410, 172, 0)], False, 'dm nf') + ''.join(I.path([(v, 166, 0), (v, 184 if v in (250, 354) else 178, 0)], False, 'dm nf') for v in range(198, 410, 26)))
    for n, x, day, sub in ((1, 214, 'Day 2', 'First check-in'), (2, 318, 'Day 5', 'Second check-in')):
        o.append(lit(n, I.link([(x - 34, 118, 0), (x - 6, 118, 0)]) + I.path([(x + 36, 150, 0), (x + 36, 172, 0)], False, 'rs ds nf') + I.note(x, 86, 0, 72, 64, 5, '', 2) + I.callout(x + 72, 86, 5, day, sub=sub)))
    o.append(lit(3, I.path([(24 + v * 11, 186 + (9 if v % 2 else -9) * (1 - v / 14), 4) for v in range(11)], False, 'rd nf') + I.ring(360, 190, 0, 26, 'hi nf') + I.ring(360, 190, 0, 33, 'fo nf') + I.check(346, 172, 0, 26) + I.callout(0, 236, 4, 'Signed', -1, sub='Follow-up stops'), 'fade'))
    return svg(''.join(o), 'A quote drawn as a sheet of paper in thin lines. Two small check-in notes are set down beside it, and then a red signature appears on the quote.')

def invoice():
    """One invoice. A reminder lifts off it. Then it is stamped and the coins stack up."""
    I = Iso(250, 150, 1.0); o = [I.grid(150, 70, 300), I.foot(0, 0, 160, 220)]
    o.append(lit(0, I.slab(0, 0, 0, 160, 220, 4) + I.bevel(0, 0, 4, 160, 220, 9) + I.sheet(0, 0, 4, 160, 220, 3) + I.callout(0, 220, 4, 'Invoice #1042', -1, sub='Sent the day the job ends')))
    o.append(lit(1, I.risers(34, 44, 4, 64, 92, 58) + I.note(34, 44, 64, 92, 58, 5) + I.callout(126, 44, 69, 'Reminder, day 3', sub='By text')))
    stamp = I.ring(112, 178, 4.5, 26, 'rd nf pulse') + I.ring(112, 178, 4.5, 19, 'rd nf') + I.check(102, 166, 4.5, 16, 'rd nf')
    coins = ''.join(I.ring(250 + j * 14, 96 - j * 64, 0, 31, 'fo nf') + ''.join(I.coin(250 + j * 14, 96 - j * 64, k * 9, 24, 9, 'hi' if k == n - 1 else '') for k in range(n)) for j, n in enumerate((3, 5, 7)))
    o.append(lit(2, I.link([(168, 110, 0), (214, 110, 0)]) + stamp + coins + I.callout(302, -32, 63, 'Paid', sub='Day 4')))
    return svg(''.join(o), 'An invoice drawn in thin lines. A reminder note lifts off it, then it carries a red paid stamp and three stacks of coins stand beside it.')

def review():
    """Five tiles, a star on each. The ask goes out, the stars come in, the thanks goes back."""
    I = Iso(214, 190, .96); o = [I.grid(210, 35, 320), I.foot(0, 0, 422, 70, 12)]
    for i in range(5):
        x = i * 88; o.append(I.slab(x, 0, 0, 70, 70, 10, shade=6) + I.bevel(x, 0, 10, 70, 70, 6) + I.ticks(x, 70, 10, 70, 7, 3) + lit(1, I.star(x + 35, 35, 10.5, 27, 'hi nf'), 'fade d%d' % i))
    def note(x, y, z, n, red, name, side, sub, extra):
        return lit(n, extra + I.note(x, y, z, 90, 56, 5, 'hi' if red else '', 2, red) + (I.callout(x + 90, y, z + 5, name, sub=sub) if side > 0 else I.callout(x, y + 56, z + 5, name, -1, sub=sub)))
    o += [note(-10, 8, 96, 0, False, 'The ask', -1, 'The day after the job', I.link([(35, 35, 92), (35, 35, 44)])), lit(1, I.callout(246, 0, 10, 'The review', sub='On your Google profile'), 'fade'),
          note(338, 8, 96, 2, True, 'The reply', 1, 'Same day, in your name', I.link([(387, 35, 44), (387, 35, 92)]))]
    return svg(''.join(o), 'Five small tiles in a row, each with a star drawn on it. A note goes out on one side to ask for the review and another goes back on the other side to answer it.')

def blocks():
    """A plot marked out in uneven pieces, the way a business already runs. Each block is cut to fit its piece. One piece is still open."""
    I = Iso(300, 150, 1.0); o = [I.grid(150, 103, 330), I.foot(0, 0, 300, 206, 14)]
    P = [(0, 0, 120, 84, 46), (132, 0, 78, 84, 92), (0, 96, 84, 110, 30), (96, 96, 114, 110, 64)]   # x, y, w, d, height
    for x, y, w, d, h in P: o.append(I.path([(x, y, 0), (x + w, y, 0), (x + w, y + d, 0), (x, y + d, 0)], cls='ds nf'))
    ex, ey, ew, ed = 222, 0, 78, 206
    o.append(I.path([(ex, ey, 0), (ex + ew, ey, 0), (ex + ew, ey + ed, 0), (ex, ey + ed, 0)], cls='rd ds nf flow') + I.path([(ex + 26, ey + ed / 2, 0), (ex + 52, ey + ed / 2, 0)], False, 'rd nf') + I.path([(ex + 39, ey + ed / 2 - 13, 0), (ex + 39, ey + ed / 2 + 13, 0)], False, 'rd nf') + I.callout(ex + ew, ey, 0, 'Yours next', 1, 18, 26, 'rdx', sub='Room left for it'))
    # the front edge, measured: what is built and what is open
    o.append(I.path([(0, 232, 0), (210, 232, 0)], False, 'dm nf') + I.path([(222, 232, 0), (300, 232, 0)], False, 'dm nf') + ''.join(I.path([(v, 226, 0), (v, 238, 0)], False, 'dm nf') for v in (0, 210, 222, 300)))
    SUB = ['The first call', 'The estimate', 'The follow-up', 'The invoice']
    for i in (0, 1, 2, 3):   # back to front, so nearer blocks cover farther ones
        x, y, w, d, h = P[i]; top = I.ring(x + w / 2, y + d / 2, h, min(w, d) * .24, 'nf') + I.ring(x + w / 2, y + d / 2, h, min(w, d) * .1, 'bv nf') if i % 2 else I.plus(x + w / 2, y + d / 2, h, 9)
        tag = I.callout(x, y + d, h, 'Step %d' % (i + 1), -1, sub=SUB[i]) if i in (0, 2) else I.callout(x + w, y, h, 'Step %d' % (i + 1), sub=SUB[i])
        o.append(lit(i, I.slab(x, y, 0, w, d, h, 'hi' if i == 3 else '', shade=7) + I.bevel(x, y, h, w, d, 8) + I.ticks(x, y + d, h, w, max(4, int(w // 12)), 4) + top + tag))
    return svg(''.join(o), 'A plot of ground marked out in uneven pieces with dashed lines. Four blocks, each a different size, are set down to fit their pieces exactly. A fifth piece is still open, marked in red.')

def tower():
    """What got done today, stacking up. The one thing that still needs you sits apart."""
    I = Iso(280, 322, 1.0); o = [I.grid(120, 85, 330), I.foot(0, 0, 170, 170, 13)]
    DONE = [('Answered', '12:40 AM'), ('Booked', '8:02 AM'), ('Followed up', '10:15 AM'), ('Reminded', '1:30 PM'), ('Asked for a review', '4:45 PM')]
    # the height of the day's work, measured up the back corner
    o.append(I.path([(196, 0, 0), (196, 0, 202)], False, 'dm nf') + ''.join(I.path([(190, 0, k * 44), (202, 0, k * 44)], False, 'dm nf') for k in range(5)) + I.path([(190, 0, 202), (202, 0, 202)], False, 'dm nf'))
    for i in range(5):
        z = i * 44; o.append(lit(i, I.slab(0, 0, z, 170, 170, 26, shade=7) + I.bevel(0, 0, z + 26, 170, 170, 10) + I.ticks(0, 170, z + 26, 170, 17, 4) + I.check(64, 60, z + 26.5, 34, 'nf') + I.callout(0, 170, z + 13, DONE[i][0], -1, 0, 40, sub=DONE[i][1])))
    o.append(I.foot(226, 60, 78, 78, 9) + I.slab(226, 60, 0, 78, 78, 18, 'hi', shade=7) + I.bevel(226, 60, 18, 78, 78, 7) + I.callout(304, 60, 18, 'Needs you', 1, 18, 26, 'rdx', sub='One call back') + I.ring(265, 99, 18.5, 15, 'rd nf pulse') + '<circle class="rdt" cx="%s" cy="%s" r="3.5"/>' % I.p(265, 99, 18.5))
    return svg(''.join(o), 'Five slabs stacked one on another, drawn in thin lines, each marked with a tick: the work already done. One small bright tile sits apart from the pile, marked in red: the thing that needs you.')

def icons():
    """Eight small drawings for the eight parts of a business, same hand as the large ones."""
    out = []
    def ic(body): out.append(svg(body, '', pad=4, icon=True))
    I = Iso(0, 0, 1.0)
    ic(I.slab(0, 0, 0, 40, 68, 4, shade=6) + I.slab(4, 12, 28, 36, 24, 3, 'hi') + I.lines(4, 12, 31, 36, 24, 2, 'sk', 6, short=(1,)))
    ic(I.slab(0, 0, 0, 72, 60, 4) + ''.join(I.path([(0, v, 4), (72, v, 4)], False, 'sk') for v in (20, 40)) + ''.join(I.path([(v, 0, 4), (v, 60, 4)], False, 'sk') for v in (24, 48)) + I.path([(48, 20, 4), (72, 20, 4), (72, 40, 4), (48, 40, 4)], cls='hi nf'))
    ic(I.slab(0, 0, 0, 52, 72, 2) + I.lines(0, 0, 2, 52, 46, 3, 'sk', 8, short=(2,)) + I.path([(8 + v * 5, 56 + (4 if v % 2 else -4), 2) for v in range(8)], False, 'hi nf'))
    ic(''.join(''.join(I.coin(j * 30, -j * 30, k * 5, 13, 5, 'hi' if k == n - 1 else '') for k in range(n)) for j, n in enumerate((2, 4, 6))))
    ic(I.slab(0, 0, 0, 58, 58, 7, shade=6) + I.star(29, 29, 7.5, 21, 'hi nf'))
    top = I.p(0, 0, 50); ic(I.ring(0, 0, 0, 30, 'ft nf') + I.ring(0, 0, 0, 16, 'nf') + I.path([(0, 0, 0), (0, 0, 50)], False, 'nf') + '<circle class="hi" cx="%s" cy="%s" r="7"/>' % top + (BB.append((top[0] - 8, top[1] - 8)) or ''))
    ic(''.join(I.slab(j * 34, 0, 0, 26, 26, h, 'hi' if j == 1 else '', shade=6) for j, h in enumerate((20, 40, 28))))
    ic(I.path([(44, 0, 0), (78, 0, 0), (78, 34, 0), (44, 34, 0)], cls='ft ds nf') + ''.join(I.path([(a, b, 0), (a, b, 34)], False, 'ft ds') for a, b in ((44, 34), (78, 34), (78, 0))) + I.path([(44, 0, 34), (78, 0, 34), (78, 34, 34), (44, 34, 34)], cls='ft ds nf') + I.slab(0, 0, 0, 34, 34, 34, 'hi', shade=6))
    return out
