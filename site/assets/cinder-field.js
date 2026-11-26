// Cinder Field — glossy graphite edge-light backdrops.
// One lightweight 2D canvas per backdrop; compositions stay out of headline space.
(() => {
  const instances = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lite = matchMedia('(max-width: 700px)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = value => {
    let h = 2166136261;
    for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  };
  const layouts = [
    // Hero: broad opposing graphite pieces, the richest red reflections.
    [[-.10,.13,.72,.29,-.48,1],[1.08,.37,.72,.30,.42,1],[.02,1.02,.76,.27,-.36,.78],[1.03,.94,.54,.20,-.50,.72]],
    // Statement: left upper bevel and a heavy right-side glass bar.
    [[-.14,.24,.72,.27,.34,.78],[1.08,.58,.80,.30,-.40,.82],[.13,1.04,.62,.23,-.25,.64]],
    // App: high right slab, low left counterweight, long edge reflection.
    [[1.10,.12,.78,.28,.58,.76],[-.12,.65,.78,.30,-.35,.72],[.93,1.02,.58,.22,-.18,.58]],
    // Audit: forms enter from opposite lower corners.
    [[-.08,.48,.76,.29,-.55,.76],[1.10,.88,.80,.28,.42,.78],[.86,-.08,.58,.21,-.36,.58]],
    // Outcomes: deliberately quieter and smaller.
    [[-.12,.18,.62,.23,-.42,.42],[1.10,.72,.64,.24,.38,.44],[.04,1.05,.58,.19,-.25,.34]],
    // Closing: two upright edge forms with a low cross-sweep.
    [[-.14,.42,.68,.28,.56,.72],[1.12,.28,.72,.29,-.58,.78],[.52,1.08,.82,.22,-.14,.66]]
  ];
  const families = ['hero','statement','app','audit','outcomes','closing'];
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
    const selected = () => ((Math.floor(Number(variant)||0)%layouts.length)+layouts.length)%layouts.length;
    const px = n => Math.round(n*dpr)/dpr;
    function chamferPath(w,h,cut) {
      ctx.beginPath();
      ctx.moveTo(-w/2+cut,-h/2);ctx.lineTo(w/2-cut,-h/2);
      ctx.lineTo(w/2,-h/2+cut);ctx.lineTo(w/2,h/2-cut);
      ctx.lineTo(w/2-cut,h/2);ctx.lineTo(-w/2+cut,h/2);
      ctx.lineTo(-w/2,h/2-cut);ctx.lineTo(-w/2,-h/2+cut);
      ctx.closePath();
    }
    function edge(x1,y1,x2,y2,color,lw=1) {
      ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineCap='butt';ctx.beginPath();
      ctx.moveTo(px(x1),px(y1));ctx.lineTo(px(x2),px(y2));ctx.stroke();
    }
    function form(spec,index,t,drift,redLevel) {
      const [nx,ny,nw,nh,angle,weight]=spec;
      const w=width*nw,h=height*nh;
      const bob=Math.sin(t*.22+salt*6+index)*height*.006;
      ctx.save();
      ctx.translate(width*(nx+drift*(index%2?-.5:.5)),height*ny+bob);
      ctx.rotate(angle+Math.sin(t*.17+index+salt)*.018+scrollP*(index%2?-.018:.018));
      const cut=Math.min(w*.12,h*.24,24*dpr);
      chamferPath(w,h,cut);
      const body=ctx.createLinearGradient(-w*.12,-h*.5,w*.22,h*.5);
      body.addColorStop(0,'#252529');body.addColorStop(.16,'#17171b');
      body.addColorStop(.48,'#09090b');body.addColorStop(.78,'#1b1b20');
      body.addColorStop(1,'#050506');ctx.fillStyle=body;ctx.fill();
      // A saturated reflection is clipped to the machined face, never a surrounding glow.
      ctx.save();chamferPath(w,h,cut);ctx.clip();
      const sweep=(.5+.5*Math.sin(t*.16+salt*8+index*1.7));
      const lx=-w*.48+sweep*w*.96;
      const red=ctx.createLinearGradient(-w*.15,h*.08,w*.44,-h*.42);
      red.addColorStop(0,'rgba(70,3,12,0)');
      red.addColorStop(.28,'rgba(138,10,23,'+(redLevel*.28)+')');
      red.addColorStop(.58,'rgba(212,20,42,'+(redLevel*.52)+')');
      red.addColorStop(.76,'rgba(86,5,15,'+(redLevel*.22)+')');
      red.addColorStop(1,'rgba(18,2,5,0)');
      ctx.fillStyle=red;ctx.fillRect(-w/2,-h/2,w,h);
      // Dark glossy band, broad enough to read as a real smoked surface.
      const gloss=ctx.createLinearGradient(0,-h*.48,0,h*.18);
      gloss.addColorStop(0,'rgba(242,241,238,.16)');
      gloss.addColorStop(.14,'rgba(242,241,238,.055)');
      gloss.addColorStop(.32,'rgba(255,255,255,0)');
      gloss.addColorStop(1,'rgba(0,0,0,.38)');
      ctx.fillStyle=gloss;ctx.fillRect(-w/2,-h/2,w,h);
      // Narrow reflected crimson strip along one bevel.
      const redEdge=ctx.createLinearGradient(-w*.5,h*.38,w*.5,h*.08);
      redEdge.addColorStop(0,'rgba(138,10,23,0)');
      redEdge.addColorStop(.42,'rgba(212,20,42,'+(redLevel*.88)+')');
      redEdge.addColorStop(.7,'rgba(212,20,42,'+(redLevel*.42)+')');
      redEdge.addColorStop(1,'rgba(138,10,23,0)');
      ctx.fillStyle=redEdge;
      ctx.beginPath();ctx.moveTo(-w*.5,h*.28);ctx.lineTo(w*.5,h*.04);
      ctx.lineTo(w*.5,h*.13);ctx.lineTo(-w*.5,h*.37);ctx.closePath();ctx.fill();
      ctx.restore();
      // Beveled graphite edges and precise warm-white speculars.
      chamferPath(w,h,cut);ctx.strokeStyle='rgba(119,118,124,.78)';ctx.lineWidth=1.2;ctx.stroke();
      edge(-w/2+cut,-h/2,w/2-cut,-h/2,'rgba(242,241,238,.72)',1.25);
      edge(-w/2,-h/2+cut,-w/2,h/2-cut,'rgba(242,241,238,.22)',1);
      edge(-w/2+cut,h/2,w/2-cut,h/2,'rgba(119,118,124,.34)',1);
      // Moving highlight segment travels along the top chamfer, with a fine crimson echo.
      const p=(t*.055+salt*.71+index*.23)%1;
      const sx=-w*.43+p*w*.86, sy=-h*.5;
      const len=Math.max(24*dpr,w*.12);
      edge(sx-len*.5,sy,sx+len*.5,sy,'rgba(242,241,238,'+(.48+.22*Math.sin(t*.2+index))+')',1.65);
      edge(sx-len*.5,sy+2*dpr,sx+len*.5,sy+2*dpr,'rgba(212,20,42,'+(redLevel*.88)+')',1.15);
      // A narrow side face gives the slabs real thickness.
      ctx.fillStyle='#050506';ctx.beginPath();
      ctx.moveTo(w/2-cut,-h/2);ctx.lineTo(w/2,-h/2+cut);
      ctx.lineTo(w/2,h/2-cut);ctx.lineTo(w/2-cut,h/2);
      ctx.closePath();ctx.fill();
      edge(w/2-cut,-h/2,w/2,-h/2+cut,'#77767c',1);
      ctx.restore();
    }
    function render(now) {
      raf=0;if(dead||!visible||document.hidden)return;
      if(last&&!reduced.matches)elapsed+=Math.min(.08,(now-last)/1000);
      last=now;
      ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
      const v=selected(),drift=reduced.matches?0:scrollP*.022+Math.sin(elapsed*.12)*.012;
      const quiet=clamp(Number(calm)||0,0,1);
      const redLevel=(v===0?1.08:.78)*(1-quiet*.18)*clamp(Number(intensity)||0,0,1);
      const specs=layouts[v];
      ctx.save();ctx.globalAlpha=clamp(Number(intensity)||0,0,1);
      specs.slice(0,lite.matches?3:specs.length).forEach((s,i)=>form(s,i,reduced.matches?0:elapsed,drift,redLevel*(s[5]||1)));
      ctx.restore();
      if(!reduced.matches)timer=setTimeout(wake,interval);
    }
    function resize() {
      const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
      dpr=Math.min(lite.matches?1.5:2,window.devicePixelRatio||1);
      width=Math.max(1,Math.round(r.width*dpr));height=Math.max(1,Math.round(r.height*dpr));
      canvas.width=width;canvas.height=height;wake();
    }
    function wake(){clearTimeout(timer);if(!dead&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(render);}
    function pause(){cancelAnimationFrame(raf);clearTimeout(timer);raf=0;timer=0;last=0;if(visible&&!document.hidden)wake();}
    function updateScroll(){
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
