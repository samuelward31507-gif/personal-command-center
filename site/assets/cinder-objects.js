// Machined objects, one per page, in the same studio as the six-layer unit: rect lights with matching reflection
// cards, brushed alloy with grain, enamel, hard shadows, a floor reflection, crimson only where something is live.
// Each is a global with mount(host) and setStep(i). They turn slowly on their own and react to the scroll step.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,c01=v=>v<0?0:v>1?1:v,ez=x=>{x=c01(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
const RED=new T.Color(0xff1f3a),DARK=new T.Color(0x1a1a1d),WHITE=new T.Color(0xf2f1ee),TAU=Math.PI*2;
const rb=(w,h,d,r=4)=>new RoundedBoxGeometry(w,h,d,3,r),box=(w,h,d)=>new T.BoxGeometry(w,h,d),cyl=(r,h,s=64,r2)=>new T.CylinderGeometry(r,r2==null?r:r2,h,s);
const add=(g,geo,m,x=0,y=0,z=0,sh=true)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=sh;o.receiveShadow=true;g.add(o);return o};
const lit=(m,a,b,k)=>m.color.copy(a).lerp(b,c01(k));

function make(def){
  let step=0,kick=()=>{},now=0,ts=0;
  return {setProgress(){},setActive(){},setStep(i){if(i!==step){step=i;ts=now}kick()},mount(host){
    const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%';canvas.setAttribute('aria-hidden','true');
    if(getComputedStyle(host).position==='static')host.style.position='relative';host.append(canvas);
    const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
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
    const floor=new T.Mesh(new T.PlaneGeometry(5000,5000),new T.MeshBasicMaterial({color:0,transparent:true,opacity:.9,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.renderOrder=2;scene.add(floor);
    let W=1,H=1,raf=0,vis=false,s=0,yaw=def.yaw[0],last=performance.now();const t0=last;
    function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(W,H,false);
      const a=W/H,hh=Math.max(def.fit[1],def.fit[0]/a);camera.left=-hh*a;camera.right=hh*a;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();kick()}
    function frame(n){raf=0;const dt=Math.min(.05,(n-last)/1000);last=n;now=RM?12:Math.max(0,(n-t0)/1000);
      s+=(step-s)*(RM?1:Math.min(1,dt*3.2));yaw+=(def.yaw[Math.min(def.yaw.length-1,step)]-yaw)*(RM?1:Math.min(1,dt*2));
      rig.rotation.y=Math.PI/4+yaw+(RM?0:.06*Math.sin(now*.4));
      def.update({t:now,s,step,since:RM?99:now-ts,copies,M});renderer.render(scene,camera);if(vis&&!RM)raf=requestAnimationFrame(frame)}
    kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};
    new ResizeObserver(size).observe(host);new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis){last=performance.now();kick()}}).observe(host);size();
  }}}

// ---- Homepage, the audit: a machined sheet. A gantry walks the rows, the costs rank themselves, three get picked.
const COST=[1,.45,.35,.8,.25,.6],ORDER=[0,3,5,1,2,4],PICK=[0,3,5],ROWS=['CALLS','FORMS','ESTIMATES','QUOTES','INVOICES','REVIEWS'];
window.CinderSheet=make({fit:[310,255],yaw:[.34,.2,.08,.26],aim:10,
  mats:K=>({row:ROWS.map(()=>K.led()),chk:ROWS.map(()=>K.led()),head:K.led(0xff1f3a),scan:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={bars:[]};add(g,rb(390,16,540,10),K.body,0,8,0);
    const tex=K.texture(680,960,c=>{c.fillStyle='#0b0b0d';c.fillRect(0,0,680,960);c.fillStyle='rgba(242,241,238,.9)';c.font='500 30px "Geist Mono",monospace';c.fillText('AUDIT',40,74);c.fillStyle='rgba(242,241,238,.3)';c.fillRect(40,104,600,2);
      c.font='500 22px "Geist Mono",monospace';ROWS.forEach((l,i)=>{c.fillStyle='rgba(242,241,238,.6)';c.fillText(l,118,196+i*128);c.fillStyle='rgba(242,241,238,.12)';c.fillRect(40,256+i*128,600,2)})},true);
    const p=add(g,new T.PlaneGeometry(340,480),new T.MeshPhysicalMaterial({map:tex,metalness:.2,roughness:.24,clearcoat:1,clearcoatRoughness:.06}),0,16.3,0,false);p.rotation.x=-Math.PI/2;
    ROWS.forEach((l,i)=>{const z=-134+i*64;add(g,rb(28,7,28,2),K.alloy,-140,19.5,z);add(g,box(15,3,15),M.chk[i],-140,23.6,z,false);
      add(g,box(150,3,12),K.graphite,60,17.6,z+8);const b=add(g,box(146,3.4,8),M.row[i],60,19.4,z+8,false);b.userData.x0=-13;r.bars[i]=b});
    add(g,box(10,3,10),M.head,150,18,-208,false);
    const gan=new T.Group();add(gan,box(12,30,14),K.alloy,-203,31,0);add(gan,box(12,30,14),K.alloy,203,31,0);add(gan,rb(430,12,18,3),K.alloy,0,50,0);add(gan,box(380,2,5),M.scan,0,42.6,0,false);g.add(gan);r.gan=gan;return {g,r}},
  update({t,step,since,copies,M}){const gz=step<1?-222:step===1?lerp(-190,200,ez(since/2.8)):232;
    M.head.color.copy(DARK).lerp(RED,step<1?(Math.sin(t*5)>.0?1:.25):0);lit(M.scan,DARK,RED,step===1&&since<2.9?1:.0);
    ROWS.forEach((l,i)=>{const z=-134+i*64,seen=step>1||(step===1&&gz>z),picked=step>=3&&PICK.includes(i),rank=ORDER.indexOf(i);
      lit(M.row[i],DARK,WHITE,seen?(step>=3&&!picked?.18:1):0);lit(M.chk[i],DARK,RED,picked?ez(since*3-PICK.indexOf(i)*.5):0);
      const k=step>=2?lerp(.3,COST[i],ez((step>2?9:since)*2.2-rank*.22)):seen?.3:.04;copies.forEach(c=>{const b=c.r.bars[i];b.scale.x=k;b.position.x=b.userData.x0+73*k})});
    copies.forEach(c=>{c.r.gan.position.z=gz})}});

// ---- Answering: a switchboard. A line lights, the reply runs through the core and out.
const PORTZ=[-108,-36,36,108];
window.CinderRelay=make({fit:[335,235],yaw:[.55,.36,.2,.46],aim:18,
  mats:K=>({port:PORTZ.map(()=>K.led()),core:K.led(),out:K.led(),bead:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={};add(g,rb(540,20,350,12),K.body,0,10,0);add(g,box(500,2,310),K.enamel,0,20.6,0,false);
    add(g,cyl(74,28,96,80),K.alloy,40,34,0);add(g,cyl(56,3,96),K.enamel,40,49.5,0,false);const ring=add(g,new T.TorusGeometry(40,3.2,12,96),M.core,40,51.5,0,false);ring.rotation.x=Math.PI/2;add(g,cyl(14,10,48),K.alloy,40,54,0);
    PORTZ.forEach((z,i)=>{add(g,rb(64,24,46,4),K.graphite,-204,32,z);add(g,box(8,3,30),M.port[i],-204,45.4,z,false);const len=Math.hypot(142,z),b=add(g,box(len,3,6),K.alloy,-101,22.6,z/2);b.rotation.y=Math.atan2(z,142)});
    add(g,box(96,3,6),K.alloy,160,22.6,0);add(g,rb(74,24,64,4),K.alloy,236,32,0);add(g,box(40,3,40),M.out,236,45.4,0,false);
    r.bead=add(g,box(12,6,12),M.bead,0,27,0,false);return {g,r}},
  update({t,step,copies,M}){const T2=3.2,n=Math.floor(t/T2)%4,f=(t/T2)%1,go=step>=1,z=PORTZ[n];
    PORTZ.forEach((p,i)=>lit(M.port[i],DARK,RED,i===n&&f<(go?.4:.92)?(Math.sin(t*14)>0?1:.35):0));
    lit(M.core,DARK,WHITE,go?c01(1-Math.abs(f-.56)*5):.12);lit(M.out,DARK,WHITE,go&&f>.74?1:.0);
    let x=-204,zz=z,v=0;if(go&&f>.22&&f<.52){const k=ez((f-.22)/.3);x=lerp(-172,-30,k);zz=lerp(z,0,k);v=1}else if(go&&f>=.52&&f<.76){const k=ez((f-.52)/.24);x=lerp(112,200,k);zz=0;v=1}
    copies.forEach(c=>{c.r.bead.position.set(x,27,zz);c.r.bead.visible=!!v})}});

// ---- Booking: a block of slots. Booked ones stand up, the next one drops in.
const SLOT=[7,2,13,16,9,4,18,11,0,14];
window.CinderBlock=make({fit:[320,255],yaw:[.5,.3,.62,.4],aim:16,
  mats:K=>({on:K.led(0xf2f1ee),off:K.led(),now:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={tiles:[],studs:[],hi:K.alloy,lo:K.graphite};add(g,rb(490,18,420,10),K.body,0,9,0);add(g,box(456,2,386),K.enamel,0,18.6,0,false);
    for(let d=0;d<5;d++)for(let q=0;q<4;q++){const x=-176+88*d,z=-138+92*q,t=add(g,rb(72,14,76,3),K.alloy,x,27,z);r.tiles.push(t);r.studs.push(add(t,box(32,3,8),M.off,0,8.6,22,false))}return {g,r}},
  update({t,step,copies,M}){const n=Math.min(8,2+step*2),f=(t%2.6)/2.6;lit(M.now,RED,RED,1);M.now.color.multiplyScalar(.7+.3*Math.sin(t*6));
    copies.forEach(c=>c.r.tiles.forEach((tile,i)=>{const k=SLOT.indexOf(i),booked=k>=0&&k<n,cur=k===n,st=c.r.studs[i];
      tile.position.y=cur?lerp(110,37,ez(f*1.8)):lerp(tile.position.y,booked?37:27,.12);tile.visible=!(cur&&f<.02);st.material=cur?M.now:booked?M.on:M.off;tile.material=cur||booked?c.r.hi:c.r.lo}))}});

// ---- Follow-up: a rail. The carriage works its way down the stops until the quote is answered.
const STOP=[-250,-90,70,230];
window.CinderTrack=make({fit:[360,200],yaw:[.6,.44,.3,.2],aim:14,
  mats:K=>({stop:STOP.map(()=>K.led()),car:K.led(0xff1f3a)}),
  build(K,M){const g=new T.Group(),r={flags:[]};add(g,rb(640,14,96,6),K.body,0,7,0);add(g,box(600,2,18),K.enamel,0,14.6,10,false);
    for(let i=0;i<25;i++)add(g,box(2,2,i%6?8:16),K.alloy,-288+i*24,15,36,false);
    STOP.forEach((x,i)=>{add(g,cyl(13,30,48),K.alloy,x,29,-24);add(g,cyl(9,3,32),M.stop[i],x,45.4,-24,false);const f=new T.Group();f.position.set(x+22,15,-24);add(f,box(4,34,24),K.alloy,0,17,0);g.add(f);r.flags.push(f)});
    const car=new T.Group();add(car,rb(50,22,40,4),K.alloy,0,26,10);add(car,box(30,3,8),M.car,0,38.4,10,false);g.add(car);r.car=car;return {g,r}},
  update({t,step,s,copies,M}){const at=Math.min(3,step),x=lerp(-300,STOP[at]-0,1)+6*Math.sin(t*1.3);
    STOP.forEach((p,i)=>lit(M.stop[i],DARK,i===at?RED:WHITE,i<at?1:i===at?(.6+.4*Math.sin(t*5)):0));M.car.color.copy(RED).multiplyScalar(.7+.3*Math.sin(t*4));
    copies.forEach(c=>{c.r.car.position.x=lerp(c.r.car.position.x,x,.08);c.r.flags.forEach((f,i)=>{f.rotation.z=lerp(f.rotation.z,i<=at?0:-Math.PI/2,.1)})})}});

// ---- Reviews: a polished star on a plinth. The asks light up one by one.
window.CinderMedal=make({fit:[255,225],yaw:[.2,-.3,.4,0],aim:40,
  mats:K=>({tip:[0,1,2,3,4].map(()=>K.led())}),
  build(K,M){const g=new T.Group(),r={};add(g,cyl(196,24,128,210),K.body,0,12,0);add(g,cyl(176,2,128),K.enamel,0,24.6,0,false);
    const sh=new T.Shape();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?56:138;i?sh.lineTo(Math.cos(a)*q,Math.sin(a)*q):sh.moveTo(Math.cos(a)*q,Math.sin(a)*q)}sh.closePath();
    const geo=new T.ExtrudeGeometry(sh,{depth:22,bevelEnabled:true,bevelThickness:5,bevelSize:5,bevelSegments:4});geo.translate(0,0,-11);
    const hold=new T.Group();hold.position.y=58;const star=add(hold,geo,new T.MeshPhysicalMaterial({color:0xffffff,metalness:.95,roughness:.16,clearcoat:.4,clearcoatRoughness:.2}),0,0,0);star.rotation.x=-Math.PI/2;g.add(hold);r.hold=hold;
    for(let i=0;i<5;i++){const a=i/5*TAU;add(g,cyl(11,6,32),K.alloy,Math.sin(a)*158,27,-Math.cos(a)*158);add(g,cyl(7,2,24),M.tip[i],Math.sin(a)*158,31,-Math.cos(a)*158,false)}return {g,r}},
  update({t,s,copies,M}){const n=Math.floor(t*1.1)%7;M.tip.forEach((m,i)=>lit(m,DARK,i===n?RED:WHITE,i<=n?1:0));
    copies.forEach(c=>{c.r.hold.rotation.y=t*.25;c.r.hold.position.y=58+16*ez(s)+4*Math.sin(t*.9)})}});

// ---- Websites: a page that comes apart into the pieces that turn a visitor into a lead.
window.CinderFrame=make({fit:[300,300],yaw:[.6,.3,.5,.2],aim:50,
  mats:K=>({btn:K.led(0xff1f3a),dot:K.led(0xf2f1ee)}),
  build(K,M){const g=new T.Group(),r={parts:[]};add(g,rb(320,12,440,10),K.body,0,6,0);add(g,box(292,2,412),K.enamel,0,12.6,0,false);
    const P=(x,z,build)=>{const p=new T.Group();p.position.set(x,14,z);build(p);g.add(p);r.parts.push(p)};
    P(0,-176,p=>{add(p,rb(280,8,36,3),K.alloy,0,4,0);add(p,box(8,2,8),M.dot,-122,9,0,false);for(let i=0;i<3;i++)add(p,box(26,2,6),K.graphite,60+i*36,9,0,false)});
    P(0,-76,p=>{add(p,rb(280,10,140,4),K.graphite,0,5,0);add(p,box(200,3,12),K.alloy,-28,11.5,-30);add(p,box(140,3,8),K.alloy,-58,11.5,-6);add(p,box(64,3,18),M.dot,-96,11.5,30,false)});
    P(-78,96,p=>{add(p,rb(124,10,180,4),K.enamel,0,5,0);for(let i=0;i<2;i++)add(p,rb(100,6,74,3),K.graphite,0,13,-44+i*88)});
    P(78,96,p=>{add(p,rb(124,12,180,4),K.alloy,0,6,0);for(let i=0;i<3;i++)add(p,box(100,3,22),K.graphite,0,13.5,-58+i*36);add(p,box(100,4,26),M.btn,0,14,62,false)});return {g,r}},
  update({t,s,copies,M}){const e=14+10*Math.sin(t*.7)+30*ez(s*.6);M.btn.color.copy(RED).multiplyScalar(.7+.3*Math.sin(t*4));
    copies.forEach(c=>c.r.parts.forEach((p,i)=>{p.position.y=14+e*[.6,1.2,1.8,2.4][i]}))}});

dispatchEvent(new Event('cinder-visual'));dispatchEvent(new Event('cinder-plate'));
