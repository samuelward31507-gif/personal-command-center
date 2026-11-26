import * as T from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = n => Math.max(0, Math.min(1, n));
function ease(n) {
  n = clamp(n);
  return n * n * (3 - 2 * n);
}
const rad = T.MathUtils.degToRad;
const white = '#F2F1EE', grey = '#A3A19D', red = '#E5172F';
const events = [
  ['New lead', 'Dana Ruiz · Missed call 7:42 PM'],
  ['Estimate booked', 'Thu 9:00 AM · 41 Aspen Ct'],
  ['Quote followed up', 'Henderson · $6,100'],
  ['Invoice paid', 'Priya Shah · $4,650'],
  ['Review requested', '5 stars received']
];

let active, requested = 0;

function outline(w, h, r) {
  const s = new T.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}

function mount(el) {
  destroy();
  const abort = new AbortController(), opts = { signal: abort.signal };
  const renderer = new T.WebGLRenderer({
    alpha: true, antialias: true, powerPreference: 'high-performance'
  });
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('role', 'img');
  el.append(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;

  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
  const low = matchMedia('(pointer:coarse)').matches ||
    (navigator.hardwareConcurrency || 8) <= 4 || /swiftshader|llvmpipe/i.test(gpu) || !renderer.capabilities.isWebGL2;
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const hover = matchMedia('(hover:hover) and (pointer:fine)');
  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(-600, 600, 360, -360, 1, 5000);
  cam.position.z = 1700;
  const phone = new T.Group();
  scene.add(phone);

  const owned = new Set();
  function own(resource) {
    owned.add(resource);
    return resource;
  }
  function physical(color, metalness, roughness, extra = {}) {
    return own(new T.MeshPhysicalMaterial({ color, metalness, roughness, ...extra }));
  }
  function mesh(geometry, material, parent = phone) {
    const object = new T.Mesh(own(geometry), material);
    parent.add(object);
    return object;
  }

  const metal = physical('#2A2A2F', .91, .3, { anisotropy: .62, clearcoat: .22 });
  const lip = physical('#77767C', .95, .26, { anisotropy: .6, clearcoat: .18 });
  const rubber = physical('#111113', .02, .88);
  const glass = physical('#0D0D10', .26, .18, { clearcoat: 1, clearcoatRoughness: .1 });
  const steel = physical('#A3A19D', .98, .21);

  const grain = document.createElement('canvas');
  grain.width = 256;
  grain.height = 128;
  const gc = grain.getContext('2d');
  let seed = 23;
  for (let y = 0; y < 128; y++) {
    seed = (seed * 48271) % 2147483647;
    const value = 190 + seed % 50;
    gc.fillStyle = `rgb(${value},${value},${value})`;
    gc.fillRect(0, y, 256, 1);
  }
  const gt = own(new T.CanvasTexture(grain));
  gt.wrapS = gt.wrapT = T.RepeatWrapping;
  gt.repeat.set(.013, .018);
  metal.roughnessMap = lip.roughnessMap = gt;

  function slab(w, h, r, depth, bevel, z, material) {
    const geometry = new T.ExtrudeGeometry(outline(w - 2 * bevel, h - 2 * bevel, r - bevel), {
      depth, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: 12
    });
    const object = mesh(geometry, material);
    object.position.z = z;
    object.castShadow = true;
    return object;
  }
  slab(314, 650, 33, 17, 5, -14, metal);
  slab(312, 648, 32, 1, 2, 7, lip);
  slab(307, 643, 30, 1, 1.4, 10, rubber);
  slab(303, 637, 28, 1, 2.4, 12.4, glass);
  const emitter = own(new T.MeshBasicMaterial({ color: red, toneMapped: false }));
  const rail = slab(3.6, 147, 1.8, 1, .65, 0, emitter);
  rail.rotation.y = Math.PI / 2;
  rail.position.set(156.6, 38, -3);
  const key = slab(5, 52, 2.5, 4, 1, 0, metal);
  key.position.set(-157, 45, -7);

  function mergedParts(parts, material, z) {
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    mesh(geometry, material).position.z = z;
  }
  for (const [radius, material, z] of [[3.6, rubber, 16.1], [2.7, steel, 16.3]]) {
    mergedParts([-132, 132].map(x =>
      new T.CircleGeometry(radius, 24).translate(x, -300, 0)), material, z);
  }
  mergedParts([-132, 132].flatMap(x => [0, Math.PI / 2].map(angle =>
    new T.PlaneGeometry(3.3, .8).rotateZ(angle + .28).translate(x, -300, 0)
  )), rubber, 16.5);

  RectAreaLightUniformsLib.init();
  const studio = new T.Scene();
  const panelGeo = new T.PlaneGeometry(1, 1);
  const panelMat = new T.MeshBasicMaterial({ color: new T.Color(4, 4, 4), side: T.DoubleSide });
  const lights = [];
  for (const [x, y, z, w, h, power] of [
    [-420, 260, 370, 190, 680, 4],
    [400, 140, 180, 90, 590, 5],
    [20, 520, 80, 540, 120, 4]
  ]) {
    const light = new T.RectAreaLight(0xffffff, power, w, h);
    light.position.set(x, y, z);
    light.lookAt(0, 0, 0);
    scene.add(light);
    lights.push(light);
    const panel = new T.Mesh(panelGeo, panelMat);
    panel.position.copy(light.position).multiplyScalar(.01);
    panel.scale.set(w * .01, h * .01, 1);
    panel.quaternion.copy(light.quaternion);
    studio.add(panel);
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const env = own(pmrem.fromScene(studio, .02, .1, 50));
  scene.environment = env.texture;
  pmrem.dispose();
  panelGeo.dispose();
  panelMat.dispose();

  const keyLight = new T.DirectionalLight(0xfffcf6, 2.1);
  keyLight.position.set(-150, 700, 350);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const shadowCam = keyLight.shadow.camera;
  Object.assign(shadowCam, { left: -480, right: 480, top: 580, bottom: -580, near: 1, far: 1700 });
  shadowCam.updateProjectionMatrix();
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.normalBias = .4;
  const floor = mesh(new T.PlaneGeometry(2100, 1800), own(new T.ShadowMaterial({ opacity: .22 })), scene);
  floor.rotation.x = -Math.PI / 2 + .12;
  floor.receiveShadow = true;

  // Each surface uploads independently. Row motion only changes mesh transforms.
  const sheets = [];
  let pixelScale = 4, fontsReady = false;
  function text(c, str, x, y, size, color = white, mono = false) {
    c.font = mono ? `500 ${size}px "Geist Mono",monospace` : `600 ${size}px Inter,Arial,sans-serif`;
    c.fillStyle = color;
    c.fillText(str, x, y);
  }
  function sheet(w, h, x, y, z, paint) {
    const surface = document.createElement('canvas'), ctx = surface.getContext('2d');
    const tex = own(new T.CanvasTexture(surface));
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = own(new T.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, toneMapped: false
    }));
    const o = mesh(new T.PlaneGeometry(w, h), mat);
    o.position.set(x, y, z);
    o.renderOrder = Math.round(z * 100);
    function draw() {
      if (!fontsReady) return;
      ctx.setTransform(surface.width / w, 0, 0, surface.height / h, 0, 0);
      ctx.clearRect(0, 0, w, h);
      paint(ctx);
      tex.needsUpdate = true;
    }
    function resizeSheet() {
      surface.width = Math.ceil(w * pixelScale);
      surface.height = Math.ceil(h * pixelScale);
      draw();
    }
    sheets.push(resizeSheet);
    resizeSheet();
    return { o, draw };
  }

  let amount = 0;
  sheet(280, 568, 0, 9, 15.95, c => {
    c.fillStyle = '#000';
    c.beginPath();
    c.roundRect(0, 0, 280, 568, 18);
    c.fill();
    text(c, 'Today', 14, 50, 37);
    text(c, 'Brightline Co.', 14, 74, 15, grey);
    c.fillStyle = '#111113';
    c.beginPath();
    c.roundRect(10, 92, 260, 96, 9);
    c.fill();
    text(c, 'Won this month', 22, 118, 14, grey);
  });
  const number = sheet(246, 52, 0, 135, 16.05, c =>
    text(c, '$' + amount.toLocaleString('en-US'), 5, 39, 36, white, true));
  const dot = mesh(new T.CircleGeometry(3, 32), emitter);
  dot.position.set(118, 257, 16.2);
  dot.renderOrder = 1700;
  const empty = sheet(250, 35, 0, 68, 16.1, c => text(c, 'Waiting for activity', 0, 21, 15, grey));
  const rows = events.map(([title, detail]) => sheet(260, 65, 0, 0, 16.12, c => {
    text(c, title, 6, 23, 19);
    text(c, detail, 6, 43, 14, grey);
    c.fillStyle = '#3A3A40';
    c.fillRect(6, 64, 248, .8);
  }));
  const reply = sheet(248, 18, 0, 0, 16.18, c => text(c, 'Replied in seconds', 1, 13, 12, white, true));
  const bars = events.map((_, i) => mesh(new T.PlaneGeometry(1.6, 43), own(new T.MeshBasicMaterial({
    color: i === 0 ? red : white, transparent: true, depthWrite: false, toneMapped: false
  }))));
  bars.forEach(bar => { bar.renderOrder = 1700; });
  sheet(227, 19, 0, -300, 16.4, c => {
    c.textAlign = 'center';
    text(c, 'EXAMPLE BUSINESS · SAMPLE DATA', 113.5, 13, 10.8, '#111113', true);
    text(c, 'EXAMPLE BUSINESS · SAMPLE DATA', 113.5, 12.4, 10.8, grey, true);
  });

  const composer = new EffectComposer(renderer);
  composer.renderToScreen = low;
  const passes = [];
  function pass(p) {
    passes.push(p);
    composer.addPass(p);
    return p;
  }
  pass(new RenderPass(scene, cam));
  let ao;
  if (!low) {
    ao = pass(new GTAOPass(scene, cam, 1, 1));
    ao.blendIntensity = .11;
    ao.updateGtaoMaterial({ radius: 5, samples: 6 });
    ao.updatePdMaterial({ samples: 4 });
  }
  pass(new OutputPass());
  pass(new SMAAPass(1, 1));

  const blend = own(new T.ShaderMaterial({
    uniforms: { map: { value: null }, weight: { value: 1 } },
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float weight;varying vec2 v;void main(){gl_FragColor=texture2D(map,v)*weight;}',
    depthTest: false, depthWrite: false, transparent: true
  }));
  const quad = new FullScreenQuad(blend);
  const sum = low ? null : own(new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: false }));
  function blit(texture, target, weight, add) {
    blend.uniforms.map.value = texture;
    blend.uniforms.weight.value = weight;
    blend.blending = add ? T.CustomBlending : T.NoBlending;
    blend.blendSrc = T.OneFactor;
    blend.blendDst = T.OneFactor;
    blend.blendEquation = T.AddEquation;
    renderer.setRenderTarget(target);
    renderer.autoClear = false;
    quad.render(renderer);
    renderer.autoClear = true;
  }

  let p = requested, v = 0, mouseX = 0, mouseY = 0, tiltX = 0, tiltY = 0;
  let last = 0, age = 0, lastIdle = -1, frame = 0, timer = 0, samples = 0;
  let dirty = true, visible = true, lost = false, dead = false;
  let width = 0, height = 0, lastFeed = NaN;
  function cancel() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = 0;
  }
  function wake() {
    clearTimeout(timer);
    timer = 0;
    if (!frame && visible && !document.hidden && !lost && !dead && width && height) {
      frame = requestAnimationFrame(tick);
    }
  }
  function invalidate() {
    dirty = true;
    samples = 0;
    wake();
  }
  function resize() {
    if(lost || dead)return;
    width = el.clientWidth;
    height = el.clientHeight;
    if (!width || !height) return;
    const span = Math.max(669, 373 * height / width), aspect = width / height;
    Object.assign(cam, { left: -span * aspect / 2, right: span * aspect / 2, top: span / 2, bottom: -span / 2 });
    cam.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    sum?.setSize(size.x, size.y);
    if (ao) ao.setSize(Math.max(1, Math.round(size.x / 2)), Math.max(1, Math.round(size.y / 2)));
    const scale = Math.min(renderer.capabilities.maxTextureSize / 568, Math.max(4, Math.ceil(4 * height / span)));
    if (scale !== pixelScale) {
      pixelScale = scale;
      sheets.forEach(redraw => redraw());
    }
    invalidate();
  }

  function feed() {
    if (lastFeed === p) return;
    lastFeed = p;
    const arrivals = events.map((_, i) => clamp((p - .3) / .12 - i));
    const next = Math.round(32850 + 930 * arrivals.reduce((s, t) => s + ease(t / .84), 0));
    if (next !== amount) {
      amount = next;
      number.draw();
    }
    empty.o.material.opacity = 1 - ease(arrivals[0] * 4);
    let shift = 0;
    for (let i = 4; i >= 0; i--) {
      const t = arrivals[i], a = ease(t / .68);
      const lift = 9 * (1 - a) - 1.7 * Math.sin(Math.PI * ease((t - .45) / .55));
      const y = 57 - shift - lift, row = rows[i].o;
      row.position.y = y;
      row.material.opacity = ease(t / .37);
      row.visible = t > 0;
      const bar = bars[i];
      bar.position.set(-129, y + 1, 16.2);
      bar.material.opacity = ease(t / .18) * (1 - ease((t - .28) / .65));
      bar.visible = bar.material.opacity > .001;
      if (i === 0) {
        reply.o.position.y = y - 22;
        reply.o.material.opacity = ease((t - .62) / .36);
      }
      shift += 67 * a;
    }
    const count = arrivals.filter(t => t > 0).length;
    canvas.setAttribute('aria-label',
      'Brightline Co. Today. Won this month $' + amount.toLocaleString('en-US') + '. ' +
      events.slice(0, count).reverse().map(e => e.join('. ')).join('. ') +
      (arrivals[0] >= .98 ? '. Replied in seconds.' : '') + ' Example business. Sample data.');
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || lost || dead || !width || !height || gl.isContextLost()) return;
    const dt = Math.min(.05, (now - last) / 1000 || .016);
    last = now;
    const previous = p, oldX = tiltX, oldY = tiltY;
    const err = p - requested, decay = Math.exp(-38 * dt), s = v + 38 * err;
    p = reduced.matches ? requested : requested + (err + s * dt) * decay;
    v = reduced.matches ? 0 : (v - 38 * s * dt) * decay;
    if (Math.abs(p - requested) < .000015 && Math.abs(v) < .0005) {
      p = requested;
      v = 0;
    }
    const k = reduced.matches ? 1 : 1 - Math.exp(-20 * dt);
    const targetX = reduced.matches ? 0 : mouseX, targetY = reduced.matches ? 0 : mouseY;
    tiltX += (targetX - tiltX) * k;
    tiltY += (targetY - tiltY) * k;
    const moving = p !== requested || Math.abs(tiltX - targetX) + Math.abs(tiltY - targetY) > .0001;
    const rise = ease(p / .3);
    phone.scale.setScalar(.94 + .06 * rise);
    phone.position.y = -53 * (1 - rise);
    phone.rotation.set(rad(-35 + 15 * rise + 4 * tiltY), rad(-32 + 26 * rise + 4 * tiltX), rad(-7 + 7 * rise), 'YXZ');
    floor.position.y = phone.position.y - 325 * phone.scale.x * Math.cos(phone.rotation.x) - 14;
    feed();
    age += dt;
    const phase = reduced.matches ? 0 : (age % 7.2) / 7.2;
    const idle = phase < .55 ? Math.sin(Math.PI * phase / .55) ** 2 : 0;
    lights[1].position.x = 400 - 150 * idle;
    lights[1].lookAt(0, 0, 0);
    dot.scale.setScalar(1 + .13 * idle);
    const poseChanged = p !== previous || tiltX !== oldX || tiltY !== oldY;
    if (poseChanged) renderer.shadowMap.needsUpdate = true;
    const changed = dirty || moving || poseChanged || idle !== lastIdle;
    dirty = false;
    lastIdle = idle;
    if (changed) samples = 0;

    if (changed || (!low && samples < 16)) {
      const accumulate = !low && !changed;
      if (accumulate) {
        const x = ((samples % 4) + .5) / 4 - .5;
        const y = (Math.floor(samples / 4) + .5) / 4 - .5;
        cam.setViewOffset(sum.width, sum.height, x, y, sum.width, sum.height);
      }
      composer.render();
      const tex = composer.readBuffer.texture;
      if (accumulate) {
        cam.clearViewOffset();
        if (!samples) {
          renderer.setRenderTarget(sum);
          renderer.clear();
        }
        blit(tex, sum, 1 / 16, true);
        samples++;
        blit(sum.texture, null, 16 / samples, false);
      } else if (!low) {
        blit(tex, null, 1, false);
      }
    }
    if (moving) wake();
    else if (!reduced.matches || (!low && samples < 16)) timer = setTimeout(wake, 34);
  }

  function park() {
    cancel();
    last = 0;
  }
  function resume() {
    if (document.hidden || !visible) park();
    else invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    resume();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', resume, opts);
  reduced.addEventListener('change', invalidate, opts);
  el.addEventListener('pointermove', e => {
    if (!hover.matches || reduced.matches) return;
    const b = el.getBoundingClientRect();
    mouseX = 2 * clamp((e.clientX - b.left) / b.width) - 1;
    mouseY = 2 * clamp((e.clientY - b.top) / b.height) - 1;
    const len = Math.max(1, Math.hypot(mouseX, mouseY));
    mouseX /= len;
    mouseY /= len;
    invalidate();
  }, opts);
  el.addEventListener('pointerleave', () => {
    mouseX = mouseY = 0;
    invalidate();
  }, opts);
  let released=false;
  function releaseGPU(){
    if(released)return;
    released=true;
    quad.dispose();
    passes.forEach(pass => pass.dispose());
    ao?.gtaoMaterial.dispose();
    ao?.blendMaterial.dispose();
    composer.dispose();
    keyLight.shadow.dispose();
    owned.forEach(resource => resource.dispose());
    scene.clear();
    renderer.dispose();
    if(!lost)renderer.forceContextLoss();
  }
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = true;
    park();
    releaseGPU();
  }, opts);
  canvas.addEventListener('webglcontextrestored', () => {
    if (!dead) mount(el);
  }, opts);

  Promise.all([
    document.fonts.load('600 16px Inter'),
    document.fonts.load('500 16px "Geist Mono"'),
    document.fonts.ready
  ]).then(() => {
    if (!dead) {
      fontsReady = true;
      sheets.forEach(redraw => redraw());
      invalidate();
    }
  });

  active = {
    wake: invalidate,
    dispose() {
      dead = true;
      park();
      abort.abort();
      ro.disconnect();
      io.disconnect();
      releaseGPU();
      canvas.remove();
    }
  };
  resize();
}

function setProgress(value) {
  if (Number.isFinite(value)) {
    const next = clamp(value);
    if (next !== requested) {
      requested = next;
      active?.wake();
    }
  }
}
function destroy() {
  active?.dispose();
  active = null;
}
window.CinderPhone = { mount, setProgress, destroy };

window.dispatchEvent(new Event('cinder-phone'));
window.dispatchEvent(new Event('cinder-visual'));
