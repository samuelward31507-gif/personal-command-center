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
        """shade: gap in units between hatch lines on the right-hand face, 0 for none"""
        if shade: return s.slab(x, y, z, w, d, h, cls) + ''.join(s.path([(x + w, y + t, z + h), (x + w, y + t, z)], False, 'ht') for t in [shade * i for i in range(1, int(d // shade))])
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
    def note(s, x, y, z, w, d, h, cls='', rows=2, red=False):
        """a message: a thin slab with a small tail at its front edge and lines of writing on it"""
        tail = s.path([(x + 12, y + d, z + h), (x + 12, y + d + 15, z + h), (x + 30, y + d, z + h)], True, cls)
        return tail + s.slab(x, y, z, w, d, h, cls) + s.lines(x, y, z + h, w, d, rows, 'rd nf' if red else 'sk', 13, short=(rows - 1,))
    def check(s, x, y, z, r, cls='hi nf'):
        return s.path([(x - r * .1, y + r * .55, z), (x + r * .45, y + r * .95, z), (x + r, y - r * .35, z)], False, cls)
    def star(s, x, y, z, r, cls=''):
        pts = [(x + (r if i % 2 == 0 else r * .42) * math.cos(-math.pi / 4 + i * math.pi / 5), y + (r if i % 2 == 0 else r * .42) * math.sin(-math.pi / 4 + i * math.pi / 5), z) for i in range(10)]
        return s.path(pts, True, cls)

def svg(body, label, vb=None, pad=26, icon=False):
    if vb is None:
        xs = [a for a, _ in BB]; ys = [b for _, b in BB]; vb = '%d %d %d %d' % (min(xs) - pad, min(ys) - pad - 22, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad + 22)
    del BB[:]
    if icon: return '<svg class="il" viewBox="%s" aria-hidden="true">%s</svg>' % (vb, body)
    return '<svg class="lnv il" viewBox="%s" role="img" aria-label="%s">%s</svg>' % (vb, label, body)
def lit(n, body, cls=''): return '<g data-lit="%d"%s>%s</g>' % (n, ' class="%s"' % cls if cls else '', body)

def funnel():
    """Jobs go in at the top. Fewer come out. Three leave through the side. Six rings, one for each point the audit follows."""
    cx, R = 320, [(60, 214), (128, 178), (196, 142), (264, 106), (332, 74), (400, 46)]; o = []
    for i, (y, rx) in enumerate(R):
        ry = round(rx * .24, 1)
        o.append('<path class="ft nf" d="M%s,%s A%s,%s 0 0 1 %s,%s"/>' % (cx - rx, y, rx, ry, cx + rx, y))
        o.append('<path class="nf" data-is="%d" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (i, cx - rx, y, rx, ry, cx + rx, y))
    for (y1, r1), (y2, r2) in zip(R, R[1:]):
        o.append('<path class="nf" d="M%s,%s L%s,%s M%s,%s L%s,%s"/>' % (cx - r1, y1, cx - r2, y2, cx + r1, y1, cx + r2, y2))
    y, rx = R[-1]; o.append('<path class="nf" d="M%s,%s V%s M%s,%s V%s"/><path class="nf" d="M%s,%s A%s,%s 0 0 0 %s,%s"/>' % (cx - rx, y, y + 50, cx + rx, y, y + 50, cx - rx, y + 50, rx, 11, cx + rx, y + 50))
    seed = 7
    def rnd():
        nonlocal seed; seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648
    k = 0
    for band, n in enumerate([11, 9, 6, 5, 3]):
        (y1, r1), (y2, r2) = R[band], R[band + 1]
        for _ in range(n):
            u = .16 + rnd() * .6; w = (r1 + (r2 - r1) * u) * .7; k += 1
            o.append('<circle class="dt drip" style="animation-delay:-%.2fs" cx="%.1f" cy="%.1f" r="3"/>' % (rnd() * 3.6, cx + (rnd() * 2 - 1) * w, y1 + (y2 - y1) * u))
    o.append('<circle class="dt drip" style="animation-delay:-.4s" cx="%s" cy="470" r="3"/><circle class="dt drip" style="animation-delay:-2.1s" cx="%s" cy="492" r="3"/>' % (cx - 8, cx + 10))
    for n, side in ((1, -1), (3, 1), (5, -1)):
        y, rx = R[n]; x = cx + side * rx
        o.append(lit(n, '<path class="rd ds flow" d="M%.1f,%.1f q%s,4 %s,92"/><circle class="rdt" cx="%.1f" cy="%.1f" r="4"/><circle class="rdt" cx="%.1f" cy="%.1f" r="2.6"/><circle class="rd nf" cx="%.1f" cy="%.1f" r="8"/>' % (x, y, side * 56, side * 68, x + side * 68, y + 92, x + side * 50, y + 48, x, y), 'fade'))
    return svg(''.join(o), 'A funnel drawn in thin lines. Many dots go in at the top and only a few come out at the bottom. Three red lines leave through its side, where jobs leak away.', '62 14 516 508')

def reply():
    """A phone lying flat. A message rises off it, and the answer is already above it."""
    I = Iso(300, 200, 1.0); o = [I.slab(0, 0, 0, 170, 290, 12, shade=7), I.path([(12, 14, 12), (158, 14, 12), (158, 276, 12), (12, 276, 12)], cls='ft nf'), I.path([(66, 264, 12), (104, 264, 12)], False, 'nf')]
    def bubble(x, y, z, w, d, cls, n, rows=2, red=False):
        g = ''.join(I.path([(a, b, z), (a, b, 12)], False, 'ft ds') for a, b in ((x, y + d), (x + w, y)))
        g += I.note(x, y, z, w, d, 7, cls, rows, red)
        return lit(n, g)
    o += [bubble(22, 176, 70, 118, 78, '', 0, 3), bubble(34, 84, 140, 124, 78, 'hi', 1, 3, True), bubble(22, 24, 206, 84, 50, '', 2, 1)]
    o.append(lit(3, I.ring(85, 226, 12.5, 30, "hi nf") + I.check(71, 208, 12.5, 28)))
    cx, cy = I.p(262, 96, 0); R = 54; rx, ry = R * 1.414, R * .707
    o.append(I.ring(262, 96, 0, R, 'nf') + ''.join('<path class="nf" d="M%.1f,%.1f L%.1f,%.1f"/>' % (cx + rx * .84 * math.cos(a), cy + ry * .84 * math.sin(a), cx + rx * math.cos(a), cy + ry * math.sin(a)) for a in [i * math.pi / 6 for i in range(12)]))
    o.append('<path class="nf" d="M%.1f,%.1f V%.1f"/>' % (cx, cy, cy - ry * .7))
    o.append(lit(1, '<path class="rd nf" d="M%.1f,%.1f L%.1f,%.1f"/><path class="rd nf" d="M%.1f,%.1f A%.1f,%.1f 0 0 1 %.1f,%.1f"/>' % (cx, cy, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15), cx, cy - ry, rx, ry, cx + rx * math.cos(-1.15), cy + ry * math.sin(-1.15)), 'fade'))
    return svg(''.join(o), 'A phone drawn in thin lines, lying flat. A message lifts off the screen, the reply sits just above it, and a small dial beside it shows only a few seconds gone.')

def quote():
    """One quote. Two check-ins set down beside it, then the signature."""
    I = Iso(250, 120, 1.0); o = [lit(0, I.slab(0, 0, 0, 170, 236, 4) + I.lines(0, 0, 4, 170, 150, 5, 'sk', 18, short=(0, 4)) + I.path([(18, 204, 4), (152, 204, 4)], False, 'sk'))]
    for n, x in ((1, 214), (2, 318)):
        o.append(lit(n, I.path([(x - 36, 118, 0), (x - 8, 118, 0)], False, 'ds nf') + I.slab(x, 86, 0, 72, 64, 4) + I.lines(x, 86, 4, 72, 64, 2, 'sk', 14, short=(1,))))
    o.append(lit(3, I.path([(24 + v * 11, 186 + (9 if v % 2 else -9) * (1 - v / 14), 4) for v in range(11)], False, 'rd nf') + I.ring(360, 190, 0, 26, 'hi nf') + I.check(346, 172, 0, 26), 'fade'))
    return svg(''.join(o), 'A quote drawn as a sheet of paper in thin lines. Two small check-in notes are set down beside it, and then a red signature appears on the quote.')

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
        x = i * 88; o.append(I.slab(x, 0, 0, 70, 70, 10, shade=6) + lit(1, I.star(x + 35, 35, 10.5, 27, 'hi nf'), 'fade d%d' % i))
    def note(x, y, z, n, red=False):
        return lit(n, I.path([(x + 45, y + 28, z), (x + 45, y + 28, 10)], False, 'ft ds') + I.note(x, y, z, 90, 56, 5, 'hi' if red else '', 2, red))
    o += [note(-10, 8, 96, 0), note(338, 8, 96, 2, True)]
    return svg(''.join(o), 'Five small tiles in a row, each with a star drawn on it. A note goes out on one side to ask for the review and another goes back on the other side to answer it.')

def blocks():
    """A plot marked out in uneven pieces, the way a business already runs. Each block is cut to fit its piece. One piece is still open."""
    I = Iso(300, 150, 1.0); o = []
    P = [(0, 0, 120, 84, 46), (132, 0, 78, 84, 92), (0, 96, 84, 110, 30), (96, 96, 114, 110, 64)]   # x, y, w, d, height
    o.append(I.path([(-22, -22, 0), (322, -22, 0), (322, 228, 0), (-22, 228, 0)], cls='ft ds nf'))
    for x, y, w, d, h in P: o.append(I.path([(x, y, 0), (x + w, y, 0), (x + w, y + d, 0), (x, y + d, 0)], cls='ds nf'))
    ex, ey, ew, ed = 222, 0, 78, 206
    o.append(I.path([(ex, ey, 0), (ex + ew, ey, 0), (ex + ew, ey + ed, 0), (ex, ey + ed, 0)], cls='rd ds nf') + I.path([(ex + 26, ey + ed / 2, 0), (ex + 52, ey + ed / 2, 0)], False, 'rd nf') + I.path([(ex + 39, ey + ed / 2 - 13, 0), (ex + 39, ey + ed / 2 + 13, 0)], False, 'rd nf'))
    for i in (1, 0, 3, 2):   # back to front, so nearer blocks cover farther ones
        x, y, w, d, h = P[i]; top = I.hatch(x, y, h, w, d, 11) if i % 2 == 0 else I.ring(x + w / 2, y + d / 2, h, min(w, d) * .26, 'nf')
        o.append(lit(i, I.slab(x, y, 0, w, d, h, 'hi' if i == 3 else '', shade=7) + top))
    return svg(''.join(o), 'A plot of ground marked out in uneven pieces with dashed lines. Four blocks, each a different size, are set down to fit their pieces exactly. A fifth piece is still open, marked in red.')

def tower():
    """What got done today, stacking up. The one thing that still needs you sits apart."""
    I = Iso(280, 322, 1.0); o = [I.path([(-40, -40, 0), (330, -40, 0), (330, 210, 0), (-40, 210, 0)], cls='ft ds nf')]
    for i in range(5):
        z = i * 44; o.append(lit(i, I.slab(0, 0, z, 170, 170, 26, shade=7) + I.check(64, 60, z + 26.5, 34, 'nf')))
    o.append(I.slab(226, 60, 0, 78, 78, 18, 'hi', shade=7) + I.ring(265, 99, 18.5, 15, 'rd nf') + '<circle class="rdt" cx="%s" cy="%s" r="3.5"/>' % I.p(265, 99, 18.5))
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
