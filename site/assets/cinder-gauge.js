// "What you get back": the working day as a machined instrument. Same studio as the six-layer unit:
// rect lights with matching reflection cards, brushed alloy, enamel, hard shadows, crimson only where something is live.
// API: mount(host), setStep(0..3). Turns slowly on its own; each step brings its part of the day to the front.
import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let step=0,kick=()=>{};
window.CinderGauge={setStep(i){step=i;kick()},mount(host){
  const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%';canvas.setAttribute('aria-hidden','true');
  if(getComputedStyle(host).position==='static')host.style.position='relative';host.append(canvas);
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,3600);camera.position.set(1000,816.49658,1000);camera.lookAt(0,20,0);
  RectAreaLightUniformsLib.init();
  const studio=new T.Scene();studio.background=new T.Color(0);const aim=new T.Vector3(0,60,0);
  for(const [x,y,z,w,h,i] of [[-230,560,-115,620,490,4.1],[-375,-140,360,310,680,2.65],[350,-100,-345,145,650,2.05]]){
    const p=new T.RectAreaLight(0xf2f1ee,i,w,h);p.position.set(x,y,z).add(aim);p.lookAt(aim);scene.add(p);
    const m=new T.MeshBasicMaterial({color:0xf2f1ee});m.color.multiplyScalar(i);const c=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),m);c.position.set(x*.01,y*.01,z*.01);c.quaternion.copy(p.quaternion);c.rotateY(Math.PI);studio.add(c)}
  const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(studio,.015).texture;pm.dispose();
  const key=new T.DirectionalLight(0xf2f1ee,1.9);key.castShadow=true;key.position.set(-385,820,350);key.target.position.copy(aim);scene.add(key,key.target);
  key.shadow.mapSize.setScalar(2048);key.shadow.bias=-.0001;key.shadow.normalBias=.12;Object.assign(key.shadow.camera,{left:-460,right:460,top:460,bottom:-460,near:100,far:2000});

  function texture(w,h,paint,color){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'));const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t}
  const grain=texture(128,128,c=>{const d=c.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const v=Math.sin(y*91.713)*.8+Math.sin((y+1)*(y+11)*1.379+x*.01)*.2;d.data.set([128,128+v*8,253,255],4*(128*y+x))}c.putImageData(d,0,0)});
  grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);
  const rough=texture(128,128,c=>{const d=c.createImageData(128,128);for(let i=0;i<16384;i++){const x=i%128,y=i>>7,v=243+3*Math.sin(y*y*1.71+x*.016)+2*Math.sin(x*.079+y*.19);d.data.set([v,v,v,255],i*4)}c.putImageData(d,0,0)});
  rough.wrapS=rough.wrapT=T.RepeatWrapping;rough.repeat.set(3,3);
  const mat=(color,roughness=.36,extra={})=>new T.MeshPhysicalMaterial({color,metalness:.9,roughness,roughnessMap:rough,...extra});
  const body=mat(0x77767c,.32,{anisotropy:.4,clearcoat:.12,clearcoatRoughness:.34,normalMap:grain,normalScale:new T.Vector2(.12,.18)});
  const alloy=mat(0xffffff,.36,{metalness:.88,normalMap:grain,normalScale:new T.Vector2(.08,.12)});
  const graphite=mat(0x2a2a2f,.4),enamel=mat(0x0c0c0e,.22,{metalness:.2,clearcoat:1,clearcoatRoughness:.06});
  const led=c=>new T.MeshBasicMaterial({color:c,toneMapped:false});

  const R=300,TAU=Math.PI*2,th=h=>(h-12)/24*TAU,at=(h,r,y)=>new T.Vector3(Math.sin(th(h))*r,y,-Math.cos(th(h))*r);
  function arc(r0,r1,hgt,h0,h1,m,y){const s=new T.Shape(),a=Math.PI/2-th(h0),b=Math.PI/2-th(h1);s.absarc(0,0,r1,a,b,true);s.absarc(0,0,r0,b,a,false);
    const g=new T.ExtrudeGeometry(s,{depth:hgt,bevelEnabled:true,bevelThickness:.8,bevelSize:.8,bevelSegments:2,curveSegments:96});const o=new T.Mesh(g,m);o.rotation.x=-Math.PI/2;o.position.y=y;o.castShadow=o.receiveShadow=true;return o}
  const L={extra:[led(0xff1f3a),led(0xff1f3a)],phone:led(0xff1f3a),eve:led(0x1a1a1d),cap:led(0x1a1a1d),tip:led(0xff1f3a)},extras=[],hands=[];
  function build(){
    const g=new T.Group();
    const prof=[[0,0],[R,0],[R+8,8],[R+8,38],[R+2,46],[R-22,46],[R-28,40],[0,40]].map(p=>new T.Vector2(p[0],p[1]));
    const shell=new T.Mesh(new T.LatheGeometry(prof,160),body);shell.castShadow=shell.receiveShadow=true;g.add(shell);
    const faceTex=texture(1024,1024,c=>{c.fillStyle='#0b0b0d';c.fillRect(0,0,1024,1024);c.translate(512,512);
      for(let i=0;i<96;i++){c.save();c.rotate(i/96*TAU);c.fillStyle='rgba(242,241,238,'+(i%4?.22:.5)+')';c.fillRect(-1,-470,2,i%4?12:22);c.restore()}
      c.strokeStyle='rgba(242,241,238,.12)';c.lineWidth=2;[150,300,392].forEach(r=>{c.beginPath();c.arc(0,0,r,0,TAU);c.stroke()})},true);
    const face=new T.Mesh(new T.CircleGeometry(R-28,160),new T.MeshPhysicalMaterial({map:faceTex,metalness:.2,roughness:.24,clearcoat:1,clearcoatRoughness:.06}));face.rotation.x=-Math.PI/2;face.position.y=40.2;face.receiveShadow=true;g.add(face);
    for(let h=0;h<24;h++){const big=h%6===0,b=new T.Mesh(new T.BoxGeometry(big?7:4,big?7:4,big?34:18),alloy);b.position.copy(at(h,R-52,40+(big?3.5:2)));b.rotation.y=-th(h);b.castShadow=true;g.add(b)}
    // the working day: a raised polished track from 7 AM to 5 PM, with the jobs on it
    g.add(arc(206,226,9,7,17,alloy,40));
    [8,10,13,15].forEach(h=>{const b=new T.Mesh(new T.BoxGeometry(16,8,16),graphite);b.position.copy(at(h,216,53));b.rotation.y=-th(h);b.castShadow=true;g.add(b)});
    [11.5,16.2].forEach((h,i)=>{const b=new T.Mesh(new T.BoxGeometry(16,8,16),L.extra[i]);b.position.copy(at(h,216,53));b.rotation.y=-th(h);b.userData.i=i;g.add(b);extras.push(b)});
    // time on the phone: lunch and the evening, on an inner track
    [[12,12.8],[17,21]].forEach(q=>{g.add(arc(150,170,5,q[0],q[1],graphite,40));const l=arc(156,164,2,q[0]+.08,q[1]-.08,L.phone,45.2);l.castShadow=false;g.add(l)});
    // the evening, on the outer track
    g.add(arc(206,226,5,17.25,22,graphite,40));const eve=arc(211,221,2,17.4,21.85,L.eve,45.2);eve.castShadow=false;g.add(eve);
    // hub and hand
    const hub=new T.Mesh(new T.CylinderGeometry(30,34,18,64),alloy);hub.position.y=49;hub.castShadow=true;g.add(hub);
    const cap=new T.Mesh(new T.CylinderGeometry(15,15,3,48),L.cap);cap.position.y=59.5;g.add(cap);
    const hand=new T.Group();hand.position.y=62;const bar=new T.Mesh(new T.BoxGeometry(5,4,150),alloy);bar.position.z=-70;bar.castShadow=true;const tip=new T.Mesh(new T.BoxGeometry(5,4.4,34),L.tip);tip.position.z=-162;hand.add(bar,tip);g.add(hand);hands.push(hand);
    for(let i=0;i<6;i++){const s=new T.Mesh(new T.CylinderGeometry(6,6,3,24),graphite);s.position.set(Math.sin(i/6*TAU+.26)*(R-10),46.6,Math.cos(i/6*TAU+.26)*(R-10));g.add(s)}
    return g}
  const rig=new T.Group();scene.add(rig);const unit=build();rig.add(unit);
  const mirror=build();mirror.scale.y=-1;mirror.position.y=-2;rig.add(mirror);
  const floor=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshBasicMaterial({color:0,transparent:true,opacity:.9,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.renderOrder=2;scene.add(floor);
  const red=new T.Color(0xff1f3a),dark=new T.Color(0x1a1a1d),white=new T.Color(0xf2f1ee);
  const YAW=[.5,-.35,-1.25,.1];let W=1,H=1,raf=0,vis=false,s=0,yaw=YAW[0],last=performance.now();const t0=last;
  function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(W,H,false);
    const a=W/H,hh=Math.max(228,330/a);camera.left=-hh*a;camera.right=hh*a;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();kick()}
  function frame(now){raf=0;const dt=Math.min(.05,(now-last)/1000);last=now;const t=RM?12:Math.max(0,(now-t0)/1000),k=RM?1:Math.min(1,dt*3.2);
    s+=(step-s)*k;yaw+=(YAW[Math.min(3,step)]-yaw)*(RM?1:Math.min(1,dt*2));
    rig.rotation.y=Math.PI/4+yaw+(RM?0:.07*Math.sin(t*.4));
    const c01=v=>v<0?0:v>1?1:v,on=c01(1-s*1.2),eveOn=c01(s-1),all=c01(s-2);
    extras.forEach(b=>{const i=b.userData.i,p=c01((t-.8-i*.5)*2);b.scale.setScalar(.2+.8*p);b.material.color.copy(red).multiplyScalar(.65+.35*Math.sin(t*3+i))});
    L.phone.color.copy(dark).lerp(red,on*(.78+.22*Math.sin(t*5)));
    L.eve.color.copy(dark).lerp(white,eveOn);L.cap.color.copy(dark).lerp(white,all);
    hands.forEach(h=>{h.rotation.y=-((t*.22)%TAU)});
    renderer.render(scene,camera);if(vis&&!RM)raf=requestAnimationFrame(frame)}
  kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};
  new ResizeObserver(size).observe(host);new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis){last=performance.now();kick()}}).observe(host);size();
}};
dispatchEvent(new Event('cinder-plate'));
