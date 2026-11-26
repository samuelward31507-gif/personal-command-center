// Machined objects, one per page, in the same studio as the six-layer unit: rect lights with matching reflection
// cards, brushed alloy with grain, enamel, hard shadows, a floor reflection, crimson only where something is live.
// Each is a global with mount(host) and setStep(i). They turn slowly on their own and react to the scroll step.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';

const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,c01=v=>v<0?0:v>1?1:v,ez=x=>{x=c01(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
const RED=new T.Color(0xff1f3a),DARK=new T.Color(0x1a1a1d),WHITE=new T.Color(0xf2f1ee),TAU=Math.PI*2;
const rb=(w,h,d,r=4)=>new RoundedBoxGeometry(w,h,d,3,r),box=(w,h,d)=>new T.BoxGeometry(w,h,d),cyl=(r,h,s=64,r2)=>new T.CylinderGeometry(r,r2==null?r:r2,h,s);
const add=(g,geo,m,x=0,y=0,z=0,sh=true)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=sh;o.receiveShadow=true;g.add(o);return o};
const lit=(m,a,b,k)=>m.color.copy(a).lerp(b,c01(k));
// a slotted screw, for the corners of machined bases
const screw=(g,K,x,y,z,a=.6)=>{add(g,cyl(6.5,3,24),K.graphite,x,y,z,false);const s=add(g,box(10,1.2,1.8),K.enamel,x,y+1.2,z,false);s.rotation.y=a};

function make(def){
  let prog=0,kick=()=>{},now=0;
  return {setActive(){},setProgress(v){prog=v<0?0:v>1?1:v;kick()},mount(host){
    const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%;opacity:0;transition:opacity 1s cubic-bezier(.2,.8,.2,1)';canvas.setAttribute('aria-hidden','true');
    if(getComputedStyle(host).position==='static')host.style.position='relative';host.append(canvas);
    const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info'),gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'';
    const lightTier=!/[?&]ao=1/.test(location.search)&&(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches||/swiftshader|llvmpipe|mali|adreno|intel.*(uhd|hd graphics)/i.test(gpu)||(navigator.deviceMemory||8)<=4);
    renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,3600);camera.position.set(1000,816.49658,1000);camera.lookAt(0,def.aim||20,0);
    RectAreaLightUniformsLib.init();
    const studio=new T.Scene();studio.background=new T.Color(0);const aim=new T.Vector3(0,60,0);
    for(const [x,y,z,w,h,i] of [[-230,560,-115,620,490,4.1],[-375,-140,360,310,680,2.65],[350,-100,-345,145,650,2.05]]){
      const p=new T.RectAreaLight(0xf2f1ee,i,w,h);p.position.set(x,y,z).add(aim);p.lookAt(aim);scene.add(p);
      const m=new T.MeshBasicMaterial({color:0xf2f1ee});m.color.multiplyScalar(i);const c=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),m);c.position.set(x*.01,y*.01,z*.01);c.quaternion.copy(p.quaternion);c.rotateY(Math.PI);studio.add(c)}
    const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(studio,.015).texture;pm.dispose();
    const key=new T.DirectionalLight(0xf2f1ee,1.9);key.castShadow=true;key.position.set(-385,820,350);key.target.position.copy(aim);scene.add(key,key.target);
    key.shadow.mapSize.setScalar(2048);key.shadow.bias=-.0001;key.shadow.normalBias=.12;Object.assign(key.shadow.camera,{left:-520,right:520,top:520,bottom:-520,near:100,far:2200});
    const texture=(w,h,paint,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'));const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t};
    const grain=texture(128,128,c=>{const d=c.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const v=Math.sin(y*91.713)*.8+Math.sin((y+1)*(y+11)*1.379+x*.01)*.2;d.data.set([128,128+v*8,253,255],4*(128*y+x))}c.putImageData(d,0,0)});
    grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);
    const rough=texture(128,128,c=>{const d=c.createImageData(128,128);for(let i=0;i<16384;i++){const x=i%128,y=i>>7,v=243+3*Math.sin(y*y*1.71+x*.016)+2*Math.sin(x*.079+y*.19);d.data.set([v,v,v,255],i*4)}c.putImageData(d,0,0)});
    rough.wrapS=rough.wrapT=T.RepeatWrapping;rough.repeat.set(3,3);
    const mat=(color,roughness=.36,extra={})=>new T.MeshPhysicalMaterial({color,metalness:.9,roughness,roughnessMap:rough,...extra});
    const K={texture,led:c=>new T.MeshBasicMaterial({color:c==null?0x1a1a1d:c,toneMapped:false}),
      body:mat(0x77767c,.32,{anisotropy:.4,clearcoat:.12,clearcoatRoughness:.34,normalMap:grain,normalScale:new T.Vector2(.12,.18)}),
      alloy:mat(0xffffff,.36,{metalness:.88,normalMap:grain,normalScale:new T.Vector2(.08,.12)}),
      graphite:mat(0x2a2a2f,.4),enamel:mat(0x0c0c0e,.22,{metalness:.2,clearcoat:1,clearcoatRoughness:.06})};
    const M=def.mats(K),copies=[def.build(K,M),def.build(K,M)],rig=new T.Group();scene.add(rig);
    rig.add(copies[0].g);copies[1].g.scale.y=-1;copies[1].g.position.y=-2;rig.add(copies[1].g);
    // the floor: a dark mirror that is clearest right under the object and falls off to black
    const fall=texture(256,256,c=>{const g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'#c4c4c4');g.addColorStop(.55,'#e6e6e6');g.addColorStop(1,'#fff');c.fillStyle=g;c.fillRect(0,0,256,256)});
    const floor=new T.Mesh(new T.PlaneGeometry(1700,1700),new T.MeshBasicMaterial({color:0,transparent:true,alphaMap:fall,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.renderOrder=2;scene.add(floor);
    let composer=null;if(!lightTier){try{composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4}));composer.addPass(new RenderPass(scene,camera));
      const ao=new GTAOPass(scene,camera,1,1,undefined,{radius:3.4,thickness:2.2,samples:8,scale:.85},{radius:2,samples:4,rings:1});ao.blendIntensity=.5;composer.addPass(ao);composer.addPass(new OutputPass());composer.addPass(new SMAAPass(1,1))}catch(e){composer=null}}
    let W=1,H=1,raf=0,vis=false,s=0,yaw=def.yaw[0],last=performance.now(),born=0;const t0=last;
    function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(W,H,false);if(composer){composer.setPixelRatio(Math.min(devicePixelRatio||1,2));composer.setSize(W,H)}
      const a=W/H,hh=Math.max(def.fit[1],def.fit[0]/a);camera.left=-hh*a;camera.right=hh*a;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();kick()}
    function frame(n){raf=0;const dt=Math.min(.05,(n-last)/1000);last=n;now=RM?12:Math.max(0,(n-t0)/1000);
      s+=(prog-s)*(RM?1:Math.min(1,dt*9));{const yf=s*(def.yaw.length-1),yi=Math.min(def.yaw.length-2,Math.floor(yf));yaw=lerp(def.yaw[yi],def.yaw[yi+1],ez(yf-yi))}
      if(!born&&vis){born=now||.001;canvas.style.opacity=1}const e=RM?1:ez((now-born)/1.3);
      rig.rotation.y=Math.PI/4+yaw+(RM?0:.06*Math.sin(now*.4))-(1-e)*.5;rig.scale.setScalar(lerp(.93,1,e));
      def.update({t:now,p:s,copies,M});composer?composer.render():renderer.render(scene,camera);if(vis&&!RM)raf=requestAnimationFrame(frame)}
    kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};
    new ResizeObserver(size).observe(host);new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis){last=performance.now();kick()}}).observe(host);size();
  }}}

// ---- Homepage, the audit: a machined sheet. A gantry walks the rows, the costs rank themselves, three get picked.
const COST=[1,.45,.35,.8,.25,.6],ORDER=[0,3,5,1,2,4],PICK=[0,3,5],ROWS=['CALLS','FORMS','ESTIMATES','QUOTES','INVOICES','REVIEWS'];
window.CinderSheet=make({fit:[280,235],yaw:[.34,.2,.08,.26],aim:10,
  mats:K=>({row:ROWS.map(()=>K.led()),chk:ROWS.map(()=>K.led()),head:K.led(0xff1f3a),scan:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={bars:[]};add(g,rb(390,16,540,10),K.body,0,8,0);
    const tex=K.texture(680,960,c=>{c.fillStyle='#0b0b0d';c.fillRect(0,0,680,960);c.fillStyle='rgba(242,241,238,.9)';c.font='500 30px "Geist Mono",monospace';c.fillText('AUDIT',40,74);c.fillStyle='rgba(242,241,238,.3)';c.fillRect(40,104,600,2);
      c.font='500 22px "Geist Mono",monospace';ROWS.forEach((l,i)=>{c.fillStyle='rgba(242,241,238,.6)';c.fillText(l,118,196+i*128);c.fillStyle='rgba(242,241,238,.12)';c.fillRect(40,256+i*128,600,2)})},true);
    const p=add(g,new T.PlaneGeometry(340,480),new T.MeshPhysicalMaterial({map:tex,metalness:.2,roughness:.24,clearcoat:1,clearcoatRoughness:.06}),0,16.3,0,false);p.rotation.x=-Math.PI/2;
    ROWS.forEach((l,i)=>{const z=-134+i*64;add(g,rb(28,7,28,2),K.alloy,-140,19.5,z);add(g,box(15,3,15),M.chk[i],-140,23.6,z,false);
      add(g,box(150,3,12),K.graphite,60,17.6,z+8);const b=add(g,box(146,3.4,8),M.row[i],60,19.4,z+8,false);b.userData.x0=-13;r.bars[i]=b});
    add(g,box(10,3,10),M.head,150,18,-208,false);[[-182,-256],[182,-256],[-182,256],[182,256]].forEach((q,i)=>screw(g,K,q[0],16.4,q[1],i));
    const gan=new T.Group();add(gan,box(12,30,14),K.alloy,-203,31,0);add(gan,box(12,30,14),K.alloy,203,31,0);add(gan,rb(430,12,18,3),K.alloy,0,50,0);add(gan,box(380,2,5),M.scan,0,42.6,0,false);g.add(gan);r.gan=gan;return {g,r}},
  update({t,p,copies,M}){const s=p*3,gz=lerp(-222,232,ez((s-.35)/1.25));
    lit(M.head,DARK,RED,s<.35?(Math.sin(t*5)>0?1:.25):0);lit(M.scan,DARK,RED,s>.35&&s<1.6?1:0);
    ROWS.forEach((l,i)=>{const z=-134+i*64,seen=gz>z-6,rank=ORDER.indexOf(i),pk=PICK.indexOf(i),pick=pk<0?0:ez((s-2.3)*3-pk*.5),dim=pk<0?ez((s-2.3)*2):0;
      lit(M.row[i],DARK,WHITE,seen?1-.82*dim:0);lit(M.chk[i],DARK,RED,pick);
      const k=seen?lerp(.3,COST[i],ez((s-1.5)*2.4-rank*.22)):.04;copies.forEach(c=>{const b=c.r.bars[i];b.scale.x=k;b.position.x=b.userData.x0+73*k})});
    copies.forEach(c=>{c.r.gan.position.z=gz})}});

// ---- Answering: a switchboard. A line lights, the reply runs through the core and out.
const PORTZ=[-108,-36,36,108];
window.CinderRelay=make({fit:[300,215],yaw:[.55,.36,.2,.46],aim:18,
  mats:K=>({port:PORTZ.map(()=>K.led()),core:K.led(),out:K.led(),bead:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={};add(g,rb(540,20,350,12),K.body,0,10,0);add(g,box(500,2,310),K.enamel,0,20.6,0,false);
    add(g,cyl(74,28,96,80),K.alloy,40,34,0);add(g,cyl(56,3,96),K.enamel,40,49.5,0,false);const ring=add(g,new T.TorusGeometry(40,3.2,12,96),M.core,40,51.5,0,false);ring.rotation.x=Math.PI/2;add(g,cyl(14,10,48),K.alloy,40,54,0);
    PORTZ.forEach((z,i)=>{add(g,rb(64,24,46,4),K.graphite,-204,32,z);add(g,box(8,3,30),M.port[i],-204,45.4,z,false);const len=Math.hypot(142,z),b=add(g,box(len,3,6),K.alloy,-101,22.6,z/2);b.rotation.y=Math.atan2(z,142)});
    add(g,box(96,3,6),K.alloy,160,22.6,0);add(g,rb(74,24,64,4),K.alloy,236,32,0);add(g,box(40,3,40),M.out,236,45.4,0,false);
    [[-256,-160],[256,-160],[-256,160],[256,160]].forEach((q,i)=>screw(g,K,q[0],20.6,q[1],i*.8));r.bead=add(g,box(12,6,12),M.bead,0,27,0,false);return {g,r}},
  update({t,p,copies,M}){const z=PORTZ[1];PORTZ.forEach((q,i)=>lit(M.port[i],DARK,RED,i===1&&p<.42?(p<.2?(Math.sin(t*14)>0?1:.35):1):0));
    lit(M.core,DARK,WHITE,.12+.88*c01(1-Math.abs(p-.56)*5));lit(M.out,DARK,WHITE,(p-.8)*8);
    let x=-204,zz=z,v=0;if(p>.2&&p<=.55){const k=ez((p-.2)/.35);x=lerp(-172,-30,k);zz=lerp(z,0,k);v=1}else if(p>.55&&p<.82){const k=ez((p-.55)/.27);x=lerp(112,200,k);zz=0;v=1}
    copies.forEach(c=>{c.r.bead.position.set(x,27,zz);c.r.bead.visible=!!v})}});

// ---- Booking: a block of slots. Booked ones stand up, the next one drops in.
const SLOT=[7,2,13,16,9,4,18,11,0,14];
window.CinderBlock=make({fit:[312,246],yaw:[.5,.3,.62,.4],aim:16,
  mats:K=>({on:K.led(0xf2f1ee),off:K.led(),now:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={tiles:[],studs:[],hi:K.alloy,lo:K.graphite};add(g,rb(490,18,420,10),K.body,0,9,0);add(g,box(456,2,386),K.enamel,0,18.6,0,false);
    for(let d=0;d<5;d++)for(let q=0;q<4;q++){const x=-176+88*d,z=-138+92*q,t=add(g,rb(72,14,76,3),K.alloy,x,27,z);r.tiles.push(t);r.studs.push(add(t,box(32,3,8),M.off,0,8.6,22,false))}[[-234,-198],[234,-198],[-234,198],[234,198]].forEach((q,i)=>screw(g,K,q[0],18.6,q[1],i*.7));return {g,r}},
  update({t,p,copies,M}){const q=p*8.6;M.now.color.copy(RED).multiplyScalar(.75+.25*Math.sin(t*6));
    copies.forEach(c=>c.r.tiles.forEach((tile,i)=>{const k=SLOT.indexOf(i),a=k<0||k>8?0:c01(q-k),cur=a>0&&a<1;tile.position.y=27+12*ez(a);c.r.studs[i].material=cur?M.now:a>=1?M.on:M.off;tile.material=a>0?c.r.hi:c.r.lo}))}});

// ---- Follow-up: a rail. The carriage works its way down the stops until the quote is answered.
const STOP=[-250,-90,70,230];
window.CinderTrack=make({fit:[345,185],yaw:[.6,.44,.3,.2],aim:14,
  mats:K=>({stop:STOP.map(()=>K.led()),car:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={flags:[]};add(g,rb(640,14,96,6),K.body,0,7,0);add(g,box(600,2,18),K.enamel,0,14.6,10,false);
    for(let i=0;i<25;i++)add(g,box(2,2,i%6?8:16),K.alloy,-288+i*24,15,36,false);
    STOP.forEach((x,i)=>{add(g,cyl(13,30,48),K.alloy,x,29,-24);add(g,cyl(9,3,32),M.stop[i],x,45.4,-24,false);const f=new T.Group();f.position.set(x+22,15,-24);add(f,box(4,34,24),K.alloy,0,17,0);g.add(f);r.flags.push(f)});
    const car=new T.Group();add(car,rb(50,22,40,4),K.alloy,0,26,10);add(car,box(30,3,8),M.car,0,38.4,10,false);g.add(car);r.car=car;[[-308,-36],[308,-36]].forEach((q,i)=>screw(g,K,q[0],14.6,q[1],i));return {g,r}},
  update({t,p,copies,M}){const x=lerp(-300,STOP[3],ez(p));STOP.forEach((q,i)=>{const d=x-q;lit(M.stop[i],DARK,Math.abs(d)<24?RED:WHITE,d>-24?1:0)});M.car.color.copy(RED).multiplyScalar(.75+.25*Math.sin(t*4));
    copies.forEach(c=>{c.r.car.position.x=x;c.r.flags.forEach((f,i)=>{f.rotation.z=-Math.PI/2*(1-ez((x-STOP[i]+30)/50))})})}});

// ---- Reviews: a polished star on a plinth. The asks light up one by one.
window.CinderMedal=make({fit:[235,210],yaw:[.2,-.3,.4,0],aim:40,
  mats:K=>({tip:[0,1,2,3,4].map(()=>K.led())}),
  build(K,M){const g=new T.Group(),r={};add(g,cyl(196,24,128,210),K.body,0,12,0);add(g,cyl(176,2,128),K.enamel,0,24.6,0,false);
    const sh=new T.Shape();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?56:138;i?sh.lineTo(Math.cos(a)*q,Math.sin(a)*q):sh.moveTo(Math.cos(a)*q,Math.sin(a)*q)}sh.closePath();
    const geo=new T.ExtrudeGeometry(sh,{depth:22,bevelEnabled:true,bevelThickness:5,bevelSize:5,bevelSegments:4});geo.translate(0,0,-11);
    const hold=new T.Group();hold.position.y=58;const star=add(hold,geo,new T.MeshPhysicalMaterial({color:0xffffff,metalness:.95,roughness:.16,clearcoat:.4,clearcoatRoughness:.2}),0,0,0);star.rotation.x=-Math.PI/2;g.add(hold);r.hold=hold;
    for(let i=0;i<5;i++){const a=i/5*TAU;add(g,cyl(11,6,32),K.alloy,Math.sin(a)*158,27,-Math.cos(a)*158);add(g,cyl(7,2,24),M.tip[i],Math.sin(a)*158,31,-Math.cos(a)*158,false);screw(g,K,Math.sin(a+.63)*184,24.8,-Math.cos(a+.63)*184,a)}return {g,r}},
  update({t,p,copies,M}){M.tip.forEach((m,i)=>{const a=p*5.4-i;lit(m,DARK,a<1?RED:WHITE,a)});
    copies.forEach(c=>{c.r.hold.rotation.y=p*TAU*.8+.12*Math.sin(t*.6);c.r.hold.position.y=40+44*ez(p*1.4)})}});

// ---- Websites: a page that comes apart into the pieces that turn a visitor into a lead.
window.CinderFrame=make({fit:[270,275],yaw:[.6,.3,.5,.2],aim:50,
  mats:K=>({btn:K.led(0xff1f3a),dot:K.led(0xf2f1ee)}),
  build(K,M){const g=new T.Group(),r={parts:[]};add(g,rb(320,12,440,10),K.body,0,6,0);add(g,box(292,2,412),K.enamel,0,12.6,0,false);
    const P=(x,z,build)=>{const p=new T.Group();p.position.set(x,14,z);build(p);g.add(p);r.parts.push(p)};
    P(0,-176,p=>{add(p,rb(280,8,36,3),K.alloy,0,4,0);add(p,box(8,2,8),M.dot,-122,9,0,false);for(let i=0;i<3;i++)add(p,box(26,2,6),K.graphite,60+i*36,9,0,false)});
    P(0,-76,p=>{add(p,rb(280,10,140,4),K.graphite,0,5,0);add(p,box(200,3,12),K.alloy,-28,11.5,-30);add(p,box(140,3,8),K.alloy,-58,11.5,-6);add(p,box(64,3,18),M.dot,-96,11.5,30,false)});
    P(-78,96,p=>{add(p,rb(124,10,180,4),K.enamel,0,5,0);for(let i=0;i<2;i++)add(p,rb(100,6,74,3),K.graphite,0,13,-44+i*88)});
    P(78,96,p=>{add(p,rb(124,12,180,4),K.alloy,0,6,0);for(let i=0;i<3;i++)add(p,box(100,3,22),K.graphite,0,13.5,-58+i*36);add(p,box(100,4,26),M.btn,0,14,62,false)});[[-148,-208],[148,-208],[-148,208],[148,208]].forEach((q,i)=>screw(g,K,q[0],12.6,q[1],i));return {g,r}},
  update({t,p,copies,M}){const e=6+44*Math.sin(Math.PI*c01(p));M.btn.color.copy(RED).multiplyScalar(.7+.3*Math.sin(t*4));
    copies.forEach(c=>c.r.parts.forEach((q,i)=>{q.position.y=14+e*[.6,1.2,1.8,2.4][i]}))}});

// ---- Homepage, what you get back: the working day as an instrument.
const GYAW=[.5,-.35,-1.25,.1],hr=h=>(h-12)/24*TAU,hp=(h,r,y)=>new T.Vector3(Math.sin(hr(h))*r,y,-Math.cos(hr(h))*r);
function arc(r0,r1,hgt,h0,h1,m,y){const sh=new T.Shape(),a=Math.PI/2-hr(h0),b=Math.PI/2-hr(h1);sh.absarc(0,0,r1,a,b,true);sh.absarc(0,0,r0,b,a,false);
  const o=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:hgt,bevelEnabled:true,bevelThickness:.8,bevelSize:.8,bevelSegments:2,curveSegments:96}),m);o.rotation.x=-Math.PI/2;o.position.y=y;o.castShadow=o.receiveShadow=true;return o}
window.CinderGauge=make({fit:[320,222],yaw:GYAW,aim:20,
  mats:K=>({extra:[K.led(0xff1f3a),K.led(0xff1f3a)],phone:K.led(0xff1f3a),eve:K.led(),cap:K.led(),tip:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={extras:[]},R=300;
    const shell=add(g,new T.LatheGeometry([[0,0],[R,0],[R+8,8],[R+8,38],[R+2,46],[R-22,46],[R-28,40],[0,40]].map(p=>new T.Vector2(p[0],p[1])),160),K.body);
    const tex=K.texture(1024,1024,c=>{c.fillStyle='#0b0b0d';c.fillRect(0,0,1024,1024);c.translate(512,512);for(let i=0;i<96;i++){c.save();c.rotate(i/96*TAU);c.fillStyle='rgba(242,241,238,'+(i%4?.22:.5)+')';c.fillRect(-1,-470,2,i%4?12:22);c.restore()}
      c.strokeStyle='rgba(242,241,238,.12)';c.lineWidth=2;[150,300,392].forEach(q=>{c.beginPath();c.arc(0,0,q,0,TAU);c.stroke()})},true);
    const face=add(g,new T.CircleGeometry(R-28,160),new T.MeshPhysicalMaterial({map:tex,metalness:.2,roughness:.24,clearcoat:1,clearcoatRoughness:.06}),0,40.2,0,false);face.rotation.x=-Math.PI/2;
    for(let h=0;h<24;h++){const big=h%6===0,b=add(g,box(big?7:4,big?7:4,big?34:18),K.alloy,0,0,0);b.position.copy(hp(h,R-52,40+(big?3.5:2)));b.rotation.y=-hr(h)}
    g.add(arc(206,226,9,7,17,K.alloy,40));[8,10,13,15].forEach(h=>{const b=add(g,box(16,8,16),K.graphite,0,0,0);b.position.copy(hp(h,216,53));b.rotation.y=-hr(h)});
    [11.5,16.2].forEach((h,i)=>{const b=add(g,box(16,8,16),M.extra[i],0,0,0,false);b.position.copy(hp(h,216,53));b.rotation.y=-hr(h);b.userData.i=i;r.extras.push(b)});
    [[12,12.8],[17,21]].forEach(q=>{g.add(arc(150,170,5,q[0],q[1],K.graphite,40));const l=arc(156,164,2,q[0]+.08,q[1]-.08,M.phone,45.2);l.castShadow=false;g.add(l)});
    g.add(arc(206,226,5,17.25,22,K.graphite,40));const ev=arc(211,221,2,17.4,21.85,M.eve,45.2);ev.castShadow=false;g.add(ev);
    add(g,cyl(30,18,64,34),K.alloy,0,49,0);add(g,cyl(15,3,48),M.cap,0,59.5,0,false);
    const hand=new T.Group();hand.position.y=62;add(hand,box(5,4,150),K.alloy,0,0,-70);add(hand,box(5,4.4,34),M.tip,0,0,-162,false);g.add(hand);r.hand=hand;
    for(let i=0;i<6;i++)screw(g,K,Math.sin(i/6*TAU+.26)*(R-10),46.6,Math.cos(i/6*TAU+.26)*(R-10),i);return {g,r}},
  update({t,p,copies,M}){const s=p*3;lit(M.phone,DARK,RED,c01(1-s*1.2)*(.78+.22*Math.sin(t*5)));lit(M.eve,DARK,WHITE,s-1);lit(M.cap,DARK,WHITE,s-2);
    copies.forEach(c=>{c.r.hand.rotation.y=-((t*.22)%TAU);c.r.extras.forEach(b=>{const i=b.userData.i;b.scale.setScalar(.2+.8*c01((t-.8-i*.5)*2));b.material.color.copy(RED).multiplyScalar(.65+.35*Math.sin(t*3+i))})})}});

// ---- Free audit: a lens walks six checkpoints and flags the ones that leak.
const CHK=[[-150,-80],[0,-80],[150,-80],[-150,80],[0,80],[150,80]],BAD=[0,3,5];
window.CinderProbe=make({fit:[300,220],yaw:[.5,.3,.6,.4],aim:24,
  mats:K=>({s:CHK.map(()=>K.led()),lens:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={};add(g,rb(480,16,360,10),K.body,0,8,0);add(g,box(446,2,326),K.enamel,0,16.6,0,false);
    CHK.forEach((q,i)=>{add(g,cyl(26,14,64,30),K.alloy,q[0],24,q[1]);add(g,cyl(15,2,48),M.s[i],q[0],32,q[1],false)});
    [[-224,-164],[224,-164],[-224,164],[224,164]].forEach((q,i)=>screw(g,K,q[0],16.6,q[1],i));
    const arm=new T.Group();const ring=add(arm,new T.TorusGeometry(40,5,16,96),K.alloy,0,74,0);ring.rotation.x=Math.PI/2;const lr=add(arm,new T.TorusGeometry(32,1.6,8,96),M.lens,0,71,0,false);lr.rotation.x=Math.PI/2;
    add(arm,box(8,8,150),K.alloy,0,74,-115);add(arm,cyl(9,60,32),K.graphite,0,46,-190);g.add(arm);r.arm=arm;return {g,r}},
  update({t,p,copies,M}){const q=c01(p)*5,i0=Math.min(4,Math.floor(q)),k=ez(q-i0),a=CHK[i0],b=CHK[i0+1],x=lerp(a[0],b[0],k),z=lerp(a[1],b[1],k);
    CHK.forEach((c2,i)=>lit(M.s[i],DARK,BAD.includes(i)?RED:WHITE,(q-i+.25)*4));M.lens.color.copy(RED).multiplyScalar(.6+.4*Math.sin(t*6));copies.forEach(c=>c.r.arm.position.set(x,0,z))}});

// ---- About: a short rack. A few bays, each one watched.
window.CinderRack=make({fit:[300,210],yaw:[.5,.35,.6,.42],aim:36,
  mats:K=>({on:[0,1,2].map(()=>K.led(0xf2f1ee)),open:K.led()}),
  build(K,M){const g=new T.Group(),r={c:[]};add(g,rb(540,18,220,10),K.body,0,9,0);add(g,box(506,2,186),K.enamel,0,18.6,0,false);
    for(let i=0;i<5;i++){const x=-208+i*104;add(g,rb(88,10,160,3),K.graphite,x,24,0);if(i<3){const c=new T.Group();c.position.set(x,29,0);add(c,rb(72,62,136,5),K.alloy,0,31,0);add(c,box(40,3,8),M.on[i],0,63.4,50,false);add(c,box(72,2,2),K.graphite,0,40,68.4,false);g.add(c);r.c.push(c)}else add(g,box(40,3,8),i===3?M.open:K.graphite,x,30,50,false)}
    [[-254,-94],[254,-94],[-254,94],[254,94]].forEach((q,i)=>screw(g,K,q[0],18.6,q[1],i));return {g,r}},
  update({t,p,copies,M}){M.on.forEach((m,i)=>lit(m,DARK,WHITE,c01((p*3.4-i-.8)*4)*(.7+.3*Math.sin(t*2+i*2))));lit(M.open,DARK,RED,p>.85?.5+.5*Math.sin(t*4):0);
    copies.forEach(c=>c.r.c.forEach((q,i)=>{q.position.y=29+150*(1-ez(p*3.4-i))}))}});

// ---- Trades: a fence run, built along a measured line.
window.CinderRun=make({fit:[350,235],yaw:[.6,.45,.7,.5],aim:70,
  mats:K=>({laser:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={p:[]};add(g,rb(640,14,150,6),K.body,0,7,0);add(g,box(600,2,116),K.enamel,0,14.6,0,false);
    for(let i=0;i<7;i++){const x=-270+i*90;add(g,box(16,156,16),K.alloy,x,93,-20);const cap=add(g,new T.ConeGeometry(13,12,4),K.alloy,x,177,-20);cap.rotation.y=Math.PI/4}
    [56,128].forEach(y=>add(g,box(556,10,8),K.graphite,0,y,-27));
    for(let i=0;i<24;i++){const x=-258.75+i*22.5;if(Math.abs(((x+270)/90)%1)<.02)continue;const pk=add(g,box(12,132,5),K.alloy,x,84,-14);r.p.push(pk)}
    for(let i=0;i<25;i++)add(g,box(2,2,i%4?8:16),K.alloy,-270+i*22.5,15.4,44,false);r.laser=add(g,box(540,2.4,3),M.laser,0,16,30,false);return {g,r}},
  update({t,p,copies,M}){const f=c01(p*1.05);M.laser.color.copy(RED).multiplyScalar(.75+.25*Math.sin(t*5));
    copies.forEach(c=>{c.r.p.forEach((pk,i)=>{const k=ez(f*(c.r.p.length+3)-i);pk.scale.y=Math.max(.02,k);pk.position.y=18+66*k;pk.visible=k>.02});c.r.laser.scale.x=Math.max(.01,f);c.r.laser.position.x=-270+270*f})}});

// ---- Integrations: a dock. Your tools plug in around one core.
window.CinderDock=make({fit:[332,258],yaw:[.3,.5,.2,.6],aim:22,
  mats:K=>({core:K.led(),p:[0,1,2,3,4,5,6,7].map(()=>K.led()),bead:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={b:[]};add(g,cyl(300,14,128,306),K.body,0,7,0);add(g,cyl(284,2,128),K.enamel,0,14.6,0,false);
    add(g,cyl(78,40,96,86),K.alloy,0,34,0);add(g,cyl(60,3,96),K.enamel,0,55.5,0,false);const ring=add(g,new T.TorusGeometry(44,3.4,12,96),M.core,0,57.6,0,false);ring.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i/8*TAU+.39,x=Math.sin(a)*212,z=Math.cos(a)*212,m=add(g,rb(76,28,52,4),i%2?K.graphite:K.alloy,x,29,z);m.rotation.y=a+Math.PI/2;const l=add(g,box(8,3,26),M.p[i],x,44.4,z,false);l.rotation.y=a+Math.PI/2;
      const cab=add(g,box(96,4,6),K.alloy,Math.sin(a)*128,17,Math.cos(a)*128);cab.rotation.y=a-Math.PI/2;const bd=add(g,box(10,5,8),M.bead,0,21,0,false);bd.userData={a,i};r.b.push(bd)}
    for(let i=0;i<6;i++)screw(g,K,Math.sin(i/6*TAU)*290,14.8,Math.cos(i/6*TAU)*290,i);return {g,r}},
  update({t,p,copies,M}){lit(M.core,DARK,WHITE,p*(.6+.4*Math.sin(t*2.4)));M.p.forEach((m,i)=>lit(m,DARK,WHITE,p*9-i));
    copies.forEach(c=>c.r.b.forEach(bd=>{const {a,i}=bd.userData,q=(t*.45+i*.37)%1,inb=i%2===0,rad=inb?lerp(176,84,q):lerp(84,176,q);bd.visible=p*9-i>1;bd.position.set(Math.sin(a)*rad,21,Math.cos(a)*rad);bd.rotation.y=a}))}});

// ---- What's new: releases, stacked. The newest lands on top.
window.CinderShip=make({fit:[270,275],yaw:[.5,.3,.65],aim:80,
  mats:K=>({edge:K.led(0xff1f3a),old:K.led(0xf2f1ee)}),
  build(K,M){const g=new T.Group(),r={pl:[]};add(g,rb(360,14,360,10),K.body,0,7,0);
    for(let i=0;i<8;i++){const p=new T.Group();p.position.y=22+i*20;add(p,rb(300-i*4,12,300-i*4,6),i%2?K.graphite:K.alloy,0,0,0);const e=add(p,box(120,3,3),M.old,0,0,(300-i*4)/2+.6,false);p.userData.e=e;g.add(p);r.pl.push(p)}return {g,r}},
  update({t,p,copies,M}){const q=1+c01(p)*6.99,n=Math.floor(q),f=q-n;M.edge.color.copy(RED).multiplyScalar(.7+.3*Math.sin(t*5));
    copies.forEach(c=>c.r.pl.forEach((pl,i)=>{pl.visible=i<=n;const top=i===n,k=top?ez(f*1.5):1;pl.position.y=22+i*20+90*(1-k);pl.scale.setScalar(.7+.3*k);pl.userData.e.material=top?M.edge:M.old}))}});

dispatchEvent(new Event('cinder-visual'));dispatchEvent(new Event('cinder-plate'));
