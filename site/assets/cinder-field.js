// Orthographic backdrop reliefs. A single low-resolution 2D surface avoids
// allocating another WebGL context alongside each foreground instrument.
const instances=new Map();
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const families=['rotor','fins','tiles','lathe','belt','louvers'];
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
  function alloy(n){const v=Math.round(clamp(n,0,110));return 'rgb('+v+','+v+','+(v+1)+')'}
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
    }else{
      c.transform(1,.19,-.36,.66,0,0);
      const tile=family==='tiles',belt=family==='belt',louver=family==='louvers';
      const shift=turn*(belt?.12:.035);
      const n=tile?9:25,pitch=2/n;
      for(let i=-2;i<n+2;i++){
        const x=-1+i*pitch+(shift%pitch+pitch)%pitch;
        const count=tile?7:belt?3:1;
        for(let j=0;j<count;j++){
          const y=-1+j*2/count,w=pitch*(belt?.73:.84),h=2/count*.95;
          const bevel=.012,skew=louver?.16*Math.sin(turn*.23+i*.06):.035;
          polygon([[x,y],[x+w,y+skew],[x+w,y+h],[x,y+h-skew]],alloy(19+32*light(i*.17+j*.25)));
          polygon([[x+w,y+skew],[x+w+bevel,y+.036+skew],[x+w+bevel,y+h+.036],[x+w,y+h]],'#111113');
          polygon([[x,y],[x+w,y+skew],[x+w,y+skew+.007],[x,y+.007]],alloy(62+40*light(i*.1)));
          if((i+2*j)%8===0){
            c.fillStyle='#891421';c.fillRect(x+w*.15,y+h*.83,w*.58,.008);
          }
          if(tile||belt){c.fillStyle='#0b0b0c';c.beginPath();c.arc(x+w*.18,y+.037,.009,0,Math.PI*2);c.fill()}
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
