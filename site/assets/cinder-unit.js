// The Cinder unit, V3. Built from the brief; API: mount, setProgress, setActive, destroy.
const names = ['Answering', 'Booking', 'Quote follow-up', 'Invoices', 'Reviews', 'Website'];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function ease(p, a, b) {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
}

let progress = 0, active = -1, session;

function destroy() {
  session?.dispose();
  session = null;
}

function mount(el) {
  destroy();

  const frame = document.createElement('div');
  frame.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate';
  frame.setAttribute('role', 'group');
  frame.setAttribute('aria-label', 'Cinder Revenue unit');
  el.append(frame);

  const releases = [], assets = new Set();
  let dead = false, renderer, raf = 0, timer = 0, visible = false, lost = false;

  function own(item) {
    assets.add(item);
    return item;
  }

  function stop() {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = timer = 0;
  }

  function dispose() {
    dead = true;
    stop();
    releases.splice(0).forEach(fn => fn());
    assets.forEach(resource => resource.dispose());
    assets.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    frame.remove();
  }

  function listen(node, type, fn) {
    node.addEventListener(type, fn);
    releases.push(() => node.removeEventListener(type, fn));
  }

  session = {dispose, wake() {}};

  async function build() {
    const [T, {RoundedBoxGeometry}, {RoomEnvironment}, {mergeGeometries}] = await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/utils/BufferGeometryUtils.js')
    ]);
    if (dead) return;

    const canvas = document.createElement('canvas');
    const options = {alpha:true, antialias:true, powerPreference:'high-performance'};
    const context = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
    if (!context) {
      frame.style.background = '#111113';
      return;
    }

    renderer = new T.WebGLRenderer({...options, canvas, context});
    renderer.setClearColor(0, 0);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.outputColorSpace = T.SRGBColorSpace;
    canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Six machined graphite layers with a red dial');
    frame.append(canvas);

    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 3600);
    camera.position.set(1000, 816.49658, 1000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const room = new RoomEnvironment(renderer);
    const pm = new T.PMREMGenerator(renderer);

    function card(x, y, z, w, h, power) {
      const material = new T.MeshBasicMaterial({color:0xf2f1ee});
      material.color.multiplyScalar(power);
      const patch = new T.Mesh(new T.PlaneGeometry(w, h), material);
      patch.position.set(x, y, z);
      patch.lookAt(0, 0, 0);
      room.add(patch);
    }

    card(-7, 10, 5, 9, 6, 5);
    card(3, 5, -8, 1.2, 7, 7);
    try {
      scene.environment = own(pm.fromScene(room, .045)).texture;
    } finally {
      room.dispose();
      pm.dispose();
    }

    function light(color, power, x, y, z) {
      const lamp = new T.DirectionalLight(color, power);
      lamp.position.set(x, y, z);
      scene.add(lamp);
      return lamp;
    }

    const key = light(0xf2f1ee, 2.2, -3, 6, 4);
    light(0xf2f1ee, 2.7, 2, 4, -5);

    function texture(w, h, paint, color = true) {
      const image = document.createElement('canvas');
      image.width = w;
      image.height = h;
      paint(image.getContext('2d'));
      const result = own(new T.CanvasTexture(image));
      if (color) result.colorSpace = T.SRGBColorSpace;
      result.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return result;
    }

    const grain = texture(128, 128, ctx => {
      const data = ctx.createImageData(128, 128);
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const n = 4 * (128*y + x);
          const v = Math.sin(y*2.17 + .25*Math.sin(x*.05)) + Math.sin(y*.73 + x*.012)*.45;
          data.data[n] = 128;
          data.data[n+1] = 128 + v*19;
          data.data[n+2] = 253;
          data.data[n+3] = 255;
        }
      }
      ctx.putImageData(data, 0, 0);
    }, false);

    grain.wrapS = grain.wrapT = T.RepeatWrapping;
    grain.repeat.set(2, 4);
    const sideGrain = own(grain.clone());
    sideGrain.rotation = Math.PI/2;
    sideGrain.needsUpdate = true;

    function mat(color, roughness = .36, extra = {}) {
      return own(new T.MeshPhysicalMaterial({color, metalness:.9, roughness, ...extra}));
    }

    const satin = mat(0x2a2a2f, .42, {
      normalMap:sideGrain, normalScale:new T.Vector2(.15, .22)
    });
    const top = mat(0x3a3a40, .32, {
      clearcoat:.16, clearcoatRoughness:.34,
      normalMap:grain, normalScale:new T.Vector2(.12, .18)
    });
    const steel = mat(0xa3a19d, .28, {metalness:.95});
    const dark = mat(0x111113, .42);
    const rubber = mat(0x111113, .89, {metalness:0});
    const glass = mat(0x111113, .28, {metalness:.18, clearcoat:.9});
    const red = mat(0xe5172f, .31, {emissive:0xe5172f, emissiveIntensity:.9});
    const geometryCache = new Map();

    function rounded(w, h, d, r) {
      const id = [w,h,d,r].join('/');
      if (!geometryCache.has(id)) {
        geometryCache.set(id, own(new RoundedBoxGeometry(w, h, d, 4, r)));
      }
      return geometryCache.get(id);
    }

    function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
      const object = new T.Mesh(own(geometry), material);
      object.position.set(x, y, z);
      parent.add(object);
      return object;
    }

    const dummy = new T.Object3D();
    function repeat(parent, geometry, material, poses) {
      const batch = own(new T.InstancedMesh(own(geometry), material, poses.length));
      poses.forEach(([x, y, z, angle = 0], i) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, angle, 0);
        dummy.updateMatrix();
        batch.setMatrixAt(i, dummy.matrix);
      });
      parent.add(batch);
      return batch;
    }

    function rect(w, d, r, x = 0, z = 0) {
      const shape = new T.Shape();
      const left = x-w/2, bottom = -z-d/2, right = left+w, upper = bottom+d;
      shape.moveTo(left+r, bottom);
      shape.lineTo(right-r, bottom);
      shape.quadraticCurveTo(right, bottom, right, bottom+r);
      shape.lineTo(right, upper-r);
      shape.quadraticCurveTo(right, upper, right-r, upper);
      shape.lineTo(left+r, upper);
      shape.quadraticCurveTo(left, upper, left, upper-r);
      shape.lineTo(left, bottom+r);
      shape.quadraticCurveTo(left, bottom, left+r, bottom);
      return shape;
    }

    function circle(r, x = 0, z = 0) {
      const shape = new T.Shape(), n = r > 40 ? 128 : r > 10 ? 64 : 40;
      for (let i = 0; i < n; i++) {
        const a = 2*Math.PI*i/n;
        shape[i ? 'lineTo' : 'moveTo'](x+r*Math.cos(a), -z+r*Math.sin(a));
      }
      shape.closePath();
      return shape;
    }

    function cut(shape, height, bevel, segments = 8) {
      const geometry = new T.ExtrudeGeometry(shape, {
        depth:height, curveSegments:segments, bevelEnabled:true,
        bevelSegments:2, bevelThickness:bevel, bevelSize:bevel, steps:1
      });
      geometry.rotateX(-Math.PI/2);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)/280, uv.getY(i)/280);
      geometry.clearGroups();
      return geometry;
    }

    function lathe(points, n = 64) {
      return new T.LatheGeometry(points.map(([x,y]) => new T.Vector2(x,y)), n);
    }

    function disc(parent, r, h, material, x, y, z) {
      const profile = [[.001,0],[r-.35,0],[r,.3],[r,h-.3],[r-.35,h],[.001,h]];
      return mesh(parent, lathe(profile), material, x, y, z);
    }

    function torus(parent, r, t, material, x, y, z) {
      const object = mesh(parent, new T.TorusGeometry(r,t,8,96), material, x,y,z);
      object.rotation.x = -Math.PI/2;
      return object;
    }

    function textMap(text, w, h, font, spacing) {
      return texture(w, h, ctx => {
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#a3a19d';
        const widths = Array.from(text, ch => ctx.measureText(ch).width);
        let x = (w - widths.reduce((a,b) => a+b, 0) - spacing*(text.length-1))/2;
        Array.from(text).forEach((ch, i) => {
          ctx.fillText(ch, x, h/2);
          x += widths[i] + spacing;
        });
      });
    }

    const plates = [], edges = [], hits = [], screws = [];
    const corners = [[-117,-117],[117,-117],[-117,117],[117,117]];

    const ventFace = rect(274,25,3);
    for (let i = 0; i < 13; i++) ventFace.holes.push(rect(2.6,13,1.25,(i-6)*8));
    const ventGeo = cut(ventFace,1.1,.22,4);
    ventGeo.rotateX(Math.PI/2);

    const rim = rect(279.3,279.3,5);
    rim.holes.push(rect(275,275,4));
    const rimGeo = cut(rim,.95,.20,5);

    const pockets = [
      circle(59), rect(70,50,4,0,94), circle(19,0,101),
      rect(100,12,3,0,100), rect(40,15,2,32,104), rect(72,31,3,0,100)
    ];

    for (let i = 0; i < 6; i++) {
      const group = new T.Group();
      scene.add(group);
      plates.push(group);

      const body = mesh(group, rounded(280,30,277,5), satin, 0,-2,-1.5);
      body.userData.index = i;
      hits.push(body);

      const face = rect(278,278,5);
      face.holes.push(pockets[i]);
      if (i === 0) {
        corners.forEach(([x,z]) => face.holes.push(circle(6,x,z)));
        face.holes.push(rect(78,17,3,0,-87));
      }
      const cover = mesh(group, cut(face,3.35,.35,12), top, 0,13.3,0);
      cover.userData.index = i;
      hits.push(cover);

      const edge = own(steel.clone());
      edge.color.setHex(0x6f6d69);
      edges.push(edge);
      mesh(group, rimGeo, edge, 0,11.95,0);
      if (i < 5) mesh(group, rounded(267,1.4,267,.65), rubber, 0,-17.2,0);

      const vent = mesh(group, ventGeo, satin, 0,-2,138.45);
      vent.userData.index = i;
      hits.push(vent);
      mesh(group, rounded(107,16,1,.48), dark, 0,-2,137.48);
      mesh(group, cut(pockets[i].clone(),.25,.1,12), dark, 0,13.02,0);
    }

    // Answering: sunk dial, index marks, perforated insert, counterbored screws.
    const lid = plates[0];
    disc(lid,53.5,2.4,top,0,13.4,0);
    torus(lid,55.8,.85,red,0,15.1,0);
    const ticks = Array.from({length:48}, (_,i) => {
      const a = i*Math.PI/24;
      return [64*Math.sin(a),17.03,64*Math.cos(a),a];
    });
    repeat(lid,cut(rect(.52,2.62,.2),.13,.08,2),steel,ticks);
    mesh(lid,rounded(1.1,.4,9,.19),steel,0,15.9,-43);

    const grille = rect(76.8,15.8,2.5);
    for (let i = 0; i < 45; i++) {
      const hole = new T.Path();
      const x = (i%15-7)*4.8, z = -4.8+Math.floor(i/15)*4.8;
      hole.absarc(x,-z,1.25,0,2*Math.PI,false);
      grille.holes.push(hole);
    }
    mesh(lid,cut(grille,.62,.12,5),top,0,16.15,-87);
    mesh(lid,rounded(76,.7,15,.3),dark,0,13.6,-87);

    const ink = own(new T.MeshBasicMaterial({
      map:textMap('CINDER REVENUE · UNIT',2048,128,'500 78px "Geist Mono",monospace',12),
      transparent:true, depthWrite:false
    }));
    const label = mesh(lid,new T.PlaneGeometry(116,7.25),ink,0,17.06,96);
    label.rotation.x = -Math.PI/2;

    const cross = new T.Shape();
    [
      [-1,-3.6],[1,-3.6],[1,-1],[3.6,-1],[3.6,1],[1,1],
      [1,3.6],[-1,3.6],[-1,1],[-3.6,1],[-3.6,-1],[-1,-1]
    ].forEach(([x,y],i) => cross[i ? 'lineTo' : 'moveTo'](x,y));
    cross.closePath();
    const head = circle(5.35);
    head.holes.push(cross);
    const headGeo = cut(head,1.55,.2,20);
    const shaftGeo = lathe([
      [.01,-30],[1.8,-30],[2.1,-29.4],[2.1,-1],[4.8,-.6],[5.15,0],[.01,0]
    ],32);
    const threadPoints = Array.from({length:217}, (_,i) => {
      const a = i*Math.PI/9;
      return new T.Vector3(2.12*Math.cos(a),-29+i*.12,2.12*Math.sin(a));
    });
    const thread = new T.TubeGeometry(new T.CatmullRomCurve3(threadPoints),216,.43,5,false);
    const pieces = [headGeo,shaftGeo,thread].map(g => g.index ? g.toNonIndexed() : g);
    const screwGeo = mergeGeometries(pieces);
    new Set([...pieces,headGeo,shaftGeo,thread]).forEach(g => g.dispose());
    const crossFloor = cut(cross,.15,.06);

    for (const [x,z] of corners) {
      const screw = new T.Group();
      screw.position.set(x,15.25,z);
      lid.add(screw);
      screws.push(screw);
      mesh(screw,screwGeo,steel);
      mesh(screw,crossFloor,dark,0,.06,0);
    }

    // Booking.
    const keys = [];
    for (let i = 0; i < 12; i++) {
      const pose = [(i%4-1.5)*15,15.2,94+(Math.floor(i/4)-1)*13];
      if (i === 10) mesh(plates[1],rounded(12,3.2,10,1.4),red,...pose);
      else keys.push(pose);
    }
    repeat(plates[1],rounded(12,3.2,10,1.4),satin,keys);

    // Quote follow-up.
    disc(plates[2],16.8,3.7,top,0,13.25,101);
    const knurls = Array.from({length:40}, (_,i) => {
      const a = i*Math.PI/20;
      return [16.6*Math.sin(a),15.35,101+16.6*Math.cos(a),a];
    });
    repeat(plates[2],lathe([[.01,-1.2],[.52,-1],[.52,1],[.01,1.2]],6),steel,knurls);
    mesh(plates[2],rounded(1.2,.32,8,.15),steel,0,17.04,91.5);

    // Invoices.
    mesh(plates[3],rounded(93,.8,5,.35),satin,0,13.8,103);

    // Reviews.
    const star = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI/2+i*Math.PI/5, r = i%2 ? 4.3 : 9;
      star[i ? 'lineTo' : 'moveTo'](r*Math.cos(a),r*Math.sin(a));
    }
    star.closePath();
    mesh(plates[4],cut(star,.4,.2),steel,-13,17,104);

    const digits = own(new T.MeshPhysicalMaterial({
      color:0xf2f1ee, roughness:.42, metalness:.85,
      map:texture(256,1024,ctx => {
        ctx.fillStyle = '#1c1c1f';
        ctx.fillRect(0,0,256,1024);
        ctx.fillStyle = '#f2f1ee';
        ctx.font = '500 96px "Geist Mono",monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 10; i++) ctx.fillText(String(i),128,(i+.5)*102.4);
      })
    }));
    const drumGeo = new T.CylinderGeometry(5,5,10,48,1,true);
    for (let i = 0; i < 3; i++) {
      const drum = mesh(plates[4],drumGeo,digits,20+i*12,11.9,104);
      drum.rotation.z = Math.PI/2;
      drum.rotateY(Math.PI*(.4+i*.2));
    }
    const duv = drumGeo.attributes.uv;
    for (let i = 0; i < duv.count; i++) {
      const u = duv.getX(i);
      duv.setXY(i,duv.getY(i),u);
    }

    // Website, rear connector and cable.
    mesh(plates[5],rounded(70,2.6,29,1.2),glass,0,14.7,100);
    const cablePoints = [
      [97,-5,-136],[97,-5,-156],[110,-11,-176],
      [135,-15,-182],[156,-15,-190],[165,-15,-208]
    ];
    const path = new T.CatmullRomCurve3(cablePoints.map(p => new T.Vector3(...p)));
    mesh(plates[5],new T.TubeGeometry(path,48,2.5,10,false),rubber);
    const boot = mesh(plates[5],lathe([
      [3,0],[5.4,1],[5.4,4],[4.3,5],[5,7],[4,8],
      [4.6,10],[3.8,11],[4,13],[2.7,16]
    ],32),rubber,97,-5,-139);
    boot.rotation.x = -Math.PI/2;

    // Dim reflections together with diffuse and emissive light.
    function shaded(material) {
      const result = own(material.clone()), gain = {value:1};
      result.onBeforeCompile = shader => {
        shader.uniforms.cinderGain = gain;
        shader.fragmentShader = 'uniform float cinderGain;\n' +
          shader.fragmentShader.replace('#include <opaque_fragment>',
            'outgoingLight *= cinderGain;\n#include <opaque_fragment>');
      };
      result.userData.gain = gain;
      return result;
    }

    const gains = plates.map((group,i) => {
      const cache = new Map();
      group.traverse(object => {
        if (!object.isMesh) return;
        const original = object.material;
        if (!cache.has(original)) cache.set(original,shaded(original));
        object.material = cache.get(original);
      });
      edges[i] = cache.get(edges[i]);
      return Array.from(cache.values());
    });
    const ringMaterial = lid.children.find(o => o.geometry?.type === 'TorusGeometry').material;

    const stamp = texture(128,128,ctx => {
      const gradient = ctx.createRadialGradient(64,64,5,64,64,64);
      gradient.addColorStop(0,'rgba(0,0,0,.96)');
      gradient.addColorStop(.52,'rgba(0,0,0,.72)');
      gradient.addColorStop(1,'rgba(0,0,0,0)');
      const floor = ctx.createRadialGradient(60,63,12,64,64,64);
      floor.addColorStop(0,'rgba(28,28,31,.65)');
      floor.addColorStop(1,'rgba(17,17,19,0)');
      ctx.fillStyle = floor;
      ctx.fillRect(0,0,128,128);
      ctx.translate(3,2);
      ctx.scale(.85,.85);
      ctx.fillStyle = gradient;
      ctx.fillRect(0,0,128,128);
    });
    const shadow = mesh(scene,new T.PlaneGeometry(420,420),own(new T.MeshBasicMaterial({
      map:stamp, transparent:true, depthWrite:false, toneMapped:false
    })),0,-18,0);
    shadow.rotation.x = -Math.PI/2;

    const rows = names.map((name,i) => {
      const tag = document.createElement('div');
      const number = document.createElement('span'), word = document.createElement('span');
      tag.style.cssText = 'position:absolute;top:0;left:0;display:flex;align-items:center;gap:.5em;white-space:nowrap;pointer-events:none;color:#f2f1ee;font:600 14px/1.2 Inter,Arial,sans-serif';
      number.style.cssText = 'font:500 .83em "Geist Mono",monospace;color:#a3a19d';
      number.textContent = '0'+(i+1);
      word.textContent = name;
      tag.append(number,word);
      const lines = Array.from({length:2}, () => {
        const line = document.createElement('i');
        line.style.cssText = 'position:absolute;left:0;top:0;height:1px;background:rgba(242,241,238,.3);transform-origin:0 50%;pointer-events:none';
        frame.append(line);
        return line;
      });
      frame.append(tag);
      return {tag,word,lines};
    });

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover:hover) and (pointer:fine)');
    const weights = new Float64Array(6), from = new Float64Array(6);
    const anchors = plates.map(() => new T.Vector3());
    let p = reduce.matches ? .7 : progress, velocity = 0, previous = 0;
    let chosen = -1, changed = 0, hover = -1, clock = 0, lastTick = 0;
    let w = 0, h = 0, labelWidth = 0, phone = false, dpr = 0;
    const signal = new T.Color(0xe5172f), silver = new T.Color(0x6f6d69);
    const point = new T.Vector3(), ray = new T.Raycaster(), pointer = new T.Vector2();

    function wake() {
      if (dead || lost || !visible || document.hidden || !w || !h) return;
      clearTimeout(timer);
      timer = 0;
      if (!raf) raf = requestAnimationFrame(draw);
    }

    function hoverAt(i) {
      if (i === hover) return;
      hover = i;
      wake();
      el.onHover?.(i);
    }

    listen(frame,'pointermove',event => {
      if (!fine.matches || !w || !h) return;
      const bounds = frame.getBoundingClientRect();
      pointer.set((event.clientX-bounds.left)/w*2-1, 1-(event.clientY-bounds.top)/h*2);
      ray.setFromCamera(pointer,camera);
      hoverAt(ray.intersectObjects(hits,false)[0]?.object.userData.index ?? -1);
    });
    listen(frame,'pointerleave',() => hoverAt(-1));

    function resize() {
      const nw = frame.clientWidth, nh = frame.clientHeight;
      const nd = Math.min(devicePixelRatio || 1, 2);
      if (nw === w && nh === h && nd === dpr) return;
      w = nw;
      h = nh;
      dpr = nd;
      if (!w || !h) return;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w,h,false);
      phone = w/h < .9 || w < 580;
      labelWidth = 0;
      rows.forEach(({tag,word},i) => {
        word.textContent = phone ? ['Answer','Book','Quotes','Invoices','Reviews','Web'][i] : names[i];
        tag.style.fontSize = (phone ? 12 : 14)+'px';
        labelWidth = Math.max(labelWidth,tag.offsetWidth);
      });
      wake();
    }

    const bounds = new Float64Array(4);
    function include(x,y,z) {
      // Camera-space axes for 45° azimuth and 30° elevation.
      const u = (x-z)*Math.SQRT1_2, t = y*.8660254038-(x+z)*.3535533906;
      bounds[0] = Math.min(bounds[0],u);
      bounds[1] = Math.max(bounds[1],u);
      bounds[2] = Math.min(bounds[2],t);
      bounds[3] = Math.max(bounds[3],t);
    }

    function leader(line,x,y,xx,yy,opacity) {
      const dx = xx-x, dy = yy-y;
      line.style.width = Math.hypot(dx,dy)+'px';
      line.style.transform = 'translate('+x+'px,'+y+'px) rotate('+Math.atan2(dy,dx)+'rad)';
      line.style.opacity = opacity;
    }

    function draw(now) {
      raf = 0;
      if (dead || lost || !visible || document.hidden || !w || !h) return;

      const dt = previous ? Math.min(.05,(now-previous)/1000) : 1/60;
      previous = now;
      const goal = reduce.matches ? .7 : progress;
      const error = p-goal, k = velocity+40*error, decay = Math.exp(-40*dt);
      p = goal+(error+k*dt)*decay;
      velocity = (velocity-40*k*dt)*decay;
      if (reduce.matches || (Math.abs(p-goal)<.00008 && Math.abs(velocity)<.004)) {
        p = goal;
        velocity = 0;
      }

      const index = active >= 0 ? active : hover;
      if (index !== chosen) {
        from.set(weights);
        chosen = index;
        changed = now;
      }
      const select = reduce.matches ? 1 : ease(now,changed,changed+250);
      const show = ease(p,.42,.52)*(1-ease(p,.8,.94));
      const hold = ease(p,.59,.62)*(1-ease(p,.80,.84));
      let sum = 0;
      for (let i = 0; i < 6; i++) {
        weights[i] = from[i]+((i === chosen ? 1 : 0)-from[i])*select;
        sum += weights[i];
      }

      let lift = 0;
      bounds.set([Infinity,-Infinity,Infinity,-Infinity]);
      for (let i = 5; i >= 0; i--) {
        if (i < 5) {
          const open = ease(p,.24+(4-i)*.022,.525+(4-i)*.02375);
          const close = ease(p,.80+i*.013,.888+i*.013);
          lift += 46*open**(1+.035*i)*(1-close);
        }
        const group = plates[i], fraction = i === 5 ? 0 : lift/(46*(5-i));
        group.position.set((5-i)*1.3*fraction,(5-i)*35.5+lift+6*weights[i]*hold,0);
        group.rotation.y = (5-i)*Math.PI/300*fraction;

        const amount = active < 0 ? weights[i] : weights[i]*hold;
        edges[i].color.copy(silver).lerp(signal,amount);
        edges[i].emissive.copy(signal);
        edges[i].emissiveIntensity = .68*amount;
        const gain = 1-.55*(sum-weights[i])*hold;
        gains[i].forEach(material => material.userData.gain.value = gain);

        group.updateMatrixWorld(true);
        for (const x of [-140,140]) for (const y of [-18,17.5]) for (const z of [-140,140]) {
          point.set(x,y,z).applyMatrix4(group.matrixWorld);
          include(point.x,point.y,point.z);
        }
        anchors[i].set(138,10,-136).applyMatrix4(group.matrixWorld);
      }

      screws.forEach((screw,i) => {
        const rise = ease(p,.06+i*.009,.213+i*.009)*(1-ease(p,.94+i*.003,.991+i*.003));
        screw.position.y = 15.25+70*rise;
        screw.rotation.y = i*.31+4*Math.PI*(1-(1-rise)**2);
        point.copy(screw.position).applyMatrix4(lid.matrixWorld);
        include(point.x-6,point.y+3,point.z+6);
        include(point.x+6,point.y+3,point.z-6);
        include(point.x-6,point.y+3,point.z-6);
      });
      for (const [x,y,z] of cablePoints) include(x+3,y-3,z-3);

      const pad = .08*w, right = w-pad, labelX = right-labelWidth;
      const end = phone ? labelX-14 : Math.min(w*.60,labelX-22);
      const zoneRight = right+(end-right)*show, zoneLeft = pad;
      const scale = Math.min(
        Math.max(1,zoneRight-zoneLeft)/(bounds[1]-bounds[0]),
        h*.70/(bounds[3]-bounds[2])
      );
      const centerX = (zoneLeft+zoneRight)/2;
      const midU = (bounds[0]+bounds[1])/2, midT = (bounds[2]+bounds[3])/2;
      camera.left = midU-centerX/scale;
      camera.right = camera.left+w/scale;
      camera.top = midT+h/(2*scale);
      camera.bottom = midT-h/(2*scale);
      camera.updateProjectionMatrix();

      // Independent horizontal starts meet a common rail. The fan-out preserves order.
      let rail = -Infinity;
      for (const anchor of anchors) {
        anchor.project(camera);
        anchor.x = (anchor.x+1)*w/2;
        anchor.y = (1-anchor.y)*h/2;
        rail = Math.max(rail,anchor.x);
      }
      rail += 2;
      const gap = Math.min(h*.145,Math.max(phone ? 21 : 26,(anchors[5].y-anchors[0].y)/5));
      const start = clamp((anchors[0].y+anchors[5].y-5*gap)/2,h*.08,h*.92-5*gap);
      const opacity = show*ease(labelX-rail,3,10);

      rows.forEach(({tag,lines},i) => {
        const y = start+i*gap, anchor = anchors[i];
        const alpha = opacity*(1-.55*(sum-weights[i])*hold);
        tag.style.transform = 'translate('+labelX+'px,'+y+'px) translateY(-50%)';
        tag.style.opacity = alpha;
        tag.style.visibility = alpha > .001 ? 'visible' : 'hidden';
        leader(lines[0],anchor.x,anchor.y,rail,anchor.y,alpha);
        leader(lines[1],rail,anchor.y,labelX-5,y,alpha);
      });

      if (!reduce.matches) clock += lastTick ? Math.min(100,now-lastTick) : 0;
      lastTick = now;
      const phase = reduce.matches ? 0 : clock*.001;
      const sweep = Math.sin(phase*2*Math.PI/7);
      key.position.set(-3+.7*sweep,6,4+.35*sweep);
      ringMaterial.emissiveIntensity = .9+.1*Math.sin(phase*Math.PI/2);

      renderer.render(scene,camera);
      if (p !== goal || velocity !== 0 || select < 1) wake();
      else if (!reduce.matches) timer = setTimeout(wake,1000/30);
    }

    session.wake = wake;
    function visibility() {
      stop();
      previous = lastTick = 0;
      wake();
    }

    listen(document,'visibilitychange',visibility);
    listen(reduce,'change',wake);
    listen(window,'resize',resize);
    listen(canvas,'webglcontextlost',event => {
      event.preventDefault();
      lost = true;
      stop();
      frame.style.visibility = 'hidden';
    });
    listen(canvas,'webglcontextrestored',() => {
      if (!dead) mount(el);
    });

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    releases.push(() => ro.disconnect());
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visibility();
    });
    io.observe(el);
    releases.push(() => io.disconnect());
    resize();
  }

  build().catch(() => {
    if (dead) return;
    dispose();
    const fallback = document.createElement('div');
    fallback.style.cssText = 'width:100%;height:100%;background:#111113';
    el.append(fallback);
    session = {wake() {}, dispose() { fallback.remove(); }};
  });
}

window.CinderUnit = {
  mount,
  setProgress(p) {
    if (Number.isFinite(p) && clamp(p) !== progress) {
      progress = clamp(p);
      session?.wake();
    }
  },
  setActive(i) {
    if (Number.isInteger(i) && i >= -1 && i < 6 && i !== active) {
      active = i;
      session?.wake();
    }
  },
  destroy
};
window.dispatchEvent(new Event('cinder-unit'));
