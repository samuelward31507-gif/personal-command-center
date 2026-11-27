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

const RM=false,c01=v=>v<0?0:v>1?1:v,ez=x=>{x=c01(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
const RED=new T.Color(0xff1f3a),DARK=new T.Color(0x1a1a1d),WHITE=new T.Color(0xf2f1ee),TAU=Math.PI*2;
const rb=(w,h,d,r=4)=>new RoundedBoxGeometry(w,h,d,3,r),box=(w,h,d)=>new T.BoxGeometry(w,h,d),cyl=(r,h,s=64,r2)=>new T.CylinderGeometry(r,r2==null?r:r2,h,s);
const add=(g,geo,m,x=0,y=0,z=0,sh=true)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=sh;o.receiveShadow=true;g.add(o);return o};
const lit=(m,a,b,k)=>m.color.copy(a).lerp(b,c01(k));
// a slotted screw, for the corners of machined bases
const screw=(g,K,x,y,z,a=.6)=>{add(g,cyl(6.5,3,24),K.graphite,x,y,z,false);const s=add(g,box(10,1.2,1.8),K.enamel,x,y+1.2,z,false);s.rotation.y=a};

function make(def){
  let prog=0,kick=()=>{},now=0;
  const api={setActive(){},setProgress(v){prog=v<0?0:v>1?1:v;kick()},mount(host){
    if(!host.__near&&'IntersectionObserver' in window){new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){o.disconnect();host.__near=1;api.mount(host)}},{rootMargin:'90% 0px'}).observe(host);return}
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
    const floor=new T.Mesh(new T.PlaneGeometry(1700,1700),new T.MeshBasicMaterial({color:0,transparent:true,alphaMap:fall,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.renderOrder=2;
    if(def.pool){floor.material.alphaMap=texture(256,256,c=>{const g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'#c4c4c4');g.addColorStop(.42,'#fff');g.addColorStop(.76,'#fff');g.addColorStop(.9,'#555');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(0,0,256,256)});
      const fg=new T.Group();fg.rotation.y=Math.PI/4;scene.add(fg);fg.add(floor);floor.position.z=def.pool[0];floor.scale.set(def.pool[1]/850,def.pool[2]/850,1)}else scene.add(floor);
    let composer=null;if(!lightTier){try{composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4}));composer.addPass(new RenderPass(scene,camera));
      const ao=new GTAOPass(scene,camera,1,1,undefined,{radius:3.4,thickness:2.2,samples:8,scale:.85},{radius:2,samples:4,rings:1});ao.blendIntensity=.5;composer.addPass(ao);composer.addPass(new OutputPass());composer.addPass(new SMAAPass(1,1))}catch(e){composer=null}}
    let W=1,H=1,raf=0,vis=false,s=0,yaw=def.yaw[0],last=performance.now(),born=0;const t0=last;
    function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(W,H,false);if(composer){composer.setPixelRatio(Math.min(devicePixelRatio||1,2));composer.setSize(W,H)}
      const a=W/H,hh=Math.max(def.fit[1],def.fit[0]/a);camera.left=-hh*a;camera.right=hh*a;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();kick()}
    function frame(n){raf=0;const dt=Math.min(.05,(n-last)/1000);last=n;now=RM?12:Math.max(0,(n-t0)/1000);
      s+=(prog-s)*(RM?1:Math.min(1,dt*9));{const yf=s*(def.yaw.length-1),yi=Math.min(def.yaw.length-2,Math.floor(yf));yaw=lerp(def.yaw[yi],def.yaw[yi+1],ez(yf-yi))}
      if(!born&&vis){born=now||.001;canvas.style.opacity=1}const e=RM?1:ez((now-born)/1.3);
      const E={yaw:-(1-e)*(def.swing==null?.5:def.swing),scale:lerp(.93,1,e),sx:0,lift:0};if(def.enter)def.enter(RM?1:c01((now-born)/(def.enterTime||1.3)),E);
      rig.rotation.y=Math.PI/4+yaw+(RM?0:(def.sway==null?.06:def.sway)*Math.sin(now*.4))+E.yaw;rig.scale.setScalar(E.scale);rig.position.set((E.sx+(E.sz||0))*.7071,0,((E.sz||0)-E.sx)*.7071);copies[0].g.position.y=E.lift;copies[1].g.position.y=-2-E.lift;
      def.update({t:now,p:s,copies,M});composer?composer.render():renderer.render(scene,camera);if(vis&&!RM)raf=requestAnimationFrame(frame)}
    kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};
    new ResizeObserver(size).observe(host);new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis){last=performance.now();kick()}}).observe(host);size();
  }};return api}

// ---- Homepage, the audit: a machined sheet. A gantry walks the rows, the costs rank themselves, three get picked.
const COST=[1,.45,.35,.8,.25,.6],ORDER=[0,3,5,1,2,4],PICK=[0,3,5],ROWS=['CALLS','FORMS','ESTIMATES','QUOTES','INVOICES','REVIEWS'];
window.CinderSheet=make({fit:[280,235],yaw:[.34,.2,.08,.26],aim:10,
  enterTime:1.7,enter(k,E){const o=1-Math.pow(1-k,4);E.sx=lerp(-460,0,o);E.yaw=lerp(-1.05,0,o);E.scale=1},
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
  // set down like a coin: it drops the last few inches still turning, then settles
  enterTime:2.2,enter(k,E){const o=1-Math.pow(1-k,3);E.yaw=(1-o)*(1-o)*5.6;E.lift=70*Math.pow(1-k,4);E.scale=1},
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

// ---- Homepage hero: the job log. A roll of paper feeds through a machined printer, down its face and out across
// the floor. Every ticket is a job that came from a lead the business already had. The tape is the picture.
const TK=[['Missed call, 7:42 PM','Estimate booked','Thursday, 9:00 AM'],['Quote sent 3 weeks ago','Quote signed','After the second follow-up'],['Website form, Sunday','Site visit booked','Monday, 8:30 AM'],
  ['Job finished Friday','5-star review','Asked the same day'],['Text, 9:14 PM','Estimate booked','Friday, 2:00 PM'],['Missed call, on a roof','Callback booked','Today, 4:30 PM']];
const TW=214,SL=Math.atan2(105,150),SD=[Math.cos(SL),-Math.sin(SL)],SN=[Math.sin(SL),Math.cos(SL)],ROLL=[-256,196,48];
// the tape's side profile as [z,y] samples with running length; zB is where it leaves the print bridge, zT the tear bar
const TAPE=(()=>{const P=[],to=(z,y)=>P.push([z,y]),line=(a,b,n)=>{for(let i=1;i<=n;i++)to(lerp(a[0],b[0],i/n),lerp(a[1],b[1],i/n))},
    bez=(a,b,c,d,n)=>{for(let i=1;i<=n;i++){const t=i/n,u=1-t;to(u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1])}};
  const G=[-196,134.6],dx=G[0]-ROLL[0],dy=G[1]-ROLL[1],al=Math.atan2(dy,dx)-Math.acos(ROLL[2]/Math.hypot(dx,dy)),T0=[ROLL[0]+ROLL[2]*Math.cos(al),ROLL[1]+ROLL[2]*Math.sin(al)];
  const S0=[-170+1.4*SN[0],132+1.4*SN[1]],S1=[-20+1.4*SN[0],27+1.4*SN[1]],F=[92,1.6],E=[452,1.6];
  to(T0[0],T0[1]);line(T0,G,14);bez(G,[G[0]+12,G[1]],[S0[0]-9*SD[0],S0[1]-9*SD[1]],[S0[0]+6*SD[0],S0[1]+6*SD[1]],10);line(P[P.length-1],S1,40);
  bez(S1,[S1[0]+46*SD[0],S1[1]+46*SD[1]],[F[0]-52,F[1]],F,26);
  const bump=u=>u<0||u>1?0:Math.pow(Math.sin(Math.PI*u),2);for(let i=1;i<=90;i++){const z=lerp(F[0],E[0],i/90);to(z,1.6+7*bump((z-128)/150)+4*bump((z-296)/128))}
  for(let i=1;i<=70;i++){const f=i/70*TAU*1.32,r=31-2.5*f;to(E[0]+r*Math.sin(f),1.6+31-r*Math.cos(f))}
  let s=0;const S=[0];for(let i=1;i<P.length;i++){s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);S[i]=s}
  const at=z=>{for(let i=1;i<P.length;i++)if(P[i][0]>=z)return i;return P.length-1};
  const iB=at(-176),iT=at(-33);return {P,S,iB,sT:S[iT],len:S[iT]-S[at(-170)]}})();
const TLEN=TAPE.len,LTEX=TLEN*TK.length;
function strip(i0,i1){const {P,S}=TAPE,n=i1-i0+1,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];
  for(let k=0;k<n;k++){const i=i0+k,z=P[i][0],y=P[i][1],v=(TAPE.sT-S[i])/LTEX;pos.set([-TW/2,y,z,TW/2,y,z],k*6);uv.set([0,v,1,v],k*4);if(k)idx.push(2*k-2,2*k,2*k-1,2*k-1,2*k,2*k+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g}
// a rounded outline in the side plane, extruded across the width, with its texture coordinates brought back to 0..1
function slab(pts,rad,width,bev){const sh=new T.Shape(),n=pts.length,q=(a,b,d)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return [a[0]+(b[0]-a[0])*d/l,a[1]+(b[1]-a[1])*d/l]};
  pts.forEach((p,i)=>{const a=pts[(i+n-1)%n],b=pts[(i+1)%n],r=rad[i],p0=q(p,a,r),p1=q(p,b,r);i?sh.lineTo(-p0[0],p0[1]):sh.moveTo(-p0[0],p0[1]);sh.quadraticCurveTo(-p[0],p[1],-p1[0],p1[1])});sh.closePath();
  const g=new T.ExtrudeGeometry(sh,{depth:width-2*bev,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelOffset:-bev,bevelSegments:4,curveSegments:10});g.translate(0,0,bev-width/2);g.rotateY(Math.PI/2);
  const u=g.attributes.uv;for(let i=0;i<u.count;i++)u.setXY(i,u.getX(i)/300,u.getY(i)/300);return g}
function paintTape(c,W,h){c.fillStyle='#efede6';c.fillRect(0,0,W,h*TK.length);c.textBaseline='alphabetic';
  (window.CinderTapeTickets||TK).forEach((t,k)=>{const y=k*h;c.fillStyle='rgba(12,12,14,.3)';for(let x=10;x<W-10;x+=20)c.fillRect(x,y-2,11,4);
    c.textAlign='left';c.fillStyle='#7a766e';c.font='500 29px "Geist Mono",ui-monospace,monospace';c.fillText(t[0],58,y+h*.27);
    let f=74;c.fillStyle='#0c0c0e';do{c.font='650 '+f+'px "Inter",system-ui,sans-serif';f-=2}while(c.measureText(t[1]).width>W-116&&f>40);c.fillText(t[1],56,y+h*.53);
    c.fillStyle='#c8102e';c.fillRect(58,y+h*.71-25,18,18);c.fillStyle='rgba(12,12,14,.82)';c.font='500 36px "Inter",system-ui,sans-serif';c.fillText(t[2],92,y+h*.71);
    c.fillStyle='#9d9990';c.font='500 21px "Geist Mono",ui-monospace,monospace';c.fillText('Cinder',58,y+h*.9);c.textAlign='right';c.fillText('Sample data',W-58,y+h*.9)})}
window.CinderTape=make({fit:[262,318],yaw:[-.16,-.16],aim:18,sway:.035,swing:.3,pool:[130,370,630],
  mats(K){const W=720,h=Math.round(W*TLEN/TW),tex=K.texture(W,h*TK.length,c=>paintTape(c,W,h),true);tex.wrapT=T.RepeatWrapping;
    if(document.fonts&&document.fonts.load)Promise.all([document.fonts.load('650 74px "Inter"'),document.fonts.load('500 29px "Geist Mono"')]).then(()=>{paintTape(tex.image.getContext('2d'),W,h);tex.needsUpdate=true}).catch(()=>{});
    const fib=K.texture(256,256,c=>{const d=c.createImageData(256,256);for(let i=0;i<65536;i++){const v=236+Math.random()*19;d.data.set([v,v,v,255],i*4)}c.putImageData(d,0,0)});fib.wrapS=fib.wrapT=T.RepeatWrapping;fib.repeat.set(2,14);
    return {tex,led:K.led(0xff1f3a),paper:new T.MeshStandardMaterial({map:tex,roughness:.92,roughnessMap:fib,metalness:0,color:0xdedbd4}),
      blank:new T.MeshStandardMaterial({roughness:.92,metalness:0,color:0xd2cfc8,side:T.DoubleSide}),back:new T.MeshStandardMaterial({roughness:.92,metalness:0,color:0xc4c1ba,side:T.BackSide}),
      rubber:new T.MeshStandardMaterial({color:0x0b0b0c,roughness:.62,metalness:0})}},
  build(K,M){const g=new T.Group(),r={},d=new T.Group();g.add(d);g.position.z=88;
    add(d,slab([[-300,4],[-300,132],[-170,132],[-20,27],[-20,4]],[5,13,11,6,4],300,5),K.body);
    add(d,box(276,1.2,112),K.enamel,0,132.3,-238,false);
    const mid=[-95,79.5],onS=(o,along,up,rx=SL)=>{o.position.y=mid[1]+along*SD[1]+up*SN[1];o.position.z=mid[0]+along*SD[0]+up*SN[0];o.rotation.x=rx;return o};
    [-1,1].forEach(q=>{onS(add(d,rb(5,5,166,1.6),K.alloy,q*112),0,2.6)});
    // print bridge: the paper goes in blank and comes out as a job
    add(d,rb(258,19,28,4),K.graphite,0,147.5,-184);[-1,1].forEach(q=>{add(d,box(12,7,28),K.graphite,q*123,135.5,-184);add(d,cyl(4.2,1.6,20),K.alloy,q*114,157.6,-184,false)});
    add(d,box(172,1.4,2.6),M.led,0,157.6,-174.5,false);
    const lab=K.texture(512,48,c=>{c.fillStyle='rgba(242,241,238,.5)';c.font='500 26px "Geist Mono",monospace';c.textAlign='center';c.fillText('CINDER  JOB LOG',256,33)},true);
    const lp=add(d,new T.PlaneGeometry(128,12),new T.MeshBasicMaterial({map:lab,transparent:true,toneMapped:false}),0,157.2,-188,false);lp.rotation.x=-Math.PI/2;
    // tear bar at the foot of the face
    onS(add(d,rb(244,7,13,2.4),K.alloy),76,8);[-1,1].forEach(q=>onS(add(d,box(8,9,13),K.alloy,q*118),76,3.4));
    const saw=new T.Shape();saw.moveTo(-108,0);for(let i=0;i<48;i++){saw.lineTo(-108+i*4.5+2.25,4.2);saw.lineTo(-108+(i+1)*4.5,0)}saw.lineTo(108,-3);saw.lineTo(-108,-3);
    onS(add(d,new T.ExtrudeGeometry(saw,{depth:1,bevelEnabled:false}),K.alloy),82.5,5.4,SL+Math.PI/2);
    // the roll, in a cradle of two machined cheeks
    const ch=[[-55,0],[55,0],[55,64],[38,103],[0,119],[-38,103],[-55,64]];[-1,1].forEach(q=>{add(d,slab(ch,[3,3,26,24,24,24,26],8,1.6),K.alloy,q*114,132,ROLL[0])});
    const spin=new T.Group();spin.position.set(0,ROLL[1],ROLL[0]);d.add(spin);r.spin=spin;const ax=(o)=>{o.rotation.z=Math.PI/2;return o};
    ax(add(spin,cyl(ROLL[2],TW,96),M.blank));ax(add(spin,cyl(13,TW+3,48),K.graphite));ax(add(spin,cyl(6,268,32),K.alloy));
    [-1,1].forEach(q=>{ax(add(spin,cyl(14,9,48),K.alloy,q*123.5));add(spin,box(1.4,20,3),K.enamel,q*128.2,0,0,false)});
    // feed wheel and vents on the side
    const kn=new T.Group();kn.position.set(150,58,-236);d.add(kn);r.knob=kn;ax(add(kn,cyl(23,13,64),K.alloy,6.5));ax(add(kn,cyl(15,2,48),K.graphite,13.6));add(kn,box(1.4,22,3),K.enamel,14.8,0,0,false);
    for(let i=0;i<8;i++)add(d,box(1.4,36,4.6),K.enamel,150,58,-190+i*11,false);
    [[-128,-282],[128,-282],[-128,-42],[128,-42]].forEach(q=>add(d,cyl(12,4,32),M.rubber,q[0],2,q[1]));[-138,138].forEach((x,i)=>screw(d,K,x,132.4,-288,i));
    add(d,cyl(7,10,32),K.graphite,151,16,-282).rotation.z=Math.PI/2;
    add(d,new T.TubeGeometry(new T.CatmullRomCurve3([[156,16,-282],[184,7,-286],[214,4.4,-316],[196,4.4,-372],[110,4.4,-404],[-40,4.4,-398]].map(p=>new T.Vector3(p[0],p[1],p[2]))),64,4.2,12),M.rubber);
    // the tape
    const last=TAPE.P.length-1;add(g,strip(0,TAPE.iB),M.blank);const sg=strip(TAPE.iB,last);add(g,sg,M.paper);add(g,sg,M.back,0,0,0,false);return {g,r}},
  update({t,copies,M}){const C=3.6,k=Math.floor(t/C),u=(t-k*C)/1.25,m=u<1,adv=(k+ez(u))*TLEN;
    M.tex.offset.y=(adv/LTEX)%1;lit(M.led,DARK,RED,m?1:.22+.1*Math.sin(t*2.2));copies.forEach(c=>{c.r.spin.rotation.x=-adv/ROLL[2];c.r.knob.rotation.x=-adv/30})}});
// ---- Homepage, what we build: a patch bay. An empty machined chassis with a bus along its floor. Modules are
// lowered into the bays one at a time and screwed down, each with its own face of knobs, sliders, meters and
// jacks. Two blank panels hold the places still open. Then crimson cables patch every module to the next.
const BAYS=[{n:'LEADS',k:[['j',-18,-76],['j',0,-76],['j',18,-76],['K',0,-22,17],['l',24,-50],['w',0,34,46,26]]},
  {n:'BOOKING',k:[['w',0,-60,48,42],['k',-16,-8,10],['k',16,-8,10],['l',0,18],['s',0,46,42]]},
  {n:'QUOTES',k:[['s',-17,-46,72,1],['s',17,-46,72,1],['l',-17,6],['l',17,6],['K',0,40,15]]},
  {n:'AFTER THE JOB',k:[['k',-16,-70,10],['k',16,-70,10],['w',0,-26,48,30],['K',0,24,16],['l',24,-2]]},
  {n:'WIN-BACKS',k:[['K',0,-56,19],['t',-16,-8],['t',16,-8],['l',0,14],['w',0,44,46,22]]},
  {n:'OFFICE',k:[['k',-16,-74,9],['k',16,-74,9],['k',-16,-44,9],['k',16,-44,9],['s',0,-10,44],['l',-18,18],['l',0,18],['l',18,18],['w',0,50,46,18]]},
  {n:'YOURS',blank:1,k:[['l',0,-60]]},{n:'YOURS',blank:1,k:[['l',0,-60]]}];
const bayX=i=>(i-3.5)*77,BAYC=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]];
function bayModule(K,M,i){const d=BAYS[i],m=new T.Group(),r={knobs:[],caps:[],bars:[],screws:[]};add(m,rb(72,5,236,2.2),K.body,0,0,0);
  const lab=K.texture(256,44,c=>{c.fillStyle='rgba(10,10,12,.86)';let f=25;do{c.font='600 '+f+'px "Geist Mono",ui-monospace,monospace';f--}while(c.measureText(d.n).width>236&&f>12);c.textAlign='center';c.fillText(d.n,128,30)},true);
  const lp=add(m,new T.PlaneGeometry(62,10.6),new T.MeshBasicMaterial({map:lab,transparent:true,toneMapped:false}),0,2.62,-103,false);lp.rotation.x=-Math.PI/2;
  [[-27,-111],[27,111]].forEach((q,k)=>{const s=new T.Group();s.position.set(q[0],2.4,q[1]);s.scale.setScalar(.7);screw(s,K,0,0,0,k);m.add(s);r.screws.push(s)});
  if(d.blank){add(m,box(24,1,3),K.enamel,0,2.7,30,false);add(m,box(3,1,24),K.enamel,0,2.7,30,false)}
  else [-16,16].forEach(x=>{add(m,cyl(7.6,2.6,6),K.alloy,x,3.8,88);add(m,cyl(5,5,24),K.alloy,x,5,88);add(m,cyl(3.3,5.4,20),K.enamel,x,5.1,88,false)});
  d.k.forEach((q,n)=>{const [ty,x,z,a,b]=q;
    if(ty==='K'||ty==='k'){const kn=new T.Group(),ht=ty==='K'?15:10;kn.position.set(x,2.5,z);add(kn,cyl(a*1.12,3,48),K.graphite,0,1.5,0);add(kn,cyl(a*.8,ht,48,a*.92),K.enamel,0,3+ht/2,0);add(kn,cyl(a*.58,1.6,32),K.alloy,0,3.8+ht,0,false);add(kn,box(1.8,1.2,a*.46),M.ptr,0,4.7+ht,-a*.5,false);
      kn.userData.a0=(Math.sin(i*7.3+n*3.1)*.5)*2.4;m.add(kn);r.knobs.push(kn)}
    else if(ty==='j'){add(m,cyl(7.6,2.6,6),K.alloy,x,3.8,z);add(m,cyl(5,5,24),K.alloy,x,5,z);add(m,cyl(3.3,5.4,20),K.enamel,x,5.1,z,false)}
    else if(ty==='l'){add(m,cyl(4.6,2.4,24),K.alloy,x,3.7,z,false);add(m,cyl(2.9,3.4,20),M.led[i],x,4.3,z,false)}
    else if(ty==='w'){add(m,rb(a+7,2.4,b+7,1.4),K.graphite,x,3.6,z,false);add(m,box(a,2.8,b),K.enamel,x,3.9,z,false);const rows=b>24?3:2;for(let e=0;e<rows;e++){const bar=add(m,box(a-12,3.2,2.6),e?M.ptr:M.led[i],x,4,z+(e-(rows-1)/2)*b*.28,false);bar.userData={x0:x,w:a-12};r.bars.push(bar)}}
    else if(ty==='s'){add(m,b?box(4.4,2.4,a):box(a,2.4,4.4),K.enamel,x,3.6,z,false);const cap=add(m,b?rb(13,7,9,1.6):rb(9,7,13,1.6),K.alloy,x,7,z);cap.userData={x0:x,z0:z,len:a,v:b};r.caps.push(cap)}
    else if(ty==='t'){add(m,cyl(5.6,3,6),K.alloy,x,4,z);const lv=add(m,cyl(1.7,13,12),K.alloy,x,10,z+(x<0?2.6:-2.6));lv.rotation.x=.42*(x<0?1:-1)}});
  return {m,r}}
window.CinderBay=make({fit:[348,272],yaw:[1.04,.98,.9,.84,.94],aim:52,sway:.04,
  enterTime:1.6,enter(k,E){const o=1-Math.pow(1-k,4);E.sz=lerp(-300,0,o);E.yaw=lerp(.5,0,o);E.scale=1},
  mats:K=>({led:BAYS.map(()=>K.led()),pwr:K.led(),ptr:K.led(0xe9e8e4),cable:new T.MeshStandardMaterial({color:0xc4122c,roughness:.42,metalness:0}),rubber:new T.MeshStandardMaterial({color:0x0b0b0c,roughness:.62,metalness:0})}),
  build(K,M){const g=new T.Group(),r={mods:[],cab:[]};
    add(g,rb(676,12,300,9),K.graphite,0,6,0);add(g,box(634,1.4,256),K.enamel,0,12.6,0,false);
    // the bus every module plugs into
    add(g,box(610,3,30),K.graphite,0,14.5,0);for(let i=0;i<8;i++){add(g,box(26,7,12),K.enamel,bayX(i),19,0);for(let e=0;e<5;e++)add(g,box(1.6,3,1.6),K.alloy,bayX(i)-8+e*4,24,0,false)}
    [-1,1].forEach(q=>{add(g,rb(644,14,18,3),K.alloy,0,41,q*120);add(g,rb(676,42,10,3),K.graphite,0,27,q*145);add(g,rb(18,60,300,5),K.body,q*329,30,0);[-112,112].forEach((z,e)=>screw(g,K,q*329,60.2,z,e+q))});
    for(let i=0;i<8;i++)[-1,1].forEach(q=>add(g,cyl(2.6,1,12),K.enamel,bayX(i)+27*q,48.3,-111*q,false));
    const brand=K.texture(512,48,c=>{c.fillStyle='rgba(242,241,238,.5)';c.font='500 26px "Geist Mono",monospace';c.fillText('CINDER  PATCH BAY',6,33)},true);
    add(g,new T.PlaneGeometry(150,14),new T.MeshBasicMaterial({map:brand,transparent:true,toneMapped:false}),-232,30,150.2,false);add(g,cyl(4.2,2,24),K.alloy,300,30,150.4,false).rotation.x=Math.PI/2;add(g,cyl(2.6,2.6,20),M.pwr,300,30,150.8,false).rotation.x=Math.PI/2;
    [[-300,-124],[300,-124],[-300,124],[300,124]].forEach(q=>add(g,cyl(13,4,32),M.rubber,q[0],-2,q[1]));
    add(g,new T.TubeGeometry(new T.CatmullRomCurve3([[-250,22,-150],[-256,8,-176],[-300,4.4,-206],[-380,4.4,-214],[-470,4.4,-190]].map(p=>new T.Vector3(p[0],p[1],p[2]))),48,4.4,12),M.rubber);
    for(let i=0;i<8;i++){const o=bayModule(K,M,i);o.m.position.set(bayX(i),50.5,0);g.add(o.m);r.mods.push(o)}
    BAYC.forEach((q,k)=>{const loop=k===5,xa=bayX(q[0])+(loop?-16:16)*(loop?-1:1),xb=bayX(q[1])+(loop?-16:-16),A=new T.Vector3(loop?bayX(5)+16:bayX(q[0])+16,70,88),B=new T.Vector3(loop?bayX(0)-16:bayX(q[1])-16,70,88),h=loop?92:34+(k%2)*10,
        pts=[A,A.clone().add(new T.Vector3(0,h*.55,loop?26:6)),A.clone().lerp(B,.5).add(new T.Vector3(0,h,loop?74:16)),B.clone().add(new T.Vector3(0,h*.55,loop?26:6)),B],
        mesh=add(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),loop?90:40,2.5,8),M.cable),plug=P=>{const pg=new T.Group();pg.position.set(P.x,56,P.z);add(pg,cyl(3.5,11,16),K.alloy,0,5.5,0);add(pg,cyl(4.6,5,16),K.graphite,0,12.5,0);g.add(pg);return pg};
      r.cab.push({mesh,seg:loop?90:40,pa:plug(A),pb:plug(B)})});
    return {g,r}},
  update({t,p,copies,M}){const s=p*8,one=ez((s-7.1)/.8);lit(M.pwr,DARK,RED,one);
    for(let i=0;i<8;i++){const real=i<6,a=real?ez((s-(i+.3))/.55):ez((s-(6.3+(i-6)*.14))/.5),hot=real?ez(c01(1.4-Math.abs(s-(i+1))*1.8)):ez(c01(1.4-Math.abs(s-7)*1.8)),sc=real?ez((s-(i+.8))/.22):ez((s-(6.86+(i-6)*.1))/.2);
      lit(M.led[i],DARK,RED,Math.max(one*.9,hot*(.62+.38*Math.sin(t*3+i))));
      copies.forEach(c=>{const o=c.r.mods[i];o.m.visible=a>.002;o.m.position.y=50.5+(1-a)*200;o.m.rotation.z=(1-a)*.2*(i%2?-1:1);o.m.rotation.x=-(1-a)*.14;
        o.r.screws.forEach((q,k)=>{q.position.y=2.4+(1-sc)*11;q.rotation.y=(1-sc)*8+k});
        o.r.knobs.forEach((q,k)=>{q.rotation.y=q.userData.a0+hot*(1.5+.5*Math.sin(t*1.1+k*2+i))+one*.6});
        o.r.caps.forEach((q,k)=>{const d=q.userData,v=(lerp(.16,.5+.42*Math.sin(t*.9+k*2.1+i),hot)-.5)*d.len*.78;if(d.v)q.position.z=d.z0+v;else q.position.x=d.x0+v});
        o.r.bars.forEach((q,k)=>{const d=q.userData,l=lerp(.16,.3+.7*(.5+.5*Math.sin(t*1.6+k*1.7+i)),Math.max(hot,one*.8));q.scale.x=l;q.position.x=d.x0-(1-l)*d.w/2})})}
    copies.forEach(c=>c.r.cab.forEach((q,k)=>{const kk=ez(one*2-k*.15);q.mesh.visible=kk>.01;q.mesh.geometry.setDrawRange(0,Math.floor(q.seg*kk)*48);q.pa.visible=kk>.01;q.pb.visible=kk>.97}))}});
// ---- Homepage, one job: a machined line. A carriage (the job) rides the rail past seven stations and each one does its part.
const LN=['CALL','BOOKING','REMINDER','ESTIMATE','FOLLOW-UP','INVOICE','REVIEW'],lnX=i=>(i-3)*90;
window.CinderLine=make({fit:[288,238],yaw:[1.14,1.04,.94,.86,.92],aim:44,sway:.035,
  enterTime:1.6,enter(k,E){const o=1-Math.pow(1-k,4);E.sz=lerp(-280,0,o);E.yaw=lerp(.45,0,o);E.scale=1},
  mats:K=>({led:LN.map(()=>K.led()),car:K.led(0xff1f3a),ring:K.led(),key:K.led(),pin:[0,1].map(()=>K.led()),peg:[0,1,2].map(()=>K.led()),star:[0,1,2,3,4].map(()=>K.led()),
    paid:new T.MeshBasicMaterial({transparent:true,opacity:0,toneMapped:false,map:K.texture(256,96,c=>{c.strokeStyle='#ff1f3a';c.lineWidth=7;c.strokeRect(8,8,240,80);c.fillStyle='#ff1f3a';c.font='700 54px "Geist Mono",monospace';c.textAlign='center';c.fillText('PAID',128,68)},true)}),
    rubber:new T.MeshStandardMaterial({color:0x0b0b0c,roughness:.62,metalness:0}),
    paper:new T.MeshStandardMaterial({color:0xe6e3dc,roughness:.9,metalness:0,map:K.texture(256,320,c=>{c.fillStyle='#efede6';c.fillRect(0,0,256,320);c.fillStyle='#16161a';c.fillRect(24,26,120,12);c.fillStyle='rgba(22,22,26,.45)';for(let i=0;i<6;i++){c.fillRect(24,70+i*30,130+((i*37)%60),7);c.fillRect(196,70+i*30,36,7)}c.fillStyle='#16161a';c.fillRect(24,262,208,3);c.fillRect(170,280,62,12)},true)})}),
  build(K,M){const g=new T.Group(),r={car:null,ring:null,key:null,pins:[],paper:null,slider:null,head:null,stars:[]};
    add(g,rb(690,12,196,9),K.graphite,0,6,0);add(g,box(650,1.4,156),K.enamel,0,12.6,0,false);
    // the rail the job rides
    add(g,rb(640,6,30,2),K.graphite,0,15,60);[-9,9].forEach(z=>add(g,box(630,3,3),K.alloy,0,19.5,60+z,false));for(let i=0;i<32;i++)add(g,box(1.4,1,14),K.enamel,-310+i*20,18.3,60,false);
    [-1,1].forEach(q=>{add(g,rb(20,26,40,4),K.graphite,q*328,22,60);screw(g,K,q*328,35.2,60,q)});
    const car=new T.Group();add(car,rb(40,12,26,3),K.alloy,0,0,0);add(car,rb(30,5,18,2),K.enamel,0,8,0);add(car,box(22,1.2,3),M.car,0,11,5,false);add(car,cyl(3,3,20),K.graphite,-12,11,-5,false);add(car,cyl(3,3,20),K.graphite,12,11,-5,false);car.position.set(-300,27,60);g.add(car);r.car=car;
    // the bus behind the stations, and the lead out
    add(g,rb(650,10,14,3),K.graphite,0,18,-84);for(let i=0;i<7;i++)add(g,rb(22,4,16,1.5),K.enamel,lnX(i),24,-84);add(g,new T.TubeGeometry(new T.CatmullRomCurve3([[-330,18,-84],[-352,8,-96],[-400,4.4,-120],[-470,4.4,-112]].map(p=>new T.Vector3(p[0],p[1],p[2]))),40,4.4,12),M.rubber);
    for(let i=0;i<7;i++){const s=new T.Group();s.position.set(lnX(i),13,-14);g.add(s);
      add(s,rb(76,8,104,3),K.body,0,4,0);[[-31,-45],[31,-45],[-31,45],[31,45]].forEach((q,e)=>screw(s,K,q[0],8.2,q[1],e*.7));
      const lab=K.texture(256,44,c=>{c.fillStyle='rgba(10,10,12,.86)';c.font='600 24px "Geist Mono",ui-monospace,monospace';c.textAlign='center';c.fillText(LN[i],128,31)},true);
      add(s,new T.PlaneGeometry(58,10),new T.MeshBasicMaterial({map:lab,transparent:true,toneMapped:false}),0,8.3,40,false).rotation.x=-Math.PI/2;
      add(s,box(18,1.6,4),M.led[i],0,8.6,30,false);add(s,box(6,6,12),K.alloy,0,3,-58);
      if(i===0){add(s,cyl(27,10,64),K.graphite,0,13,-6);add(s,cyl(22,2,64),K.enamel,0,19,-6,false);for(let k=0;k<3;k++)add(s,new T.TorusGeometry(7+k*5.5,.9,8,48),K.alloy,0,20.4,-6,false).rotation.x=Math.PI/2;r.ring=add(s,new T.TorusGeometry(24,1.6,10,64),M.ring,0,20,-6,false);r.ring.rotation.x=Math.PI/2}
      if(i===1){add(s,rb(60,5,60,2),K.graphite,0,10.5,-6);for(let a=0;a<3;a++)for(let b=0;b<3;b++){const on=a===1&&b===2,k=add(s,rb(15,7,15,2),on?M.key:K.enamel,(b-1)*18,16.5,(a-1)*18-6);if(on)r.key=k}}
      if(i===2){add(s,rb(52,6,30,2),K.graphite,0,11,-6);[-13,13].forEach((x2,e)=>{add(s,cyl(7,3,32),K.alloy,x2,15,-6);const q=new T.Group();add(q,cyl(4.6,16,32),K.enamel,0,0,0);add(q,cyl(4.7,2.4,32),M.pin[e],0,9,0,false);q.position.set(x2,10,-6);s.add(q);r.pins.push(q)})}
      if(i===3){add(s,rb(62,24,44,3),K.graphite,0,20,-22);add(s,box(50,2,2),K.enamel,0,22,.4,false);add(s,rb(62,4,44,2),K.alloy,0,34,-22);r.paper=add(s,box(46,.8,58),M.paper,0,21.4,-24)}
      if(i===4){add(s,rb(64,5,14,2),K.graphite,0,10.5,-6);add(s,box(58,2,3),K.alloy,0,14,-6,false);[-22,0,22].forEach((x2,e)=>{add(s,cyl(4,9,24),K.enamel,x2,17,-24);add(s,cyl(4.1,2,24),M.peg[e],x2,22.5,-24,false)});r.slider=add(s,rb(12,8,18,2),K.alloy,-24,18,-6)}
      if(i===5){[-22,22].forEach(x2=>add(s,cyl(3.4,44,24),K.alloy,x2,30,-10));add(s,rb(56,7,12,2),K.graphite,0,52,-10);add(s,rb(46,3,34,1.5),K.enamel,0,9.5,-10);add(s,new T.PlaneGeometry(40,15),M.paid,0,11.2,-10,false).rotation.x=-Math.PI/2;
        const h=new T.Group();add(h,cyl(4,22,24),K.alloy,0,11,0);add(h,rb(40,8,22,2),K.graphite,0,-2,0);h.position.set(0,44,-10);s.add(h);r.head=h}
      if(i===6){add(s,rb(66,5,22,2),K.graphite,0,10.5,-6);for(let k=0;k<5;k++)r.stars.push(add(s,cyl(5.6,6,5),M.star[k],(k-2)*13,12,-6))}}
    const brand=K.texture(512,48,c=>{c.fillStyle='rgba(242,241,238,.5)';c.font='500 26px "Geist Mono",monospace';c.fillText('CINDER  JOB LINE',6,33)},true);
    add(g,new T.PlaneGeometry(120,9),new T.MeshBasicMaterial({map:brand,transparent:true,toneMapped:false}),-262,6,98.3,false);
    [[-310,-80],[310,-80],[-310,80],[310,80]].forEach(q=>add(g,cyl(13,4,32),M.rubber,q[0],-2,q[1]));
    return {g,r}},
  update({t,p,copies,M}){const s=p*7,A=i=>ez(c01((s-i)*1.5)),cur=Math.min(6,Math.floor(s)),x=lerp(-300,300,ez(c01(s/7))*.25+c01(s/7)*.75);
    LN.forEach((n,i)=>lit(M.led[i],DARK,i===cur&&s<6.95?RED:WHITE,A(i)));
    lit(M.ring,DARK,WHITE,A(0)*(.65+.35*Math.sin(t*5)));lit(M.key,DARK,WHITE,A(1));M.pin.forEach((m,e)=>lit(m,DARK,e?RED:WHITE,ez(c01((s-2)*2-e*.8))));
    M.peg.forEach((m,e)=>lit(m,DARK,e===2?RED:WHITE,ez(c01((s-4)*3-e))));M.paid.opacity=ez(c01((s-5.45)*4));M.star.forEach((m,e)=>lit(m,DARK,WHITE,ez(c01((s-6)*5-e))));
    copies.forEach(c=>{const r=c.r;r.car.position.x=x;r.ring.position.y=20+A(0)*5+Math.sin(t*5)*A(0)*.8;r.key.position.y=16.5+A(1)*6;
      r.pins.forEach((q,e)=>{q.position.y=10+ez(c01((s-2)*2-e*.8))*9});r.paper.position.z=-24+A(3)*27;r.slider.position.x=-24+ez(c01(s-4))*48;
      r.head.position.y=44-Math.sin(c01((s-5)*2.2)*Math.PI)*27;r.stars.forEach((q,e)=>{const k=ez(c01((s-6)*5-e));q.position.y=12+k*7;q.rotation.y=k*TAU/5})})}});
dispatchEvent(new Event('cinder-visual'));dispatchEvent(new Event('cinder-plate'));
