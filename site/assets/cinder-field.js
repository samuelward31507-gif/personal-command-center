// Orthographic backdrop reliefs. A single low-resolution 2D surface avoids
// allocating another WebGL context alongside each foreground instrument.
const instances=new Map();
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const families=['rotor','tiles','fins','gear','perforated','rails','honeycomb','grooves'];
const pages={'/answering':'diaphragm','/booking':'tiles','/follow-up':'belt','/reviews':'lathe',
  '/websites':'louvers','/free-audit':'iris','/software':'fins'};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function hash(value){
  let h=2166136261;
  for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);
  return (h>>>0)/4294967296;
}
function mount(el,{variant=0,seed='',calm=.88,intensity=1}={}){
  instances.get(el)?.destroy();
  const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{alpha:false});
  canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none';
  canvas.setAttribute('aria-hidden','true');el.append(canvas);
  const variation=hash(seed),page=location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
  const originalVariant=variant;
  let visible=false,raf=0,timer=0,last=0,time=0;
  function polygon(points,fill){
    c.fillStyle=fill;c.beginPath();c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)c.lineTo(...points[i]);
    c.closePath();c.fill();
  }
  function arc(r,a,b,width,stroke){
    c.beginPath();c.strokeStyle=stroke;c.lineWidth=width;c.arc(0,0,r,a,b);c.stroke();
  }
  function alloy(n){const v=Math.round(clamp(n*1.2,0,110));return 'rgb('+v+','+v+','+(v+1)+')'}
  function relief(family,phase){
    const turn=phase+variation*4,light=i=>.5+.5*Math.cos(i-turn*.7);
    if(family==='diaphragm'){
      c.scale(1,.7);const excursion=.035*Math.sin(turn);
      for(let i=0;i<12;i++){
        const radius=.28+i*.053+excursion*(1-i/12);
        arc(radius,0,Math.PI*2,.037,alloy(27+19*light(i*.42)));
        arc(radius+.018,-1.9+turn*.12,.72+turn*.12,.006,alloy(79));
      }
      arc(.23,0,2*Math.PI,.08,alloy(45));
      for(let i=0;i<4;i++)arc(.94,i*Math.PI/2,i*Math.PI/2+.16,.013,'#891421');
    }else if(family==='iris'){
      c.scale(1,.74);arc(.91,0,2*Math.PI,.14,alloy(39));
      for(let i=0;i<12;i++){
        c.save();c.rotate(i*Math.PI/6);const jaw=.38+.09*Math.sin(turn);
        polygon([[jaw,0],[.82,-.18],[.85,.12],[jaw+.06,.20]],alloy(28+44*light(i*.52)));
        polygon([[jaw,0],[.82,-.18],[.82,-.17],[jaw,.012]],alloy(76));c.restore();
      }
    }else if(family==='rotor'||family==='lathe'){
      c.scale(1,.64);c.rotate(-.23);
      for(let i=0;i<4;i++)arc(1-i*.059,0,2*Math.PI,.036,alloy(30+i*7));
      if(family==='rotor'){
        const blades=32+Math.floor(variation*8);
        for(let i=0;i<blades;i++){
          c.save();const a=i*2*Math.PI/blades+turn*.18;c.rotate(a);
          polygon([[.23,-.05],[.78,-.15],[.81,-.046],[.26,.044]],alloy(22+63*light(a)));
          polygon([[.23,-.05],[.78,-.15],[.78,-.14],[.24,-.035]],alloy(75+31*light(a)));
          c.restore();
        }
        arc(.20,0,2*Math.PI,.14,alloy(43));arc(.255,0,2*Math.PI,.007,alloy(95));
      }else{
        for(let i=0;i<19;i++){
          const r=.16+i*.032;arc(r,0,2*Math.PI,.014,alloy(20+22*light(i*.15)));
          arc(r,turn*.24+i*.06,turn*.24+i*.06+.82,.008,alloy(64));
        }
      }
      for(let i=0;i<36;i++){const a=i*Math.PI/18;arc(.945,a,a+.033,.013,i%9===0?'#94202a':'#3a3a40')}
    }else if(family==='fins'||family==='louvers'||family==='rails'){
      c.transform(1,.12,-.24,.72,0,0);
      const rail=family==='rails',louver=family==='louvers';
      const count=rail?12:34,pitch=2.2/count,shift=turn*(rail?.045:.025);
      for(let i=-2;i<count+2;i++){
        const x=-1.1+i*pitch+(shift%pitch+pitch)%pitch;
        const h=rail?1.85:2.05,w=pitch*(rail?.52:.79);
        const skew=(louver?.13:.035)*Math.sin(turn*.18+i*.05);
        polygon([[x,-h/2],[x+w,-h/2+skew],[x+w,h/2+skew],[x,h/2]],alloy(22+46*light(i*.18)));
        polygon([[x+w,-h/2+skew],[x+w+.025,-h/2+.035+skew],[x+w+.025,h/2+.035],[x+w,h/2+skew]],'#111113');
        polygon([[x,-h/2],[x+w,-h/2+skew],[x+w,-h/2+skew+.008],[x,-h/2+.008]],alloy(68+30*light(i*.11)));
      }
    }else if(family==='gear'){
      c.scale(1,.72);c.rotate(turn*.035);
      for(let i=0;i<48;i++){
        const a=i*tau/48,inner=.72,outer=i%2===0?1.04:.94;
        polygon([[Math.cos(a)*inner,Math.sin(a)*inner],[Math.cos(a+.045)*inner,Math.sin(a+.045)*inner],
          [Math.cos(a+.045)*outer,Math.sin(a+.045)*outer],[Math.cos(a)*outer,Math.sin(a)*outer]],
          alloy(27+48*light(i*.13)));
      }
      for(let i=0;i<6;i++)arc(.16+i*.105,0,tau,.018,alloy(24+27*light(i*.3)));
      arc(.13,0,tau,.075,alloy(54));
    }else if(family==='perforated'){
      c.transform(1,.08,-.16,.72,0,0);
      for(let row=-12;row<=12;row++)for(let col=-16;col<=16;col++){
        const x=col*.065+(row%2)*.0325,y=row*.073;
        c.fillStyle=alloy(23+43*light(col*.17+row*.11));
        c.beginPath();c.ellipse(x,y,.022,.029,0,0,tau);c.fill();
        c.strokeStyle='#111113';c.lineWidth=.009;c.stroke();
      }
    }else if(family==='honeycomb'){
      c.transform(1,.08,-.14,.72,0,0);
      const r=.058,dx=r*1.72,dy=r*1.5;
      for(let row=-13;row<=13;row++)for(let col=-17;col<=17;col++){
        const x=col*dx+(row%2)*dx/2,y=row*dy;
        c.beginPath();for(let k=0;k<6;k++){const a=k*tau/6;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
          if(k===0)c.moveTo(px,py);else c.lineTo(px,py)}
        c.closePath();c.lineWidth=.014;c.strokeStyle=alloy(22+43*light(col*.14+row*.17));c.stroke();
        c.fillStyle='#09090b';c.fill();
      }
    }else if(family==='grooves'||family==='lathe'){
      c.scale(1,.68);
      for(let i=0;i<30;i++){
        const r=.10+i*.032;
        arc(r,0,tau,.012,alloy(22+28*light(i*.18)));
        arc(r+.009,turn*.035+i*.02,turn*.035+i*.02+.65,.006,alloy(62+28*light(i*.13)));
      }
      arc(.075,0,tau,.035,alloy(48));
    }else{
      // Milled grid tiles: each tile has a dark seam, bevel and a moving edge.
      c.transform(1,.16,-.28,.70,0,0);
      const n=9,pitch=2/n,shift=turn*.025;
      for(let i=-2;i<n+2;i++){
        const x=-1+i*pitch+(shift%pitch+pitch)%pitch;
        for(let j=-2;j<n+2;j++){
          const y=-1+j*pitch,w=pitch*.84,h=pitch*.84,skew=.025*Math.sin(turn*.2+i*.06);
          polygon([[x,y],[x+w,y+skew],[x+w,y+h],[x,y+h-skew]],alloy(24+38*light(i*.17+j*.25)));
          polygon([[x+w,y+skew],[x+w+.018,y+.036+skew],[x+w+.018,y+h+.036],[x+w,y+h]],'#111113');
          polygon([[x,y],[x+w,y+skew],[x+w,y+skew+.007],[x,y+.007]],alloy(64+30*light(i*.1)));
          c.fillStyle='#0b0b0c';c.beginPath();c.arc(x+w*.18,y+.037,.009,0,tau);c.fill();
        }
      }
    }
  }
  function render(now){
    raf=0;if(!visible||document.hidden)return;
    const b=el.getBoundingClientRect();
    if(!b.width||!b.height)return;
    const ratio=Math.min(1,1152/b.width,1152/b.height);
    const w=Math.max(1,Math.round(b.width*ratio)),h=Math.max(1,Math.round(b.height*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    if(last&&!reduced.matches)time+=Math.min(.15,(now-last)/1000);
    last=now;
    const track=el.closest('[data-backdrop]')?.getBoundingClientRect()||b;
    const scroll=(innerHeight*.5-track.top)/Math.max(track.height,1);
    const phase=scroll*2.8+(reduced.matches?0:time*.30);
    c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(0,0,w,h);
    const family=pages[page]&&variant===originalVariant&&seed.toString().endsWith('#0')?pages[page]:families[variant];
    const radius=Math.min(w*.55,h*.91)*(1+variation*.12);
    for(const side of [-1,1]){
      c.save();c.translate(w*(side<0?-.06:1.03),h*(side<0?.36:.73));
      c.scale(radius*side,radius);c.rotate((variation-.5)*.61+.09*variant);
      relief(family,phase*(side<0?1:-.7));c.restore();
    }
    const shade=c.createLinearGradient(0,0,w,0);
    const edge=1-clamp(intensity,0,1)*.80,center=Math.max(edge,.52+.42*clamp(calm,0,1));
    for(const [at,a] of [[0,edge],[.38,center],[.62,center],[1,edge]])shade.addColorStop(at,'rgba(0,0,0,'+a+')');
    c.fillStyle=shade;c.fillRect(0,0,w,h);
    if(!reduced.matches)timer=setTimeout(wake,42);
  }
  function wake(){clearTimeout(timer);if(visible&&!document.hidden&&!raf)raf=requestAnimationFrame(render)}
  function pause(){cancelAnimationFrame(raf);clearTimeout(timer);raf=last=0;wake()}
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;pause()});
  const ro=new ResizeObserver(wake);ro.observe(el);io.observe(el);
  const abort=new AbortController(),opt={passive:true,signal:abort.signal};
  window.addEventListener('scroll',wake,opt);document.addEventListener('visibilitychange',pause,opt);
  reduced.addEventListener('change',wake,opt);
  const api={setVariant(n){if(Number.isInteger(n)&&families[n]){variant=n;wake()}},
    destroy(){visible=false;pause();abort.abort();io.disconnect();ro.disconnect();canvas.remove();instances.delete(el)}};
  instances.set(el,api);return api;
}
window.CinderField={mount,setVariant(n){instances.forEach(i=>i.setVariant(n))},destroy(){instances.forEach(i=>i.destroy())}};
window.dispatchEvent(new Event('cinder-field'));
window.dispatchEvent(new Event('cinder-visual'));
