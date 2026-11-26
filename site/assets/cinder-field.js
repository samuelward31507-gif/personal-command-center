// Orthographic backdrop reliefs. A single low-resolution 2D surface avoids
// allocating another WebGL context alongside each foreground instrument.
const instances=new Map();
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const families=['rotor','tiles','fins','gear','perforated','rails','honeycomb','grooves'];
const pages={'/answering':'diaphragm','/booking':'rails','/follow-up':'belt','/reviews':'lathe',
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
    const tau=Math.PI*2;
    if(family==='rotor'){
      c.scale(1,.64);c.rotate(-.23);
      for(let i=0;i<4;i++)arc(1-i*.059,0,tau,.036,alloy(30+i*7));
      const blades=32+Math.floor(variation*8);
      for(let i=0;i<blades;i++){
        c.save();const a=i*tau/blades+turn*.18;c.rotate(a);
        polygon([[.23,-.05],[.78,-.15],[.81,-.046],[.26,.044]],alloy(22+63*light(a)));
        polygon([[.23,-.05],[.78,-.15],[.78,-.14],[.24,-.035]],alloy(75+31*light(a)));
        c.restore();
      }
      arc(.20,0,tau,.14,alloy(43));arc(.255,0,tau,.007,alloy(95));
      for(let i=0;i<36;i++){const a=i*tau/36;arc(.945,a,a+.033,.013,i%9===0?'#94202a':'#3a3a40')}
    }else if(family==='tiles'){
      c.transform(1,.22,-.35,.68,0,0);
      const pitch=.22,shift=(turn*.035%pitch+pitch)%pitch;
      for(let i=-7;i<8;i++)for(let j=-6;j<7;j++){
        const x=i*pitch+shift,y=j*pitch,w=pitch*.88,h=pitch*.88;
        polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],alloy(24+30*light(i*.18+j*.14)));
        polygon([[x,y],[x+w,y],[x+w,y+.012],[x,y+.012]],alloy(65+36*light(i*.2)));
        c.fillStyle='#111113';c.beginPath();c.arc(x+.035,y+.035,.012,0,tau);c.fill();
      }
    }else if(family==='fins'){
      c.rotate(-.13);
      for(let i=-20;i<=20;i++){
        const y=i*.052+turn*.014,w=2.35;
        polygon([[-1.25,y],[1.12,y-.025],[1.12,y+.025],[-1.25,y+.052]],alloy(22+38*light(i*.17)));
        polygon([[-1.25,y],[1.12,y-.025],[1.12,y-.012],[-1.25,y+.014]],alloy(70+40*light(i*.16)));
        polygon([[1.12,y-.025],[1.17,y+.002],[1.17,y+.046],[1.12,y+.025]],'#111113');
      }
    }else if(family==='gear'){
      c.scale(1,.7);c.rotate(turn*.035);
      for(let i=0;i<48;i++){
        c.save();c.rotate(i*tau/48);
        polygon([[.72,-.035],[.94,-.048],[.98,0],[.94,.048],[.72,.035]],alloy(28+50*light(i*.23)));
        polygon([[.72,-.035],[.94,-.048],[.94,-.036],[.72,-.023]],alloy(83));
        c.restore();
      }
      arc(.72,0,tau,.035,alloy(75));arc(.61,0,tau,.018,alloy(35));
      for(let i=0;i<8;i++){c.save();c.rotate(i*tau/8);polygon([[.18,-.04],[.61,-.065],[.61,.065],[.18,.04]],alloy(25+38*light(i*.5)));c.restore()}
      arc(.18,0,tau,.07,alloy(60));arc(.105,0,tau,.018,alloy(95));
    }else if(family==='perforated'){
      c.transform(1,.08,-.18,.9,0,0);
      const pitch=.105,shift=(turn*.012%pitch+pitch)%pitch;
      for(let x=-1.1;x<1.15;x+=pitch)for(let y=-1.1;y<1.15;y+=pitch){
        const px=x+shift,py=y;
        c.fillStyle=alloy(22+22*light(px*4+py*3));c.fillRect(px,py,pitch*.82,pitch*.82);
        c.fillStyle='#080809';c.beginPath();c.arc(px+pitch*.41,py+pitch*.41,pitch*.22,0,tau);c.fill();
        arc(pitch*.22,0,tau,.004,alloy(55+20*light(px+py)));
      }
      for(let i=-1;i<=1;i++)arc(.9,i*.55-.18,i*.55+.18,.012,alloy(75));
    }else if(family==='rails'){
      c.rotate(-.17);
      for(let i=-10;i<=10;i++){
        const x=i*.105+turn*.012,y=-1.2,w=.062,h=2.45;
        polygon([[x,y],[x+w,y+.02],[x+w+.04,y+h],[x+.04,y+h]],alloy(26+34*light(i*.24)));
        polygon([[x,y],[x+w,y+.02],[x+w,y+.05],[x,y+.03]],alloy(82+38*light(i*.2)));
        polygon([[x+w,y+.02],[x+w+.04,y+.07],[x+w+.04,y+h],[x+w,y+h-.04]],'#111113');
        if(i%4===0){c.fillStyle='#09090b';c.beginPath();c.arc(x+w*.5,y+.18,.014,0,tau);c.fill()}
      }
    }else if(family==='honeycomb'){
      const pitch=.13,hex=(x,y,r,fill)=>{
        const pts=[];for(let k=0;k<6;k++){const a=k*tau/6+Math.PI/6;pts.push([x+r*Math.cos(a),y+r*Math.sin(a)])}polygon(pts,fill)
      };
      for(let x=-1.2;x<1.2;x+=pitch*1.5)for(let y=-1.2;y<1.2;y+=pitch*Math.sqrt(3)){
        const yy=y+((Math.round(x/(pitch*1.5))&1)?pitch*Math.sqrt(3)/2:0);
        hex(x,yy,pitch*.72,alloy(20+28*light(x*2+yy*3)));
        hex(x,yy,pitch*.49,'#09090b');
        const a=Math.atan2(yy,x)-turn*.2;arc(pitch*.62,a,a+.42,.006,alloy(64));
      }
    }else if(family==='grooves'){
      c.scale(1,.68);c.rotate(-.15);
      for(let i=0;i<30;i++){
        const r=.12+i*.031,bright=22+30*light(i*.18);
        arc(r,0,tau,.009,alloy(bright));
        arc(r+.012,0,tau,.004,alloy(70+42*light(i*.17)));
      }
      arc(.08,0,tau,.025,alloy(95));
    }else if(family==='diaphragm'){
      c.scale(1,.7);const excursion=.035*Math.sin(turn);
      for(let i=0;i<12;i++){
        const radius=.28+i*.053+excursion*(1-i/12);
        arc(radius,0,tau,.037,alloy(27+19*light(i*.42)));
        arc(radius+.018,-1.9+turn*.12,.72+turn*.12,.006,alloy(79));
      }
      arc(.23,0,tau,.08,alloy(45));
      for(let i=0;i<4;i++)arc(.94,i*Math.PI/2,i*Math.PI/2+.16,.013,'#891421');
    }else if(family==='iris'){
      c.scale(1,.74);arc(.91,0,tau,.14,alloy(39));
      for(let i=0;i<12;i++){
        c.save();c.rotate(i*Math.PI/6);const jaw=.38+.09*Math.sin(turn);
        polygon([[jaw,0],[.82,-.18],[.85,.12],[jaw+.06,.20]],alloy(28+44*light(i*.52)));
        polygon([[jaw,0],[.82,-.18],[.82,-.17],[jaw,.012]],alloy(76));c.restore();
      }
    }else if(family==='lathe'){
      c.scale(1,.64);
      for(let i=0;i<19;i++){
        const r=.16+i*.032;arc(r,0,tau,.014,alloy(20+22*light(i*.15)));
        arc(r,turn*.24+i*.06,turn*.24+i*.06+.82,.008,alloy(64));
      }
    }else if(family==='belt'){
      c.transform(1,.19,-.36,.66,0,0);
      for(let lane=0;lane<4;lane++){
        const y=-.7+lane*.46,shift=(turn*.08% .24+.24)% .24;
        for(let i=-8;i<9;i++){
          const x=i*.24+shift;
          polygon([[x,y],[x+.19,y-.02],[x+.19,y+.20],[x,y+.22]],alloy(24+32*light(i*.2+lane)));
          polygon([[x,y],[x+.19,y-.02],[x+.19,y-.005],[x,y+.015]],alloy(76));
        }
      }
    }else if(family==='louvers'){
      c.rotate(-.12);
      for(let i=-16;i<=16;i++){
        const x=i*.065+turn*.01;
        polygon([[x,-1.2],[x+.035,-1.18],[x+.035,1.18],[x,1.2]],alloy(24+34*light(i*.2)));
        polygon([[x,-1.2],[x+.035,-1.18],[x+.035,-1.12],[x,-1.14]],alloy(75+38*light(i*.2)));
        polygon([[x+.035,-1.18],[x+.075,-1.13],[x+.075,1.2],[x+.035,1.18]],'#111113');
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
