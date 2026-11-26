import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const tau = Math.PI * 2;
const clamp = T.MathUtils.clamp;

function ease(t,a,b) {
  const x = clamp((t-a)/(b-a),0,1);
  return x*x*(3-2*x);
}

function group(parent) {
  const result = new T.Group();
  parent.add(result);
  return result;
}

let instance, generation=0, requested=0;

function destroy() {
  generation++;
  instance?.dispose();
  instance=null;
  requested=0;
}

async function mount(el) {
  if (!(el instanceof Element)) throw new TypeError('mount requires a container');
  const firstProgress=requested;
  destroy();
  requested=firstProgress;
  const token=generation;
  await document.fonts.ready;
  if(token!==generation) return;
  instance=create(el);
  instance.go(requested);
}

function setProgress(n) {
  if(!Number.isFinite(n)) return;
  n=clamp(n,0,1);
  requested=n;
  instance?.go(n);
}

window.CinderBack=Object.freeze({mount,setProgress,destroy});

function create(el) {
  const renderer=new T.WebGLRenderer({
    alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'high-performance'
  });
  const canvas=renderer.domElement;
  canvas.style.cssText='display:block;width:100%;height:100%';
  canvas.setAttribute('role','img');
  el.append(canvas);

  const ratio=Math.min(devicePixelRatio,2);
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0,0);
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;

  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug&&/swiftshader|llvmpipe/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
  const lite=software||matchMedia('(max-width:700px),(pointer:coarse)').matches
    || navigator.deviceMemory<=4 || !renderer.capabilities.isWebGL2;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(18,1,.1,70);
  const focus=new T.Vector3(0,.80,0);
  const sight=new T.Vector3(3,3.1,10).normalize();

  const envScene=new T.Scene();
  envScene.background=new T.Color('#A3A19D').multiplyScalar(.78);
  RectAreaLightUniformsLib.init();
  const lamps=[];
  for(const [x,y,z,w,h,power] of [
    [-3,5,4,6,4,4.5],[4,2,2,1.4,5,6],[-1,4,-3,5,1.5,8]
  ]) {
    const panel=new T.Mesh(
      new T.PlaneGeometry(w,h),
      new T.MeshBasicMaterial({color:new T.Color().setScalar(power),side:T.DoubleSide})
    );
    panel.position.set(x,y,z);
    panel.lookAt(focus);
    envScene.add(panel);
    const light=new T.RectAreaLight(0xffffff,power,w,h);
    light.position.copy(panel.position);
    light.lookAt(focus);
    scene.add(light);
    lamps.push(light);
  }
  const pmrem=new T.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(envScene,.025);
  scene.environment=environment.texture;
  renderer.shadowMap.autoUpdate=false;
  envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
  pmrem.dispose();

  const key=new T.DirectionalLight('#F2F1EE',2);
  key.position.set(-3,6,4);
  scene.add(key);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});
  key.shadow.normalBias=.008;
  key.shadow.bias=-.00025;

  const textures=new Set(), materials=new Set();

  function texture(w,h,draw) {
    const c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    draw(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);
    tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
    tex.colorSpace=T.SRGBColorSpace;
    textures.add(tex);
    return tex;
  }

  const grain=texture(512,256,(ctx,w,h)=>{
    let seed=19;
    const random=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
    ctx.fillStyle='#a3a19d';
    ctx.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){
      ctx.fillStyle=random()>.5?'rgba(242,241,238,.13)':'rgba(28,28,31,.10)';
      ctx.fillRect(random()*w,random()*h,6+random()*90,.5);
    }
  });
  grain.colorSpace=T.NoColorSpace;
  grain.wrapS=grain.wrapT=T.RepeatWrapping;

  function mat(color,metalness,roughness,extra={}) {
    const m=new T.MeshPhysicalMaterial({color,metalness,roughness,...extra});
    materials.add(m);
    return m;
  }
  const alloy=mat('#77767C',.78,.45,{
    anisotropy:.55,clearcoat:.13,roughnessMap:grain,bumpMap:grain,bumpScale:.0015
  });
  const steel=mat('#A3A19D',.93,.24);
  const graphite=mat('#2A2A2F',.72,.34,{roughnessMap:grain,bumpMap:grain,bumpScale:.0015});
  const rubber=mat('#111113',.01,.88);
  const smoked=mat('#0D0D10',.35,.21,{clearcoat:.55});
  const flagRed=mat('#E5172F',.47,.27);
  const lamp=mat('#2A0A0F',.24,.23,{emissive:'#FF3B30'});
  const ringLamp=lamp.clone();
  materials.add(ringLamp);

  function mesh(parent,geo,m,x=0,y=0,z=0) {
    const o=new T.Mesh(geo,m);
    o.position.set(x,y,z);
    parent.add(o);
    o.castShadow=true;
    o.receiveShadow=true;
    return o;
  }
  function box(p,m,w,h,d,x,y,z,r=.04) {
    return mesh(p,new RoundedBoxGeometry(w,h,d,4,Math.min(r,w/2,h/2,d/2)),m,x,y,z);
  }
  function disk(p,m,r,depth,x,y,z) {
    const o=mesh(p,new T.CylinderGeometry(r,r,depth,64),m,x,y,z);
    o.rotation.x=Math.PI/2;
    return o;
  }
  function torus(p,m,r,tube,x,y,z) {
    return mesh(p,new T.TorusGeometry(r,tube,10,80),m,x,y,z);
  }
  function legend(p,value,w,h,x,y,z,color='#F2F1EE') {
    const map=texture(2048,Math.max(64,Math.round(2048*h/w)),(c,W,H)=>{
      c.fillStyle=color;
      c.textAlign='center';
      c.textBaseline='middle';
      c.font='500 '+Math.floor(H*.82)+'px "Geist Mono",monospace';
      c.fillText(value,W/2,H*.53,W*.97);
    });
    const m=mat('#F2F1EE',.12,.62,{
      map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
    });
    const o=mesh(p,new T.PlaneGeometry(w,h),m,x,y,z);
    o.castShadow=false;
    return o;
  }

  const base=group(scene);
  box(base,rubber,3.77,.12,1.51,0,-.30,0,.055);
  box(base,graphite,3.98,.35,1.67,0,-.135,0,.11);
  box(base,rubber,3.94,.037,1.63,0,.049,0,.018);
  box(base,alloy,4,.12,1.69,0,.122,0,.057);
  box(base,graphite,3.55,.037,1.22,0,.191,-.04,.018);
  legend(base,'EXAMPLE BUSINESS · SAMPLE DATA',2.88,.174,-.08,-.123,.839);
  disk(base,steel,.076,.018,1.64,-.115,.834);
  disk(base,lamp,.049,.020,1.64,-.115,.85);

  function fasteners(points) {
    const parts=[
      [new T.CylinderGeometry(.067,.067,.014,28),rubber,.179],
      [new T.CylinderGeometry(.049,.051,.015,28),steel,.187],
      [new T.BoxGeometry(.057,.003,.010),rubber,.196],
      [new T.BoxGeometry(.010,.003,.057),rubber,.196]
    ];
    for(const [geo,m,y] of parts){
      const batch=new T.InstancedMesh(geo,m,points.length);
      const dummy=new T.Object3D();
      points.forEach(([x,z],i)=>{
        dummy.position.set(x,y,z);
        dummy.rotation.y=.45+i*.7;
        dummy.updateMatrix();
        batch.setMatrixAt(i,dummy.matrix);
      });
      base.add(batch);
    }
  }
  fasteners([[-1.85,.65],[1.85,.65],[-1.85,-.65],[1.85,-.65]]);
  for(let i=0;i<5;i++)box(base,rubber,.032,.11,.012,-1.84+i*.056,-.14,.834,.006);

  const counter=group(scene),phone=group(scene),clock=group(scene);
  box(counter,graphite,2.75,1.43,.85,0,.74,0,.13);
  box(counter,alloy,2.78,1.44,.21,0,.75,.35,.10);
  box(counter,rubber,2.39,1.01,.11,0,.83,.45,.054);
  box(counter,smoked,2.30,.94,.10,0,.83,.49,.049);

  // The aperture exposes a curved sector of each continuous ten-digit band.
  const drums=[];
  for(let i=0;i<3;i++){
    const map=texture(512,4096,(c,w,h)=>{
      c.fillStyle='#1C1C1F';
      c.fillRect(0,0,w,h);
      c.textAlign='center';
      c.textBaseline='middle';
      c.font='600 336px Inter,sans-serif';
      for(let n=0;n<10;n++){
        c.fillStyle='#F2F1EE';
        c.fillText(String(n),w/2,(n+.51)*h/10);
        c.fillStyle='#3A3A40';
        c.fillRect(20,(n+.98)*h/10,w-40,2);
      }
    });
    map.wrapT=T.RepeatWrapping;
    const g=new T.PlaneGeometry(.657,.81,1,28);
    const pos=g.attributes.position,uv=g.attributes.uv;
    for(let k=0;k<pos.count;k++){
      const u=uv.getY(k)-.5,a=u*1.42;
      pos.setY(k,Math.sin(a)*.62);
      pos.setZ(k,(Math.cos(a)-1)*.62);
      uv.setY(k,u*.110);
    }
    g.computeVertexNormals();
    mesh(counter,g,mat('#F2F1EE',.24,.41,{map}),(i-1)*.714,.83,.682);
    drums.push(map);
  }
  legend(counter,'J O B S',.73,.13,0,.208,.463);
  box(counter,rubber,.37,.025,.135,.89,1.47,.03,.01);
  const flag=group(counter);
  box(flag,steel,.045,.26,.05,.76,.09,.03,.015);
  box(flag,flagRed,.30,.17,.075,.88,.22,.03,.025);

  box(phone,alloy,2.84,.42,1.06,0,.24,0,.11);
  box(phone,smoked,1.67,.24,.04,0,.25,.535,.018);
  legend(phone,'0 CALLBACKS',1.49,.188,0,.25,.557);
  const handset=group(phone);
  for(const x of [-1,1]){
    box(phone,graphite,.49,.48,.61,x,.65,0,.09);
    box(phone,rubber,.55,.10,.61,x,.885,0,.045);
    box(handset,graphite,.72,.49,.81,x,1.17,0,.18);
    box(handset,smoked,.65,.19,.74,x,.98,.002,.09);
    for(let i=0;i<5;i++)box(handset,rubber,.033,.105,.015,x+(i-2)*.078,1.14,.401,.007);
  }

  // The grip flares into the earpieces and arches clear of the cradle.
  const verts=[],indices=[],uvs=[];
  for(let i=0;i<=40;i++){
    const x=i/20-1;
    for(let j=0;j<=32;j++){
      const a=j*tau/32;
      verts.push(
        x*1.10,
        1.28+.19*(1-x*x)+Math.cos(a)*(.13+.055*x*x),
        Math.sin(a)*(.22+.095*x*x)
      );
      uvs.push(i/40,j/32);
      if(i<40&&j<32){
        const k=i*33+j;
        indices.push(k,k+1,k+33,k+1,k+34,k+33);
      }
    }
  }
  const grip=new T.BufferGeometry();
  grip.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  grip.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  grip.setIndex(indices);
  grip.computeVertexNormals();
  mesh(handset,grip,graphite);
  box(phone,ringLamp,.37,.039,.026,1,.735,.311,.013);

  box(clock,graphite,1.28,.17,.79,0,.095,0,.07);
  box(clock,alloy,.50,.44,.36,0,.28,-.12,.09);
  const dial=group(clock);
  dial.position.set(0,1.06,0);
  disk(dial,graphite,.91,.36,0,0,0);
  torus(dial,steel,.848,.065,0,0,.175);
  const faceTex=texture(1536,1536,(c,w,h)=>{
    c.fillStyle='#F2F1EE';
    c.fillRect(0,0,w,h);
    c.translate(w/2,h/2);
    for(let i=0;i<60;i++){
      c.save();
      c.rotate(i*tau/60);
      c.fillStyle='#2A2A2F';
      c.fillRect(i%5?-2:-6,-704,i%5?4:12,i%5?26:65);
      c.restore();
    }
    c.font='600 150px Inter,sans-serif';
    c.textAlign='center';
    c.textBaseline='middle';
    c.fillStyle='#1C1C1F';
    for(let i=1;i<=12;i++)c.fillText(i,Math.sin(i*tau/12)*535,-Math.cos(i*tau/12)*535);
    c.font='500 47px "Geist Mono",monospace';
    c.fillText('C I N D E R',0,-247);
  });
  const faceMat=mat('#F2F1EE',.10,.61,{map:faceTex});
  mesh(dial,new T.CircleGeometry(.825,96),faceMat,0,0,.198);
  const hands=[];
  for(const [len,width,m,z] of [
    [.405,.061,graphite,.225],[.626,.043,graphite,.255],[.679,.012,flagRed,.28]
  ]){
    const pivot=group(dial);
    box(pivot,m,width,len+.11,.019,0,(len-.11)/2,z,.009);
    hands.push(pivot);
  }
  disk(dial,steel,.059,.033,0,0,.304);
  disk(dial,graphite,.026,.018,0,0,.33);

  // Batch rigid pieces within each moving coordinate system.
  for(const parent of [base,counter,flag,phone,handset,clock,dial]){
    const batches=new Map();
    for(const o of [...parent.children]){
      if(!o.isMesh||o.isInstancedMesh||o.material.transparent)continue;
      const list=batches.get(o.material)||[];
      list.push(o);
      batches.set(o.material,list);
    }
    for(const [m,list] of batches){
      if(list.length<2)continue;
      const parts=list.map(o=>{
        o.updateMatrix();
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
        g.applyMatrix4(o.matrix);
        o.geometry.dispose();
        o.removeFromParent();
        return g;
      });
      mesh(parent,mergeGeometries(parts),m);
      parts.forEach(g=>g.dispose());
    }
  }

  // Parts travelling below the deck disappear at its throat.
  renderer.localClippingEnabled=true;
  const deckLip=[new T.Plane(new T.Vector3(0,1,0),-.202)];
  const moduleFinishes=new Map();
  for(const module of [counter,phone,clock])module.traverse(o=>{
    if(!o.isMesh)return;
    const finish=o.material;
    if([alloy,graphite,rubber,steel,smoked].includes(finish)){
      if(!moduleFinishes.has(finish)){
        const copy=finish.clone();
        materials.add(copy);
        moduleFinishes.set(finish,copy);
      }
      o.material=moduleFinishes.get(finish);
    }
    o.material.clippingPlanes=deckLip;
    o.material.clipShadows=true;
  });
  const pads=[-1.17,0,1.19].map(x=>box(scene,rubber,1.06,.045,.63,x,.220,.01,.022));

  const composer=new EffectComposer(renderer);
  composer.renderToScreen=false;
  composer.addPass(new RenderPass(scene,camera));
  let ao;
  if(!lite){
    ao=new GTAOPass(scene,camera,1,1);
    ao.blendIntensity=.21;
    ao.updateGtaoMaterial({radius:.22,samples:8});
    composer.addPass(ao);
  }
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(1,1));

  const history=lite?[]:[0,1].map(()=>new T.WebGLRenderTarget(1,1,{
    type:T.HalfFloatType,depthBuffer:false
  }));
  const resolve=new T.ShaderMaterial({
    uniforms:{current:{value:null},previous:{value:null},weight:{value:1}},
    vertexShader:`
      varying vec2 q;
      void main(){
        q=uv;
        gl_Position=vec4(position.xy,0.,1.);
      }`,
    fragmentShader:`
      varying vec2 q;
      uniform sampler2D current,previous;
      uniform float weight;
      void main(){
        vec4 c=texture2D(current,q);
        if(weight<1.)c=mix(texture2D(previous,q),c,weight);
        gl_FragColor=c;
      }`,
    depthTest:false,depthWrite:false,blending:T.NoBlending
  });
  const quad=new FullScreenQuad(resolve);
  let width=1,height=1,samples=0;

  function render(still){
    const accumulate=still&&!lite;
    if(accumulate){
      const x=(samples%4+.5)/4-.5;
      const y=(Math.floor(samples/4)+.5)/4-.5;
      camera.setViewOffset(width,height,x/ratio,y/ratio,width,height);
    }
    composer.render();
    if(accumulate)camera.clearViewOffset();
    resolve.uniforms.current.value=composer.readBuffer.texture;
    resolve.uniforms.weight.value=1;
    if(accumulate){
      const out=history[samples%2],prior=history[1-samples%2];
      resolve.uniforms.previous.value=prior.texture;
      resolve.uniforms.weight.value=1/(samples+1);
      renderer.setRenderTarget(out);
      quad.render(renderer);
      resolve.uniforms.current.value=out.texture;
      resolve.uniforms.weight.value=1;
      samples++;
    }
    renderer.setRenderTarget(null);
    quad.render(renderer);
  }

  // All story poses and the LED envelope are functions of this single time coordinate.
  const stops=[.84,1.48,2.12,3.17];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let p=0,target=0,previousTime=0,idle=0;
  let frame=0,timer=0,visible=true,lost=false,disposed=false,dirty=true;

  function pose(t,life){
    const retract=ease(t,.72,1.10),lift=ease(t,.90,1.25);
    // Each incoming module begins its lift before the outgoing one finishes sinking.
    const lower=ease(t,1.48,1.82),rise=ease(t,1.36,1.82);
    const dock=ease(t,1.98,2.42);
    const counterIn=ease(t,2.10,2.46),phoneIn=ease(t,2.24,2.60);

    function place(o,size,x,z,raised,isVisible){
      o.visible=isVisible;
      o.scale.setScalar(size);
      o.position.set(x,.209+raised,z);
    }

    if(t<=2.12){
      place(counter,1-.50*retract,0,-.19*retract,-1.70*retract,retract<1);
      place(phone,.62+.38*lift-.32*lower,0,-.24*(1-lift+lower),
        -1.68*(1-lift+lower),lift>0&&lower<1);
    }else{
      const counterLift=ease(t,2.24,2.46),phoneLift=ease(t,2.40,2.62);
      place(counter,.424,-1.53+.36*counterIn,-.26+.31*counterIn,
        -.84*(1-counterLift)+.079*counterLift*(1-counterIn),counterIn>0);
      place(phone,.419,-.20+.20*phoneIn,-.49+.52*phoneIn,
        -.71*(1-phoneLift)+.095*phoneLift*(1-phoneIn),phoneIn>0);
    }
    place(clock,.73+.27*rise-.445*dock,1.19*dock,-.19*(1-rise),
      -1.64*(1-rise)+.11*Math.sin(Math.PI*dock),rise>0);

    [counterIn,phoneIn,dock].forEach((travel,i)=>{
      const pad=pads[i];
      pad.visible=travel>0;
      const contact=ease(travel,.70,.92);
      pad.scale.set(travel,travel*(1-.20*contact),travel);
      pad.position.y=.202+.0225*pad.scale.y-.006*contact;
    });

    clock.rotation.x=-.85*(1-rise);
    const clicks=7*clamp((t-.045)/.66,0,1);
    const lastDigit=2+Math.floor(clicks)+ease(clicks%1,.10,.92);
    [0,1,lastDigit].forEach((n,i)=>{drums[i].offset.y=1-(n+.5)/10});
    flag.position.y=1.19+.28*ease(t,.71,.83)*(1-ease(t,.84,.96));
    flag.visible=flag.position.y>1.195;

    const ring=ease(t,1.13,1.22)*(1-ease(t,1.32,1.47));
    const seatPulse=Math.max(
      ease(t,.78,.84)*(1-ease(t,.84,.92)),
      ease(t,1.42,1.48)*(1-ease(t,1.48,1.56)),
      ease(t,2.06,2.12)*(1-ease(t,2.12,2.20))
    );
    ringLamp.emissiveIntensity=Math.max(ring*1.1,seatPulse*1.35);
    handset.position.x=.020*ring*Math.sin(t*135);
    handset.rotation.z=.014*ring*Math.sin(t*135);

    const sweep=ease(t,1.80,2.12);
    const minutes=268+32*sweep;
    hands[0].rotation.z=-tau*minutes/720;
    hands[1].rotation.z=-tau*minutes/60;
    hands[2].rotation.z=-tau*(48+sweep*12)/60;
    faceMat.color.setRGB(1,1-.032*sweep,1-.08*sweep);

    // Last seat at 2.77. No mechanical movement through the pause or breath.
    const ignition=ease(t,2.91,3.06);
    lamp.emissiveIntensity=.81*ignition+.55*ignition*(1-ease(t,3.06,3.17));
    const cycle=life%7.6;
    lamps[0].position.x=-3+(cycle>6.3 ? .38*Math.sin(Math.PI*(cycle-6.3)/1.3)**2 : 0);
  }

  function cancel(){
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame=timer=0;
  }
  function wake(){
    if(disposed||lost||document.hidden||!visible||!el.clientWidth||!el.clientHeight)return;
    clearTimeout(timer);
    timer=0;
    if(!frame)frame=requestAnimationFrame(tick);
  }
  function tick(now){
    frame=0;
    if(gl.isContextLost())return;
    const moving=p!==target;
    if(moving){
      p=target;
      samples=0;
      idle=0;
    }
    // The pose is scroll-scrubbed only. No idle timer may advance the model.
    const life=0;
    const changed=dirty||moving||samples===0;

    if(changed){
      samples=0;
      renderer.shadowMap.needsUpdate=moving||dirty;
      pose(p,life);
      render(false);
      dirty=false;
    }else if(!lite&&samples<16){
      render(true);
    }
    if(p!==target){
      wake();
      return;
    }
    // Only continue while the still-frame accumulation is converging.
    if(!lite&&samples<16)timer=setTimeout(wake,1000/30);
  }
  function resize(){
    width=Math.max(1,el.clientWidth);
    height=Math.max(1,el.clientHeight);
    renderer.setSize(width,height,false);
    composer.setSize(width,height);
    history.forEach(rt=>rt.setSize(Math.floor(width*ratio),Math.floor(height*ratio)));
    camera.aspect=width/height;
    const span=Math.max(2.76,4.98/camera.aspect);
    const distance=span/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
    camera.position.copy(focus).addScaledVector(sight,distance);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    dirty=true;
    samples=0;
    wake();
  }
  function suspend(){cancel()}
  function visibility(){if(document.hidden||!visible)suspend();else wake()}
  function preference(){idle=0;dirty=true;wake()}

  let released=false;
  function release(){
    if(released)return;
    released=true;
    scene.traverse(o=>{
      o.geometry?.dispose();
      if(o.isInstancedMesh)o.dispose();
    });
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
    key.shadow.dispose();
    composer.passes.forEach(pass=>pass.dispose());
    ao?.gtaoMaterial.dispose();
    ao?.blendMaterial.dispose();
    composer.dispose();
    history.forEach(rt=>rt.dispose());
    quad.dispose();
    resolve.dispose();
    environment.dispose();
    renderer.dispose();
  }
  function onLost(e){
    e.preventDefault();
    lost=true;
    suspend();
    release();
  }
  function restore(){
    if(!disposed)mount(el).catch(console.error);
  }
  const ro=new ResizeObserver(resize);
  ro.observe(el);
  const io=new IntersectionObserver(entries=>{
    visible=entries.at(-1).isIntersecting;
    visibility();
  });
  io.observe(el);
  document.addEventListener('visibilitychange',visibility);
  reduced.addEventListener('change',preference);
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',restore);
  resize();

  return {
    go(n){
      const position=n*3,index=Math.min(2,Math.floor(position));
      target=T.MathUtils.lerp(stops[index],stops[index+1],position-index);
      canvas.setAttribute('aria-label',['Job counter','Handset in cradle','Clock at five','Three instruments docked'][Math.round(position)]+'. Example business, sample data.');
      wake();
    },
    dispose(){
      disposed=true;
      suspend();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange',visibility);
      reduced.removeEventListener('change',preference);
      canvas.removeEventListener('webglcontextlost',onLost);
      canvas.removeEventListener('webglcontextrestored',restore);
      release();
      if(!lost)renderer.forceContextLoss();
      canvas.remove();
    }
  };
}

window.dispatchEvent(new Event('cinder-back'));
window.dispatchEvent(new Event('cinder-visual'));
