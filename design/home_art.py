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
    def slab(s, x, y, z, w, d, h, cls=''):
        side = s.path([(x, y + d, z + h), (x + w, y + d, z + h), (x + w, y, z + h), (x + w, y, z), (x + w, y + d, z), (x, y + d, z)], cls=cls)
        top = s.path([(x, y, z + h), (x + w, y, z + h), (x + w, y + d, z + h), (x, y + d, z + h)], cls=cls)
        return side + top + s.path([(x + w, y + d, z + h), (x + w, y + d, z)], False, cls)
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
        return '<path%s d="M%s,%s V%s A%s,%s 0 0 0 %s,%s V%s Z"/><ellipse%s cx="%s" cy="%s" rx="%s" ry="%s"/>' % (c, cx - rx, top, bot, rx, ry, cx + rx, bot, top, c, cx, top, rx, ry)
    def check(s, x, y, z, r, cls='hi nf'):
        return s.path([(x - r * .1, y + r * .55, z), (x + r * .45, y + r * .95, z), (x + r, y - r * .35, z)], False, cls)
    def star(s, x, y, z, r, cls=''):
        pts = [(x + (r if i % 2 == 0 else r * .42) * math.cos(-math.pi / 4 + i * math.pi / 5), y + (r if i % 2 == 0 else r * .42) * math.sin(-math.pi / 4 + i * math.pi / 5), z) for i in range(10)]
        return s.path(pts, True, cls)

def svg(body, label, vb=None, pad=26):
    if vb is None:
        xs = [a for a, _ in BB]; ys = [b for _, b in BB]; vb = '%d %d %d %d' % (min(xs) - pad, min(ys) - pad - 22, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad + 22)
    del BB[:]
    return '<svg class="lnv il" viewBox="%s" role="img" aria-label="%s">%s</svg>' % (vb, label, body)
def lit(n, body, cls=''): return '<g data-lit="%d"%s>%s</g>' % (n, ' class="%s"' % cls if cls else '', body)

def funnel():
    """Jobs go in at the top. Fewer come out. Three leave through the side."""
    cx, R = 320, [(64, 214), (150, 170), (236, 124), (322, 80), (402, 46)]; o = []
    for i, (y, rx) in enumerate(R):
        ry = round(rx * .24, 1)
        o.append('<path class="ft nf" d="M%s,%s A%s,%s 0 0 1 %s,%s"/>' % (cx - rx, y, rx, ry, cx + rx, y))
        o.append('<path class="%s nf" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % ('hi' if i == 0 else '', cx - rx, y, rx, ry, cx + rx, y))
    for (y1, r1), (y2, r2) in zip(R, R[1:]):
        o.append('<path class="nf" d="M%s,%s L%s,%s M%s,%s L%s,%s"/>' % (cx - r1, y1, cx - r2, y2, cx + r1, y1, cx + r2, y2))
    y, rx = R[-1]; o.append('<path class="nf" d="M%s,%s V%s M%s,%s V%s"/><path class="nf" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (cx - rx, y, y + 52, cx + rx, y, y + 52, cx - rx, y + 52, rx, 11, cx + rx, y + 52))
    seed = 7
    def rnd():
        nonlocal seed; seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648
    for band, n in enumerate([11, 8, 5, 3]):
        (y1, r1), (y2, r2) = R[band], R[band + 1]
        for _ in range(n):
            t = .2 + rnd() * .6; w = (r1 + (r2 - r1) * t) * .72; o.append('<circle class="dt" cx="%.1f" cy="%.1f" r="3.2"/>' % (cx + (rnd() * 2 - 1) * w, y1 + (y2 - y1) * t))
    o.append('<circle class="dt" cx="%s" cy="476" r="3.2"/><circle class="dt" cx="%s" cy="500" r="3.2"/>' % (cx - 8, cx + 10))
    for n, (band, side) in zip((1, 3, 5), ((1, -1), (2, 1), (3, -1))):
        (y1, r1), (y2, r2) = R[band], R[band + 1]; x = cx + side * (r1 + r2) / 2; y = (y1 + y2) / 2
        o.append(lit(n, '<path class="rd ds" d="M%.1f,%.1f q%s,6 %s,96"/><circle class="rdt" cx="%.1f" cy="%.1f" r="4"/><circle class="rdt" cx="%.1f" cy="%.1f" r="3"/><circle class="rd nf" cx="%.1f" cy="%.1f" r="9"/>' % (x, y, side * 58, side * 70, x + side * 70, y + 96, x + side * 52, y + 52, x, y), 'fade'))
    return svg(''.join(o), 'A funnel drawn in thin lines. Many dots go in at the top and only a few come out at the bottom. Three red lines leave through its side, where jobs leak away.', '70 20 500 500')

def reply():
    """A phone lying flat. A message rises off it, and the answer is already above it."""
    I = Iso(300, 200, 1.0); o = [I.slab(0, 0, 0, 170, 290, 12), I.path([(12, 14, 12), (158, 14, 12), (158, 276, 12), (12, 276, 12)], cls='ft nf'), I.path([(66, 264, 12), (104, 264, 12)], False, 'nf')]
    def bubble(x, y, z, w, d, cls, n, rows=2, red=False):
        g = ''.join(I.path([(a, b, z), (a, b, 12)], False, 'ft ds') for a, b in ((x, y + d), (x + w, y)))
        g += I.slab(x, y, z, w, d, 7, cls) + I.lines(x, y, z + 7, w, d, rows, 'rd nf' if red else 'sk', 14, short=(rows - 1,))
        return lit(n, g)
    o += [bubble(22, 176, 70, 118, 78, '', 0, 3), bubble(34, 84, 140, 124, 78, 'hi', 1, 3, True), bubble(22, 24, 206, 84, 50, '', 2, 1)]
    o.append(lit(3, I.ring(85, 226, 12.5, 30, "hi nf") + I.check(71, 208, 12.5, 28)))
    cx, cy = I.p(262, 96, 0); R = 54; rx, ry = R * 1.414, R * .707
    o.append(I.ring(262, 96, 0, R, 'nf') + ''.join('<path class="nf" d="M%.1f,%.1f L%.1f,%.1f"/>' % (cx + rx * .84 * math.cos(a), cy + ry * .84 * math.sin(a), cx + rx * math.cos(a), cy + ry * math.sin(a)) for a in [i * math.pi / 6 for i in range(12)]))
    o.append('<path class="nf" d="M%.1f,%.1f V%.1f"/>' % (cx, cy, cy - ry * .7))
    o.append(lit(1, '<path class="rd nf" d="M%.1f,%.1f L%.1f,%.1f"/><path class="rd nf" d="M%.1f,%.1f A%.1f,%.1f 0 0 1 %.1f,%.1f"/>' % (cx, cy, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15), cx, cy - ry, rx, ry, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15)), 'fade'))
    return svg(''.join(o), 'A phone drawn in thin lines, lying flat. A message lifts off the screen, the reply sits just above it, and a small dial beside it shows only a few seconds gone.')

def quote():
    """Four sheets in a row: sent, checked in, checked in, signed."""
    I = Iso(196, 128, .92); o = []
    for i in range(4):
        x = i * 132; g = I.slab(x, 0, 0, 104, 150, 4, 'hi' if i == 3 else '') + I.lines(x, 0, 4, 104, 150 - (46 if i == 3 else 0), 4 if i == 3 else 5, 'sk', 14, short=(1, 4))
        if i == 3: g += I.path([(x + 16 + t * 9, 118 + (7 if t % 2 else -7) * (1 - t / 12), 4) for t in range(9)], False, 'rd nf') + I.path([(x + 14, 132, 4), (x + 92, 132, 4)], False, 'sk')
        if i: g = I.path([(x - 24, 75, 0), (x - 4, 75, 0)], False, 'ds nf') + g
        o.append(lit(i, g))
    return svg(''.join(o), 'Four sheets of paper in a row, drawn in thin lines. The quote is sent, followed up twice, and the last sheet carries a signature.')

def invoice():
    """One invoice. A reminder lifts off it. Then it is stamped and the coins stack up."""
    I = Iso(250, 150, 1.0); o = [lit(0, I.slab(0, 0, 0, 160, 220, 4) + I.lines(0, 0, 4, 160, 150, 5, 'sk', 16, short=(0, 3)) + I.path([(16, 182, 4), (144, 182, 4)], False, 'hi nf'))]
    o.append(lit(1, ''.join(I.path([(a, b, 70), (a, b, 4)], False, 'ft ds') for a, b in ((30, 96), (118, 40))) + I.slab(30, 40, 70, 88, 56, 5) + I.lines(30, 40, 75, 88, 56, 2, 'sk', 12, short=(1,))))
    stamp = I.ring(112, 170, 4.5, 26, 'rd nf') + I.ring(112, 170, 4.5, 19, 'rd nf') + I.check(102, 158, 4.5, 16, 'rd nf')
    coins = ''.join(''.join(I.coin(250 + j * 14, 96 - j * 64, k * 9, 24, 9, 'hi' if k == n - 1 else '') for k in range(n)) for j, n in enumerate((3, 5, 7)))
    o.append(lit(2, stamp + coins))
    return svg(''.join(o), 'An invoice drawn in thin lines. A reminder note lifts off it, then it carries a red paid stamp and three stacks of coins stand beside it.')

def review():
    """Five tiles, a star on each. The ask goes out, the stars come in, the thanks goes back."""
    I = Iso(214, 190, .96); o = []
    for i in range(5):
        x = i * 88; o.append(I.slab(x, 0, 0, 70, 70, 10) + lit(1, I.star(x + 35, 35, 10.5, 27, 'hi nf'), 'fade d%d' % i))
    def note(x, y, z, n, red=False):
        return lit(n, I.path([(x + 45, y + 28, z), (x + 45, y + 28, 10)], False, 'ft ds') + I.slab(x, y, z, 90, 56, 5, 'hi' if red else '') + I.lines(x, y, z + 5, 90, 56, 2, 'rd nf' if red else 'sk', 12, short=(1,)))
    o += [note(-10, 8, 96, 0), note(338, 8, 96, 2, True)]
    return svg(''.join(o), 'Five small tiles in a row, each with a star drawn on it. A note goes out on one side to ask for the review and another goes back on the other side to answer it.')

def blocks():
    """Four blocks set down one at a time. A fifth place is marked out, empty."""
    I = Iso(176, 196, 1.0); o = []; S, G = 78, 22
    x5 = 4 * (S + G); o.append(I.path([(x5, 0, 0), (x5 + S, 0, 0), (x5 + S, S, 0), (x5, S, 0)], cls='rd ds nf') + ''.join(I.path([(a, b, 0), (a, b, S)], False, 'ft ds') for a, b in ((x5, S), (x5 + S, S), (x5 + S, 0))) + I.path([(x5, 0, S), (x5 + S, 0, S), (x5 + S, S, S), (x5, S, S)], cls='ft ds nf'))
    for i in range(4):
        x = i * (S + G); g = I.slab(x, 0, 0, S, S, S, 'hi' if i == 3 else '') + (I.hatch(x, 0, S, S, S, 10) if i % 2 == 0 else I.ring(x + S / 2, S / 2, S, 20, 'nf'))
        if i: g = I.path([(x - G, S / 2, S / 2), (x, S / 2, S / 2)], False, 'nf') + g
        o.append(lit(i, g))
    return svg(''.join(o), 'Four blocks in a row, drawn in thin lines and joined one to the next. A fifth place is marked out with a dashed outline, still empty.')

def tower():
    """What got done today, stacking up."""
    I = Iso(320, 322, 1.0); o = [I.path([(-40, -40, 0), (210, -40, 0), (210, 210, 0), (-40, 210, 0)], cls='ft ds nf')]
    for i in range(5):
        z = i * 44; o.append(lit(i, I.slab(0, 0, z, 170, 170, 26, 'hi' if i == 4 else '') + I.ring(85, 85, z + 26.5, 30, 'nf' if i < 4 else 'rd nf') + I.check(68, 64, z + 26.5, 30, 'hi nf')))
    return svg(''.join(o), 'Five slabs stacked one on another, drawn in thin lines, each marked with a tick. The pile grows as the day&#8217;s work gets done.')
