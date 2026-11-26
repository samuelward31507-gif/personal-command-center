// Cinder Field — precision studio backdrops.
// A single 2D canvas keeps the backdrop inexpensive beside foreground WebGL scenes.
(() => {
  const instances = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = value => {
    let h = 2166136261;
    for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  };
  const families = ['edge-panel', 'optic', 'channels', 'bevel', 'reflection', 'prism'];

  function mount(el, { variant = 0, seed = '', calm = .88, intensity = 1 } = {}) {
    instances.get(el)?.destroy();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return { destroy() {} };
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    el.append(canvas);

    const salt = hash(seed);
    let visible = false, raf = 0, timer = 0, last = 0, elapsed = 0, scrollP = 0;
    let width = 0, height = 0, dpr = 1, dead = false;
    const interval = 1000 / 60;
    const family = () => families[((Math.floor(Number(variant) || 0) % families.length) + families.length) % families.length];
    const px = n => Math.round(n * dpr) / dpr;
    const stroke = (color, lineWidth = 1) => { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; };
    const line = (x1, y1, x2, y2, color, lineWidth = 1) => {
      stroke(color, lineWidth); ctx.beginPath(); ctx.moveTo(px(x1), px(y1)); ctx.lineTo(px(x2), px(y2)); ctx.stroke();
    };
    const poly = (points, fill) => {
      ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(px(points[0][0]), px(points[0][1]));
      for (let i = 1; i < points.length; i++) ctx.lineTo(px(points[i][0]), px(points[i][1]));
      ctx.closePath(); ctx.fill();
    };
    const arc = (x, y, r, a, b, color, lineWidth = 1) => {
      stroke(color, lineWidth); ctx.beginPath(); ctx.arc(x, y, r, a, b); ctx.stroke();
    };
    function drawEdgePanel(t, drift) {
      const side = salt > .5 ? 1 : -1, x = side > 0 ? width * 1.02 : -width * .02;
      const y = height * (.25 + (salt % .3));
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * (-.28 + salt * .14));
      const w = width * (.28 + salt * .06), h = height * 1.15;
      poly([[0,-h*.5],[side*w,-h*.42],[side*w,h*.42],[0,h*.5]], '#080809');
      line(0,-h*.5,side*w,-h*.42,'#202024',2);
      line(side*w,-h*.42,side*w,h*.42,'#111114',2);
      line(0,h*.5,side*w,h*.42,'#17171b',1);
      const sweep = ((t * .045 + drift + salt) % 1);
      const sy = -h*.36 + sweep*h*.72;
      line(0,sy,side*w,sy-side*w*.08,'#77767c',1.1);
      line(0,sy+2,side*w,sy-side*w*.08+2,'rgba(242,241,238,.16)',1);
      line(side*w*.82,-h*.38,side*w*.82,h*.38,'#2a2a2f',3);
      ctx.restore();
    }
    function drawOptic(t, drift) {
      const side = salt > .5 ? 1 : -1, cx = side > 0 ? width * 1.04 : -width * .04;
      const cy = height * (.18 + salt * .28), r = Math.min(width, height) * (.46 + salt * .06);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .86);
      arc(0,0,r,Math.PI*.56,Math.PI*1.48,'#252529',2);
      arc(0,0,r-5,Math.PI*.56,Math.PI*1.48,'#111114',1);
      arc(0,0,r*.83,Math.PI*.58,Math.PI*1.45,'#333338',1);
      arc(0,0,r*.72,Math.PI*.60,Math.PI*1.43,'#17171a',2);
      const a = Math.PI * (.75 + .38 * Math.sin(t*.045 + drift));
      const x = Math.cos(a)*r*.9, y = Math.sin(a)*r*.9;
      line(0,0,x,y,'#77767c',1);
      line(0,0,x*.72,y*.72,'rgba(242,241,238,.42)',1);
      line(x*.68,y*.68,x,y,'#d4142a',1);
      ctx.restore();
    }
    function drawChannels(t, drift) {
      const side = salt > .5 ? 1 : -1, start = side > 0 ? width * .74 : width * .26;
      const sign = side > 0 ? 1 : -1, y0 = height * (.14 + salt * .26);
      const span = width * .44, gap = Math.min(22, height*.035);
      for (let i = 0; i < 3; i++) {
        const y = y0 + i * gap, x1 = start, x2 = start + sign * span;
        line(x1,y,x1+sign*span*.28,y+sign*span*.035,'#1c1c1f',2);
        line(x1+sign*span*.28,y+sign*span*.035,x2,y+sign*span*.10,'#101012',2);
        line(x1,y-1,x1+sign*span*.28,y+sign*span*.035-1,'#39393e',1);
      }
      const phase = ((t * .12 + drift + salt) % 1);
      const x = start + sign * span * phase;
      const y = y0 + 2 * gap + sign * span * .10 * phase;
      line(x-sign*13,y-sign*1.3,x,y,'#d4142a',1.4);
      line(x,y,x+sign*9,y+sign*1.1,'#ff2a3a',1);
    }
    function drawBevel(t, drift) {
      const side = salt > .5 ? 1 : -1, x = side > 0 ? width * .91 : width * .09;
      const y = height * (.76 + salt * .08), w = width * .46, h = height * .3;
      const p = [[x,y-h],[x+side*w,y-h*.72],[x+side*w,y+h*.7],[x,y+h]];
      poly(p,'#080809');
      line(p[0][0],p[0][1],p[1][0],p[1][1],'#2a2a2f',3);
      line(p[1][0],p[1][1],p[2][0],p[2][1],'#17171a',2);
      line(p[2][0],p[2][1],p[3][0],p[3][1],'#111114',1);
      const q = ((t*.05 + drift + salt) % 1);
      const sx = p[0][0] + (p[1][0]-p[0][0])*q, sy = p[0][1] + (p[1][1]-p[0][1])*q;
      line(sx,sy,sx+side*width*.05,sy-height*.012,'#77767c',1.2);
      line(sx+side*width*.05,sy-height*.012,sx+side*width*.08,sy-height*.019,'rgba(242,241,238,.22)',1);
    }
    function drawReflection(t, drift) {
      const side = salt > .5 ? 1 : -1, x = side > 0 ? width * .98 : width * .02;
      const y = height * (.17 + salt * .35), w = width * .38, h = height * .84;
      poly([[x,y-h*.5],[x+side*w,y-h*.43],[x+side*w,y+h*.43],[x,y+h*.5]], '#070708');
      line(x,y-h*.5,x+side*w,y-h*.43,'#222226',2);
      line(x+side*w,y-h*.43,x+side*w,y+h*.43,'#161619',2);
      line(x,y+h*.5,x+side*w,y+h*.43,'#1b1b1f',1);
      const p = (t*.06 + drift + salt) % 1;
      const sx = x + side*w*p, sy = y-h*.35 + h*.7*p;
      line(sx,sy,sx+side*w*.08,sy-h*.025,'#77767c',1);
      line(sx+side*w*.08,sy-h*.025,sx+side*w*.14,sy-h*.04,'rgba(242,241,238,.28)',1);
    }
    function drawPrism(t, drift) {
      const side = salt > .5 ? 1 : -1, x = side > 0 ? width * .98 : width * .02;
      const y = height * (.58 + salt * .12), w = width * .32, h = height * .46;
      const a=[x,y-h*.5], b=[x+side*w,y-h*.18], c=[x+side*w*.82,y+h*.48], d=[x,y+h*.5];
      poly([a,b,c,d],'#080809');
      line(a[0],a[1],b[0],b[1],'#2a2a2f',2);
      line(b[0],b[1],c[0],c[1],'#1c1c1f',1);
      line(c[0],c[1],d[0],d[1],'#17171a',1);
      const p=(t*.055+drift+salt)%1, sx=a[0]+(b[0]-a[0])*p, sy=a[1]+(b[1]-a[1])*p;
      line(sx,sy,sx+side*w*.11,sy+h*.04,'#77767c',1);
      line(sx+side*w*.11,sy+h*.04,sx+side*w*.16,sy+h*.06,'#d4142a',1);
    }
    const draw = { 'edge-panel':drawEdgePanel, optic:drawOptic, channels:drawChannels, bevel:drawBevel, reflection:drawReflection, prism:drawPrism };

    function render(now) {
      raf=0;
      if (dead || !visible || document.hidden) return;
      if (last && !reduced.matches) elapsed += Math.min(.1,(now-last)/1000);
      last=now;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
      const drift = reduced.matches ? 0 : scrollP * .035;
      ctx.save();ctx.globalAlpha=clamp(intensity,0,1);draw[family()](elapsed,drift);ctx.restore();
      // Black center is reserved for copy; all precise light stays at the perimeter.
      const cx=width*.5, cy=height*.48, radius=Math.max(width*.38,height*.42);
      const protect=ctx.createRadialGradient(cx,cy,Math.min(width,height)*.12,cx,cy,radius);
      protect.addColorStop(0,'rgba(0,0,0,.995)');
      protect.addColorStop(.58,'rgba(0,0,0,.97)');
      protect.addColorStop(1,'rgba(0,0,0,.22)');
      ctx.fillStyle=protect;ctx.fillRect(0,0,width,height);
      if (!reduced.matches) timer=setTimeout(wake,interval);
    }
    function resize() {
      const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
      dpr=Math.min(2,window.devicePixelRatio||1);
      width=Math.max(1,Math.round(r.width*dpr));height=Math.max(1,Math.round(r.height*dpr));
      canvas.width=width;canvas.height=height;wake();
    }
    function wake() {clearTimeout(timer);if(!dead&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(render);}
    function pause() {cancelAnimationFrame(raf);clearTimeout(timer);raf=0;timer=0;last=0;if(visible&&!document.hidden)wake();}
    function updateScroll() {
      const sec=el.closest('[data-backdrop]')||el,r=sec.getBoundingClientRect();
      scrollP=clamp((innerHeight*.5-r.top)/Math.max(r.height,1),0,1);wake();
    }
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;pause();});
    io.observe(el);
    const ro=new ResizeObserver(resize);ro.observe(el);
    const abort=new AbortController(),opts={passive:true,signal:abort.signal};
    addEventListener('scroll',updateScroll,opts);addEventListener('resize',resize,opts);
    document.addEventListener('visibilitychange',pause,opts);reduced.addEventListener('change',wake,opts);
    canvas.addEventListener('contextlost',e=>{e.preventDefault();pause();});
    canvas.addEventListener('contextrestored',wake);
    resize();
    const api={
      setVariant(n){if(Number.isFinite(+n)){variant=+n;wake();}},
      destroy(){if(dead)return;dead=true;visible=false;cancelAnimationFrame(raf);clearTimeout(timer);abort.abort();io.disconnect();ro.disconnect();canvas.remove();instances.delete(el);}
    };
    instances.set(el,api);return api;
  }
  window.CinderField={mount,setVariant(n){instances.forEach(i=>i.setVariant(n));},destroy(){instances.forEach(i=>i.destroy());}};
  window.dispatchEvent(new Event('cinder-field'));
  window.dispatchEvent(new Event('cinder-visual'));
})();
