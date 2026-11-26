// The tour. A white studio display, angled, on a dark glossy floor. Scrolling turns it to face you, the display falls
// away and the screen stays, centered. Then five jobs it does on its own, each shown as small windows beside the screen.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

const sec=document.getElementById('tour');
if(sec){
  const pin=sec.querySelector('.tour-pin'),cv=sec.querySelector('.tour-cv'),scr=sec.querySelector('.tour-screen'),head=sec.querySelector('.tour-head');
  const imgs=[...scr.querySelectorAll('.cs main')],tabs=[...scr.querySelectorAll('.cs aside a')],caps=[...sec.querySelectorAll('.tour-caps article')],sets=[...sec.querySelectorAll('.sat-set')],btns=[...sec.querySelectorAll('.tour-nav button')];
  const cur=scr.querySelector('.cur'),rip=scr.querySelector('.rip'),prog=sec.querySelector('.tour-prog i'),nums=[...scr.querySelectorAll('[data-n]')];
  const REST=[[950,552],[944,902],[742,524],[806,650],[772,524]];
  const cs=scr.querySelector('.cs'),FOC=[[880,440,700],[640,50,640],[304,80,720],[726,400,830],[300,220,780]];
  const N=imgs.length,RM=false;

  const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setClearColor(0,0);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.18;r.outputColorSpace=T.SRGBColorSpace;
  r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(22,1,200,120000);
  RectAreaLightUniformsLib.init();
  // studio: a big soft top light, a front fill, two rim strips behind. Each has a matching reflection card.
  const studio=new T.Scene();studio.background=new T.Color(0x020203);
  for(const [x,y,z,w,h,i] of [[-600,2200,1600,2600,1400,2.6],[1800,300,1400,700,1800,1.5],[-2200,200,-900,300,2200,3.2],[2200,400,-1100,260,2200,2.6],[0,-500,2600,2600,900,1.9]]){
    const l=new T.RectAreaLight(0xf4f3f0,i,w,h);l.position.set(x,y,z);l.lookAt(0,0,0);scene.add(l);
    const m=new T.MeshBasicMaterial({color:0xf4f3f0});m.color.multiplyScalar(i);
    const c=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),m);c.position.set(x*.01,y*.01,z*.01);c.quaternion.copy(l.quaternion);c.rotateY(Math.PI);studio.add(c)}
  const pm=new T.PMREMGenerator(r);scene.environment=pm.fromScene(studio,.03).texture;pm.dispose();
  const key=new T.DirectionalLight(0xf4f3f0,1.1);key.position.set(-700,1900,1500);key.castShadow=true;key.shadow.mapSize.setScalar(2048);
  Object.assign(key.shadow.camera,{left:-1500,right:1500,top:1500,bottom:-1500,near:100,far:6000});key.shadow.bias=-.0003;key.shadow.normalBias=2;scene.add(key);

  const W=1600,H=1000,BZ=30,RAD=38,DEP=30,SZ=4.2,FLOOR=-946;
  const rr=(w,h,rad)=>{const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+rad,y);s.lineTo(x+w-rad,y);s.absarc(x+w-rad,y+rad,rad,-Math.PI/2,0);s.lineTo(x+w,y+h-rad);s.absarc(x+w-rad,y+h-rad,rad,0,Math.PI/2);s.lineTo(x+rad,y+h);s.absarc(x+rad,y+h-rad,rad,Math.PI/2,Math.PI);s.lineTo(x,y+rad);s.absarc(x+rad,y+rad,rad,Math.PI,Math.PI*1.5);return s};
  const alu=new T.MeshPhysicalMaterial({color:0xf1f1f1,metalness:.42,roughness:.34,clearcoat:.25,clearcoatRoughness:.4});
  const bezelM=new T.MeshPhysicalMaterial({color:0xf5f5f3,metalness:0,roughness:.22,clearcoat:1,clearcoatRoughness:.08});
  const scrM=new T.MeshBasicMaterial({color:0xf2f2f2,toneMapped:false});
  function display(){
    const g=new T.Group();
    const bodyG=new T.ExtrudeGeometry(rr(W+2*BZ+6,H+2*BZ+6,RAD+3),{depth:DEP,bevelEnabled:true,bevelThickness:3,bevelSize:3,bevelSegments:5,curveSegments:28});bodyG.translate(0,0,-DEP);
    const body=new T.Mesh(bodyG,alu);body.castShadow=true;g.add(body);
    const bez=new T.Mesh(new T.ShapeGeometry(rr(W+2*BZ,H+2*BZ,RAD),28),bezelM);bez.position.z=3.4;g.add(bez);
    const s=new T.Mesh(new T.ShapeGeometry(rr(W,H,10),8),scrM);s.position.z=SZ;
    // ShapeGeometry uvs are in shape units: remap to 0..1
    const uv=s.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/W+.5,uv.getY(i)/H+.5);g.add(s);
    const camDot=new T.Mesh(new T.CircleGeometry(5,24),new T.MeshBasicMaterial({color:0x111113}));camDot.position.set(0,H/2+BZ/2,SZ);g.add(camDot);
    const arm=new T.Mesh(new RoundedBoxGeometry(300,760,22,5,10),alu);arm.position.set(0,-570,-128);arm.rotation.x=.2;arm.castShadow=true;arm.receiveShadow=true;g.add(arm);
    const foot=new T.Mesh(new RoundedBoxGeometry(470,16,400,6,8),alu);foot.position.set(0,FLOOR+8,-70);foot.castShadow=true;foot.receiveShadow=true;g.add(foot);
    return g}
  const root=new T.Group();scene.add(root);root.add(display());
  const mirror=display();mirror.scale.y=-1;mirror.position.y=2*FLOOR;root.add(mirror);
  const floor=new T.Mesh(new T.PlaneGeometry(160000,160000),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.9,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=FLOOR;floor.renderOrder=2;root.add(floor);
  // the screen's light spilling onto the floor
  const gc=document.createElement('canvas');gc.width=gc.height=256;const gx=gc.getContext('2d'),gg=gx.createRadialGradient(128,128,0,128,128,128);gg.addColorStop(0,'rgba(255,255,255,.5)');gg.addColorStop(.5,'rgba(255,255,255,.12)');gg.addColorStop(1,'rgba(255,255,255,0)');gx.fillStyle=gg;gx.fillRect(0,0,256,256);
  const glow=new T.Mesh(new T.PlaneGeometry(3400,1500),new T.MeshBasicMaterial({map:new T.CanvasTexture(gc),transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(0,FLOOR+1,520);glow.renderOrder=3;root.add(glow);
  new T.TextureLoader().load(scr.dataset.tex,t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=r.capabilities.getMaxAnisotropy();scrM.map=t;scrM.color.set(0xffffff);scrM.needsUpdate=true;kick()});

  let vw=1,vh=1,raf=0,narrow=false,step=-1,F={x:0,y:0,w:1,h:1};
  const C=v=>v<0?0:v>1?1:v,ease=x=>{x=C(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2},lerp=(a,b,t)=>a+(b-a)*t,TAN=Math.tan(T.MathUtils.degToRad(11));
  function layout(){
    if(narrow){const w=vw-24,h=w*.78;F={x:12,y:196,w,h}}
    else{const top=214,bot=96,availH=vh-top-bot;let w=Math.min(vw*.56,1120),h=w*.625;if(h>availH){h=availH;w=h/.625}F={x:(vw-w)/2,y:top+(availH-h)/2,w,h}}
    step=-1}
  function size(){const b=pin.getBoundingClientRect();vw=b.width;vh=b.height;narrow=vw<860;r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.setSize(vw,vh,false);cam.aspect=vw/vh;cam.updateProjectionMatrix();layout();kick()}
  const v=new T.Vector3();
  function project(){root.updateMatrixWorld();cam.updateMatrixWorld();const p=[[-W/2,H/2],[W/2,-H/2]].map(([x,y])=>{v.set(x,y,SZ).applyMatrix4(root.matrixWorld).project(cam);return [(v.x+1)/2*vw,(1-v.y)/2*vh]});return {x:p[0][0],y:p[0][1],w:p[1][0]-p[0][0],h:p[1][1]-p[0][1]}}
  function place(el,R){el.style.transform=`translate(${R.x}px,${R.y}px)`;el.style.width=R.w+'px';el.style.height=R.h+'px';el.style.setProperty('--s',R.w/1600)}
  function zoom(k){if(narrow&&wasTour&&k>=0){const f=FOC[k],z=F.w/f[2];cs.style.transition=RM?'none':'transform .9s cubic-bezier(.2,.8,.2,1)';cs.style.transform=`translate(${-f[0]*z}px,${-f[1]*z}px) scale(${z})`}else{cs.style.transition='none';cs.style.transform=''}}
  function sats(k){const set=sets[k];if(!set)return;const l=set.querySelector('.l'),rt=set.querySelector('.r');
    if(narrow){if(rt){rt.style.left='22px';rt.style.top=(F.y+10)+'px';rt.style.width=(vw-44)+'px';rt.style.translate=''}
      if(l){l.style.display='';l.style.left='12px';l.style.top=(F.y+F.h+16)+'px';l.style.width=(vw-24)+'px';l.style.translate='';if(F.y+F.h+16+l.offsetHeight>vh-58)l.style.display='none'}}
    else{const lw=Math.min(300,Math.max(250,vw*.2)),rw=Math.min(310,Math.max(270,vw*.22)),ov=Math.max(40,Math.min(84,F.w*.1));
      if(l){l.style.display='';l.style.width=lw+'px';l.style.left=Math.max(16,F.x-lw+ov)+'px';l.style.top=(F.y+F.h*.14)+'px'}
      if(rt){rt.style.width=rw+'px';rt.style.left=Math.min(vw-rw-16,F.x+F.w-24)+'px';rt.style.top=(F.y+F.h*(l?.5:.16))+'px'}}}
  let tok=0,shown=-1,wasTour=false;
  function moveCur(x,y,d){cur.style.setProperty('--cd',d+'s');cur.style.transform=`translate(${x}px,${y}px)`}
  function click(x,y){rip.style.setProperty('--at',`translate(${x}px,${y}px)`);rip.classList.remove('go');void rip.offsetWidth;rip.classList.add('go')}
  function count(){if(RM)return;const t0=performance.now();(function f(now){const e=1-Math.pow(1-Math.min(1,(now-t0)/1100),3);nums.forEach(el=>{el.textContent=(el.dataset.pre||'')+Math.round(+el.dataset.n*e).toLocaleString('en-US')+(el.dataset.suf||'')});if(e<1)requestAnimationFrame(f)})(t0)}
  function apply(k){shown=k;imgs.forEach((im,i)=>im.classList.toggle('on',i===k));tabs.forEach((a,i)=>a.classList.toggle('on',i===k));sets.forEach((x,i)=>x.classList.toggle('on',i===k));sats(k);zoom(k);if(k===0&&wasTour)count()}
  function change(k,anim){caps.forEach((c,i)=>c.classList.toggle('on',i===k));btns.forEach((x,i)=>x.setAttribute('aria-current',i===k?'step':'false'));
    const my=++tok,tb=tabs[k],tx=150,ty=tb.offsetTop+tb.offsetHeight/2-4;
    if(!anim||RM){apply(k);moveCur(REST[k][0],REST[k][1],0);return}
    moveCur(tx,ty,.42);
    setTimeout(()=>{if(my!==tok)return;click(tx,ty);apply(k);setTimeout(()=>{if(my===tok)moveCur(REST[k][0],REST[k][1],1.1)},700)},430)}
  function draw(){
    raf=0;const b=sec.getBoundingClientRect(),len=b.height-vh,t=C((vh-b.top)/(vh+len));
    const A=ease(C((t-.03)/.2)),B=ease(C((t-.235)/.06)),S=C((t-.31)/.67);
    const f=lerp(narrow?.74:.36,F.w/vw,A),d=W/(f*2*TAN*cam.aspect);
    root.rotation.y=lerp(-.48,0,A);
    const cy=-((vh-2*(F.y+F.h/2))/vh)*d*TAN,y0=narrow?-300:-150;
    cam.position.set(lerp(-200,0,A),lerp(260+y0,cy,A),d);cam.lookAt(lerp(40,0,A),lerp(y0,cy,A),0);
    if(t<.3)r.render(scene,cam);
    const P=project(),done=A>=.999;
    cv.style.opacity=1-B;scr.style.opacity=done?1:0;scr.classList.toggle('flat',B>.5);
    place(scr,done?{x:lerp(P.x,F.x,B),y:lerp(P.y,F.y,B),w:lerp(P.w,F.w,B),h:lerp(P.h,F.h,B)}:P);
    head.style.opacity=1-C((A-.55)/.35);head.style.transform=`translateY(${-A*18}px)`;
    const touring=B>.9;sec.classList.toggle('touring',touring);
    const k=Math.min(N-1,Math.floor(S*N));
    if(touring&&!wasTour){wasTour=true;zoom(shown);if(k===0)count()}else if(!touring&&wasTour){wasTour=false;zoom(-1)}
    if(k!==step){const anim=touring&&step>=0;step=k;change(k,anim)}
    prog.style.setProperty('--p',S.toFixed(4));
    if(!narrow&&shown>=0){const u=S*N-step,set=sets[shown],l=set.querySelector('.l'),rt=set.querySelector('.r');if(l)l.style.translate=`0 ${((.5-u)*34).toFixed(1)}px`;if(rt)rt.style.translate=`0 ${((u-.5)*34).toFixed(1)}px`}
  }
  function kick(){if(!raf)raf=requestAnimationFrame(draw)}
  btns.forEach((x,i)=>x.addEventListener('click',()=>{const b=sec.getBoundingClientRect(),len=b.height-vh,tt=.31+(i+.5)/N*.67;scrollTo({top:scrollY+b.top+tt*(vh+len)-vh,behavior:RM?'auto':'smooth'})}));
  addEventListener('scroll',kick,{passive:true});new ResizeObserver(size).observe(pin);size();
  window.__tourDraw=draw;
}
