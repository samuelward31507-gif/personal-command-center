// The call slab: a graphite base where each step of a lead drops in as a bar.
// window.CinderSlab.mount(el); window.CinderSlab.setStep(n) shows bars 0..n (n = -1 shows none).
const BARS = [
  { label: 'MISSED CALL', text: '(303) 555-0148', time: '7:42 PM', hot: true },
  { label: 'REPLIED IN 10S', text: 'Text sent to Dana Ruiz', time: '7:42 PM' },
  { label: 'ESTIMATE BOOKED', text: 'Thu 9:00 AM · 41 Aspen Ct', time: '7:51 PM' },
  { label: 'REMINDER QUEUED', text: 'Text the night before', time: 'WED 6:00 PM' },
];
let step = 0, instance = null;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

async function mount(el) {
  instance?.destroy();
  const [T, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  try { await Promise.all([document.fonts.load('600 64px Inter'), document.fonts.load('500 30px "Geist Mono"')]); } catch {}

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  const opts = { alpha: true, antialias: true, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
  if (!gl) { document.documentElement.classList.add('slab-failed'); return; }
  el.append(canvas);
  const renderer = new T.WebGLRenderer({ ...opts, canvas, context: gl });
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  scene.environment = pmrem.fromScene(room, .035).texture;
  room.dispose(); pmrem.dispose();
  for (const [x, y, z, c, i] of [[-4, 8, 3, 0xffffff, 3.1], [2, 3, -5, 0xe9e4dc, 2]]) {
    const l = new T.DirectionalLight(c, i); l.position.set(x, y, z); scene.add(l);
  }
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 2400);
  const metal = (color, roughness = .4, extra = {}) => new T.MeshStandardMaterial({ color, roughness, metalness: .8, ...extra });
  const box = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);

  // Base slab with a recessed tray and four screws.
  const base = new T.Mesh(box(320, 14, 320, 6), metal(0x2a2a2f, .42));
  base.position.y = -7; scene.add(base);
  const tray = new T.Mesh(box(286, 2, 286, 3), metal(0x141417, .6));
  tray.position.y = .4; scene.add(tray);
  const screwMat = metal(0x6a6a70, .28);
  for (const [x, z] of [[-146, -146], [146, -146], [-146, 146], [146, 146]]) {
    const s = new T.Mesh(new T.CylinderGeometry(4.2, 4.2, 1.6, 28), screwMat);
    s.position.set(x, .8, z); scene.add(s);
  }

  // Bars, each with its label printed on top at 6x resolution.
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function face(b) {
    const c = document.createElement('canvas'); c.width = 1560; c.height = 300;
    const g = c.getContext('2d');
    g.font = '500 34px "Geist Mono", ui-monospace, monospace';
    g.fillStyle = b.hot ? '#ff3b4a' : '#8c8b88';
    g.fillText(b.label, 40, 92);
    g.fillStyle = '#8c8b88'; g.textAlign = 'right'; g.fillText(b.time, 1520, 92); g.textAlign = 'left';
    g.font = '600 92px Inter, system-ui, sans-serif'; g.fillStyle = '#f2f1ee';
    g.fillText(b.text, 36, 214);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  }
  const bars = BARS.map((b, i) => {
    const group = new T.Group();
    const bodyMat = metal(b.hot ? 0x2e2e33 : 0x26262b, .34, { transparent: true });
    const body = new T.Mesh(box(262, 18, 52, 6), bodyMat); group.add(body);
    if (b.hot) {
      const edge = new T.Mesh(box(4, 18.4, 30, 1.6), new T.MeshStandardMaterial({ color: 0xd4142a, emissive: 0xd4142a, emissiveIntensity: .8, roughness: .3, transparent: true }));
      edge.position.set(-133, 0, 0); group.add(edge);
    }
    const labelMat = new T.MeshBasicMaterial({ map: face(b), transparent: true, toneMapped: false });
    const label = new T.Mesh(new T.PlaneGeometry(250, 48), labelMat);
    label.rotation.x = -Math.PI / 2; label.position.y = 9.15; group.add(label);
    group.position.set(0, 10, -96 + i * 64);
    scene.add(group);
    return { group, mats: group.children.map(m => m.material), y: 160, o: 0 };
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last = 0, w = 0, h = 0, inView = false, disposed = false;
  function draw(now) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60; last = now;
    const k = reduced.matches ? 1 : 1 - Math.exp(-dt * 11);
    let moving = false;
    bars.forEach((b, i) => {
      const on = i <= step;
      const ty = on ? 0 : 150, to = on ? 1 : 0;
      b.y += (ty - b.y) * k; b.o += (to - b.o) * k;
      if (Math.abs(ty - b.y) > .05 || Math.abs(to - b.o) > .003) moving = true; else { b.y = ty; b.o = to; }
      b.group.position.y = 10 + b.y;
      b.group.visible = b.o > .01;
      b.mats.forEach(m => { m.opacity = b.o; });
    });
    renderer.render(scene, camera);
    if (moving) wake(); else last = 0;
  }
  function wake() { if (!raf && !disposed && inView && w && h) raf = requestAnimationFrame(draw); }
  function resize() {
    const nw = el.clientWidth, nh = el.clientHeight;
    if (!nw || !nh) return;
    w = nw; h = nh;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const a = w / h, half = Math.max(390 / a, 330) / 2;
    camera.top = half; camera.bottom = -half; camera.left = -half * a; camera.right = half * a;
    camera.position.set(450, 385, 575); camera.lookAt(0, 4, 18);
    camera.updateProjectionMatrix();
    wake();
  }
  const ro = new ResizeObserver(resize); ro.observe(el);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) wake(); }); io.observe(el);
  resize();
  instance = {
    wake,
    destroy() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); canvas.remove(); },
  };
}

window.CinderSlab = {
  mount(el) { mount(el).catch(() => document.documentElement.classList.add('slab-failed')); },
  setStep(n) { if (Number.isInteger(n) && n !== step) { step = n; instance?.wake(); } },
};
window.dispatchEvent(new Event('cinder-slab'));
