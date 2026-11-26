// V4 call slab: four-key console. API: mount(el), setStep(n), destroy(); el.onStepClick(i).
const copy=[
  ['MISSED CALL','(303) 555-0148','7:42 PM','RINGING'],
  ['REPLIED IN 10S','Text sent to Dana Ruiz','7:42 PM','REPLIED'],
  ['ESTIMATE BOOKED','Thu 9:00 AM · 41 Aspen Ct','7:51 PM','BOOKED'],
  ['REMINDER QUEUED','Text the night before','WED 6:00 PM','REMINDER SET']
];
const clamp=x=>Math.max(0,Math.min(1,x));
function ease(x,a,b){
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
}

let instance=null,step=0,fonts;
function loadFonts(){
  // The site already self-hosts Inter and Geist Mono; wait for them instead of fetching copies.
  return fonts??=Promise.allSettled([document.fonts.load('600 32px Inter'),document.fonts.load('500 32px "Geist Mono"')]);
}

function mount(el){
  instance?.destroy();
  const frame=document.createElement('div');
  frame.style.cssText='position:relative;width:100%;height:100%;overflow:hidden';
  el.append(frame);

  let dead=false,raf=0,renderer,live=false,reset=true,run=()=>{};
  let hover=-1,tx=0,tz=0,last=0;
  const rm=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const resources=new Set(),off=[];
  const own=x=>(resources.add(x),x);

  function on(node,name,fn){
    node.addEventListener(name,fn);
    off.push(()=>node.removeEventListener(name,fn));
  }
  function wake(){
    if(!dead&&live&&!document.hidden&&!raf){
      raf=requestAnimationFrame(t=>{raf=0;run(t)});
    }
  }
  function invalidate(){if(!raf)last=0;reset=true;wake()}
  function pause(){cancelAnimationFrame(raf);raf=0;last=0;wake()}
  const io=new IntersectionObserver(([entry])=>{live=entry.isIntersecting;pause()});
  const ro=new ResizeObserver(invalidate);
  io.observe(el);ro.observe(el);
  on(document,'visibilitychange',pause);
  on(rm,'change',invalidate);

  function destroy(){
    dead=true;
    cancelAnimationFrame(raf);
    io.disconnect();ro.disconnect();
    off.forEach(f=>f());
    resources.forEach(r=>r.dispose());
    renderer?.dispose();renderer?.forceContextLoss();
    frame.remove();
  }
  instance={destroy,invalidate};
  const session=instance;

  async function build(){
    const [T,{RectAreaLightUniformsLib},{GTAOPass},{SMAAPass},{FullScreenQuad}]=await Promise.all([
      import('three'),
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
      import('three/addons/postprocessing/GTAOPass.js'),
      import('three/addons/postprocessing/SMAAPass.js'),
      import('three/addons/postprocessing/Pass.js')
    ]);
    if(dead)return;

    renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    const canvas=renderer.domElement;
    canvas.style.cssText='position:absolute;width:100%;height:100%;inset:0;display:block';
    canvas.setAttribute('aria-label','Cinder four-key call console');
    frame.append(canvas);
    on(canvas,'webglcontextlost',e=>{
      e.preventDefault();cancelAnimationFrame(raf);raf=0;run=()=>{};
    });
    on(canvas,'webglcontextrestored',()=>{if(!dead)mount(el)});
    renderer.setClearColor(0,0);
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;

    const scene=new T.Scene(),unit=new T.Group();
    const camera=new T.PerspectiveCamera(35,1,2,5000);
    scene.add(unit);
    camera.position.set(33,820,353);camera.lookAt(0,0,0);camera.updateMatrixWorld();

    const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'';
    const lite=matchMedia('(pointer:coarse)').matches||
      !renderer.extensions.has('EXT_color_buffer_float')||
      /swiftshader|llvmpipe|adreno|mali|intel.*uhd/i.test(gpu);

    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;

    // The unit's three studio cards, repositioned for the shallower camera.
    RectAreaLightUniformsLib.init();
    const studio=new T.Scene();
    studio.background=new T.Color(0);
    for(const [x,y,z,w,h,power] of [
      [-230,560,-115,620,490,4.1],
      [-375,-140,360,310,680,2.65],
      [350,-100,-345,145,650,2.05]
    ]){
      const light=new T.RectAreaLight(0xf2f1ee,power*.52,w,h);
      light.position.set(x*1.35,y,z-150);light.lookAt(0,0,0);scene.add(light);
      const m=new T.MeshBasicMaterial({color:0xf2f1ee});
      m.color.multiplyScalar(power);
      const card=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),m);
      card.position.copy(light.position).multiplyScalar(.01);
      card.quaternion.copy(light.quaternion);card.rotateY(Math.PI);studio.add(card);
    }
    const pm=new T.PMREMGenerator(renderer);
    scene.environment=own(pm.fromScene(studio,.015)).texture;
    pm.dispose();
    studio.children.forEach(o=>{o.geometry.dispose();o.material.dispose()});

    const sun=new T.DirectionalLight(0xf2f1ee,1.9);
    sun.position.set(-385,820,350);sun.castShadow=true;scene.add(sun);
    Object.assign(sun.shadow.camera,{left:-235,right:235,top:235,bottom:-235,near:390,far:1400});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.setScalar(lite?2048:4096);
    sun.shadow.bias=-.00010;sun.shadow.normalBias=.12;own(sun.shadow);

    function texture(c,color=true){
      const t=own(new T.CanvasTexture(c));
      if(color)t.colorSpace=T.SRGBColorSpace;
      t.anisotropy=renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    const grainCanvas=document.createElement('canvas');
    grainCanvas.width=grainCanvas.height=128;
    const gc=grainCanvas.getContext('2d'),pixels=gc.createImageData(128,128);
    for(let i=0;i<16384;i++){
      const y=i>>7,x=i%128;
      pixels.data.set([128,128+7*Math.sin(y*91.7+x*.012),253,255],4*i);
    }
    gc.putImageData(pixels,0,0);
    const grain=texture(grainCanvas,false);
    grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(2,4);
    const mat=(color,roughness,extra={})=>own(new T.MeshPhysicalMaterial({
      color,roughness,metalness:.9,...extra
    }));
    const alloy=mat(0x77767c,.32,{
      envMapIntensity:.53,anisotropy:.4,clearcoat:.12,clearcoatRoughness:.34,
      normalMap:grain,normalScale:new T.Vector2(.12,.18)
    });
    const flank=mat(0x2a2a2f,.37),steel=mat(0xb8b6b2,.24);
    const rubber=mat(0x0d0d10,.81,{metalness:0});
    const glass=mat(0x0d0d10,.22,{
      metalness:.1,ior:1.18,specularIntensity:.32,envMapIntensity:.24,
      clearcoat:.055,clearcoatRoughness:.24
    });
    const basic=color=>own(new T.MeshBasicMaterial({color,toneMapped:false}));

    function mesh(parent,geometry,material,x=0,y=0,z=0){
      const o=new T.Mesh(own(geometry),material);
      o.position.set(x,y,z);parent.add(o);
      o.castShadow=o.receiveShadow=true;
      return o;
    }
    function rect(w,d,r,x=0,z=0){
      const s=new T.Shape(),l=x-w/2,b=-z-d/2,h=l+w,t=b+d;
      s.moveTo(l+r,b);s.lineTo(h-r,b);s.quadraticCurveTo(h,b,h,b+r);
      s.lineTo(h,t-r);s.quadraticCurveTo(h,t,h-r,t);
      s.lineTo(l+r,t);s.quadraticCurveTo(l,t,l,t-r);
      s.lineTo(l,b+r);s.quadraticCurveTo(l,b,l+r,b);
      return s;
    }
    function cut(shape,height,bevel=.32){
      const g=new T.ExtrudeGeometry(shape,{
        depth:height,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,
        bevelSegments:6,curveSegments:6
      });
      g.rotateX(-Math.PI/2);
      const uv=g.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/352,uv.getY(i)/352);
      g.clearGroups();
      return g;
    }
    const plate=(w,d,r,h,b)=>cut(rect(w,d,r),h,b);
    const rows=[-79,-19,41,101],slots=rect(352,324,9),body=[];
    for(const z of rows)slots.holes.push(rect(293,48,4,5,z));
    function shell(g,m,y){
      const o=mesh(unit,g,m,0,y);
      body.push([o,g.attributes.position.array.slice()]);
      return o;
    }
    shell(plate(346,319,8,3,.8),rubber,-14);
    shell(plate(352,324,9,16,1.3),flank,-11);
    shell(plate(352,324,9,1,.18),rubber,5);
    shell(cut(slots,6,.65),alloy,7);

    const fixed=[];
    function place(o){fixed.push([o,o.position.z]);return o}
    const head=new T.Shape();
    head.absarc(0,0,3.65,0,2*Math.PI,false);
    const cross=new T.Path();
    [
      [-.6,-2.3],[.6,-2.3],[.6,-.6],[2.3,-.6],[2.3,.6],[.6,.6],
      [.6,2.3],[-.6,2.3],[-.6,.6],[-2.3,.6],[-2.3,-.6],[-.6,-.6]
    ].forEach(([x,y],i)=>cross[i?'lineTo':'moveTo'](x,y));
    cross.closePath();head.holes.push(cross);
    const screw=cut(head,1.2,.16),seat=new T.CylinderGeometry(4.5,4.2,.55,40);
    for(const x of [-162,162])for(const z of [-148,148]){
      place(mesh(unit,seat,rubber,x,13.8,z));
      const o=place(mesh(unit,screw,steel,x,13.35,z));
      o.rotation.y=x*z>0?.23:-.38;
    }
    const grille=rect(152,10,2);
    for(let i=0;i<30;i++)grille.holes.push(rect(2.2,6,.9,(i-14.5)*4.55));
    const vent=place(mesh(unit,cut(grille,1.1,.12),flank,24,-2,163.3));
    vent.rotation.x=Math.PI/2;

    const printed=[];
    function print(parent,w,d,x,y,z,paint){
      const c=document.createElement('canvas');
      c.width=Math.ceil(w*6);c.height=Math.ceil(d*6);
      const ctx=c.getContext('2d'),map=texture(c);
      const m=own(new T.MeshBasicMaterial({
        map,transparent:true,depthWrite:false,toneMapped:false
      }));
      const o=mesh(parent,new T.PlaneGeometry(w,d),m,x,y,z);
      o.rotation.x=-Math.PI/2;o.castShadow=o.receiveShadow=false;
      function redraw(){
        ctx.setTransform(c.width/w,0,0,c.height/d,0,0);
        ctx.clearRect(0,0,w,d);ctx.textBaseline='middle';
        paint(ctx,w,d);map.needsUpdate=true;
      }
      printed.push(redraw);
      return {o,redraw};
    }
    function text(c,str,x,y,size,mono=true,color='#eeeae4',right=false){
      c.font=(mono?'500 ':'600 ')+size+'px '+(mono?'"Geist Mono",monospace':'Inter,Arial,sans-serif');
      c.textAlign=right?'right':'left';c.fillStyle=color;c.fillText(str,x,y);
    }
    let compact=false;
const stripState={roll:-1};

place(mesh(unit,plate(285,25,3,1,.32),flank,5,13.8,-131));
place(mesh(unit,plate(281,21,2.3,1,.24),glass,5,15,-131));

const strip=print(unit,273,18,5,16.5,-131,(c,w)=>{
  text(c,'LINE 01',5,9,8,true,'#aaa8a3');
  c.fillStyle='#e5172f';
  c.beginPath();
  c.arc(w-112,9,1.8,0,2*Math.PI);
  c.fill();

  c.save();
  c.beginPath();
  c.rect(w-105,1,101,16);
  c.clip();
  copy.forEach((line,i)=>{
    text(c,line[3],w-4,9+(i-stripState.roll)*18,11,true,'#f2f1ee',true);
  });
  c.globalCompositeOperation='destination-out';
  for(let y=3;y<16;y+=3.6)c.fillRect(w-105,y,103,.40);
  c.restore();
});
place(strip.o);

place(print(unit,288,15,5,13.9,147,(c,w)=>{
  text(c,'CINDER · LINE 01',0,7.5,8,true,'#18181a');
  text(c,'S/N CR-L01-0427',w,7.5,6.4,true,'#262529',true);
}).o);

const keys=[],picks=[],links=[];
const wells=[],slotDepth=[],slotScale=[];
const railX=-152;

const polish=mat(0x535259,.21,{envMapIntensity:.65,clearcoat:.3});
const lens=mat(0x88878a,.19,{
  metalness:.22,transparent:true,opacity:.105,depthWrite:false,clearcoat:.9
});
const rim=basic(0x3a3435);
place(mesh(unit,plate(313,1.05,.48,.23,.12),rim,0,6.83,162.4));

for(let i=0;i<4;i++){
  const row=new T.Group(),key=new T.Group();
  unit.add(row);
  row.add(key);

  // Wells belong to the chassis. Keys move independently between them.
  wells.push(mesh(unit,plate(291,46,3.6,1,.25),rubber,5,7,rows[i]));
  mesh(key,plate(271,33,3,7,.42),flank,0,4);
  mesh(key,plate(286,44,3.7,3,.65),alloy,0,11);

  const edge=basic(0x251e21);
  mesh(key,plate(282,40,3.1,1.1,.34),edge,0,14.25);
  mesh(key,plate(280,39,3.1,1.5,.55),polish,0,15.6);
  mesh(key,plate(279,39,3,5.7,.70),glass,0,17.4);

  const cap=mesh(key,plate(279,39,3,6.4,.95),lens,0,24.1);
  cap.castShadow=false;
  cap.userData.index=i;
  picks.push(cap);

  // Calibrate the lettering for the perspective at its seated slot.
  const type={sx:1,sy:1};
  const label=print(key,268,38,0,24.16,0,(c,w)=>{
    const main=compact?14:15.6,small=compact?9.7:11;
    c.save();
    c.scale(1/type.sx,1/type.sy);
    const left=3*type.sx,right=(w-3)*type.sx;
    text(c,copy[i][0],left,9*type.sy,small,true,'#d4d0ca');
    text(c,copy[i][2],right,9*type.sy,small,true,'#d4d0ca',true);
    text(c,copy[i][1],left,27*type.sy,main,false);
    c.restore();
  });

  const reflect=label.o.clone();
  reflect.material=own(label.o.material.clone());
  reflect.position.set(.18,31.55,2.5);
  key.add(reflect);

  // Modulate only the letter strokes during the post-landing scan.
  const scan={value:-2};
  label.o.material.onBeforeCompile=shader=>{
    shader.uniforms.linePhase=scan;
    shader.fragmentShader='uniform float linePhase;\n'+
      shader.fragmentShader.replace('#include <map_fragment>',`
        #include <map_fragment>
        float distanceToLine=abs(vMapUv.y-linePhase);
        diffuseColor.rgb*=1.0+.32*(1.0-smoothstep(.0,.09,distanceToLine));
      `);
  };

  label.o.renderOrder=1;
  cap.renderOrder=2;
  reflect.renderOrder=3;

  const sweep=own(new T.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{phase:{value:-2}},
    vertexShader:`varying vec2 v;
      void main(){
        v=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`varying vec2 v;uniform float phase;
      void main(){
        float d=abs(v.x+.13*v.y-phase);
        gl_FragColor=vec4(.84,.83,.8,(1.-smoothstep(.0,.16,d))*.055);
      }`
  }));
  const sheen=mesh(key,new T.PlaneGeometry(275,36),sweep,0,31.58);
  sheen.rotation.x=-Math.PI/2;
  sheen.castShadow=sheen.receiveShadow=false;
  sheen.renderOrder=4;

  keys.push({row,key,label,reflect,type,scan,edge,sweep,hover:0,slot:-1});

  const ink=basic(0x201e20);
  const leg=mesh(unit,plate(1.4,1,.45,.19,.08),ink,railX,13.8);
  const tap=mesh(unit,plate(12,1.4,.53,.2,.08),basic(0x201e20),railX+5.6,13.8);
  const spark=mesh(unit,plate(1.65,6,.7,.21,.11),basic(0xf2e5db),railX,14.18);
  links.push({ink,leg,tap,spark});
}

    const target=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
    const beauty=target(renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType,true);
    const encoded=target(T.UnsignedByteType);
    const smaa=own(new SMAAPass(1,1)),quad=own(new FullScreenQuad(null));
    let ao,contact,history;
    if(!lite){
      ao=own(new GTAOPass(scene,camera,1,1,undefined,
        {radius:3.4,thickness:2.2,samples:8,scale:.85},{radius:2,samples:4,rings:1}));
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA=1;
      ao.pdMaterial.defines.PERSPECTIVE_CAMERA=1;
      ao.blendIntensity=.27;
      ao.blendMaterial.blendSrcAlpha=T.ZeroFactor;
      ao.blendMaterial.blendDstAlpha=T.OneFactor;
      own(ao.gtaoMaterial);own(ao.blendMaterial);
      contact=target(T.HalfFloatType);history=target(T.HalfFloatType);
    }
    function screen(fragment,extra={}){
      return own(new T.ShaderMaterial({
        uniforms:{src:{value:null},gain:{value:1},toneMappingExposure:{value:1.08}},
        vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:fragment,depthTest:false,depthWrite:false,...extra
      }));
    }
    const add=screen('uniform sampler2D src;varying vec2 v;void main(){gl_FragColor=texture2D(src,v)/16.;}',{
      transparent:true,blending:T.CustomBlending,blendSrc:T.OneFactor,
      blendDst:T.OneFactor,blendEquation:T.AddEquation
    });
    const encode=screen(`uniform sampler2D src;uniform float gain;varying vec2 v;
      #include <common>
      #include <tonemapping_pars_fragment>
      void main(){
        vec4 c=texture2D(src,v)*gain;
        float a=clamp(c.a,0.,1.);
        vec3 rgb=ACESFilmicToneMapping(c.rgb/max(a,.00001));
        gl_FragColor=vec4(sRGBTransferOETF(vec4(rgb,1.)).rgb*a,a);
      }`);
    let w=0,h=0,nx=0,ny=0,samples=0,clock=0,layout='',lastRender=0;
    function halton(n,b){
      let r=0,f=1;
      while(n){f/=b;r+=f*(n%b);n=Math.floor(n/b)}
      return r;
    }
    function render(still){
      const refine=still&&!lite;
      if(!refine)samples=0;
      const m=camera.projectionMatrix.elements,cx=m[8],cy=m[9];
      if(refine){
        m[8]+=(halton(samples+1,2)-.5)*2/nx;
        m[9]+=(halton(samples+1,3)-.5)*2/ny;
      }
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.setRenderTarget(beauty);renderer.render(scene,camera);
      let src=beauty;
      if(ao){ao.render(renderer,contact,beauty);src=contact}
      m[8]=cx;m[9]=cy;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      if(refine){
        renderer.setRenderTarget(history);
        if(!samples)renderer.clear();
        renderer.autoClear=false;
        quad.material=add;add.uniforms.src.value=src.texture;quad.render(renderer);
        renderer.autoClear=true;samples++;src=history;
      }
      renderer.setRenderTarget(encoded);
      quad.material=encode;encode.uniforms.src.value=src.texture;
      encode.uniforms.gain.value=refine?16/samples:1;quad.render(renderer);
      smaa.renderToScreen=true;smaa.render(renderer,null,encoded);
      return refine&&samples<16;
    }

    function resize(){
  const width=frame.clientWidth,height=frame.clientHeight;
  const dpr=Math.min(devicePixelRatio||1,2);
  if(!width||!height)return false;
  if(w===width&&h===height&&nx===Math.floor(width*dpr))return true;

  w=width;h=height;
  compact=w<600&&w/h>1.05;
  for(let i=0;i<4;i++)slotScale[i]=compact&&i<2 ? .34 : 1;
  shapeDeck();

  camera.aspect=w/h;
  camera.zoom=1;
  camera.updateProjectionMatrix();

  const aim=new T.Vector3(0,13,0);
  camera.position.set(130,395,495).add(aim);
  camera.lookAt(aim);
  camera.updateMatrixWorld();

  const corners=[];
  for(const x of [-178,178]){
    for(const y of [-14,32]){
      for(const z of [-164,164]){
        corners.push(new T.Vector3(x,y,deckZ(z)).project(camera));
      }
    }
  }
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  const low=Math.min(...xs),high=Math.max(...xs);
  camera.zoom=Math.min(1.87/(high-low),1.66/(Math.max(...ys)-Math.min(...ys)));
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[8]=low*camera.zoom+1.08;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  keys.forEach(k=>k.slot=-1);
  printed.forEach(redraw=>redraw());
  renderer.setPixelRatio(dpr);
  renderer.setSize(w,h,false);
  nx=canvas.width;ny=canvas.height;
  for(const target of [beauty,encoded,contact,history])target?.setSize(nx,ny);
  smaa.setSize(nx,ny);
  ao?.setSize(Math.ceil(nx*.67),Math.ceil(ny*.67));
  reset=true;
  return true;
}

function deckZ(z){
  return slotScale.reduce((v,scale,i)=>{
    return v+(scale-1)*(60*clamp((z-rows[i]+30)/60)-30);
  },z);
}

function shapeDeck(){
  for(const [o,src] of body){
    const pos=o.geometry.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setZ(i,deckZ(src[i*3+2]));
    pos.needsUpdate=true;
    o.geometry.computeBoundingSphere();
  }
  fixed.forEach(([o,z])=>o.position.z=deckZ(z));
  wells.forEach((well,i)=>{
    const z=deckZ(rows[i]),start=i?deckZ(rows[i-1]):deckZ(-131);
    slotDepth[i]=z;
    well.position.z=z;
    well.scale.z=slotScale[i];
    const link=links[i];
    link.leg.position.z=(start+z)/2;
    link.leg.scale.z=(z-start)/1.16;
    link.tap.position.z=z;
  });
}

function calibrate(k,slot){
  if(k.slot===slot)return;
  k.slot=slot;

  const project=(x,z)=>new T.Vector3(x,24.16,z).project(camera);
  const z=slotDepth[slot];
  const a=project(5,z),b=project(6,z),c=project(5,z+1);

  // Screen-space length of the baseline and height perpendicular to it.
  const bx=(b.x-a.x)*w/2,by=(b.y-a.y)*h/2;
  const cx=(c.x-a.x)*w/2,cy=(c.y-a.y)*h/2;
  k.type.sx=Math.hypot(bx,by);
  k.type.sy=Math.abs(bx*cy-by*cx)/k.type.sx;
  k.label.redraw();
}

    const ray=new T.Raycaster(),pt=new T.Vector2();
    function hit(e){
      const b=canvas.getBoundingClientRect();
      pt.set(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);
      ray.setFromCamera(pt,camera);
      return ray.intersectObjects(picks.filter(o=>o.parent.parent.visible),false)[0]
  ?.object.userData.index??-1;
    }
    on(canvas,'pointermove',e=>{
      if(!fine.matches)return;
      hover=hit(e);tx=-pt.y*.0698;tz=pt.x*.0698;
      canvas.style.cursor=hover>=0?'pointer':'';
      invalidate();
    });
    on(canvas,'pointerleave',()=>{hover=-1;tx=tz=0;invalidate()});
    on(canvas,'click',e=>{const i=hit(e);if(i>=0)el.onStepClick?.(i)});

    const dark=new T.Color(0x211e20),red=new T.Color(0xe5172f),white=new T.Color(0xe7e0d2);
    let playhead=-1,dirtyShadow=true;
const duration=.98;

run=now=>{
  if(dead||!resize())return;
  if(reset){samples=0;dirtyShadow=true;reset=false}

  const dt=last?Math.max(0,(now-last)/1000):0;
  last=now;
  const reduced=rm.matches,follow=1-Math.exp(-dt*14);
  const delta=step-playhead;
  let moving=Math.abs(delta)>0;

  // A single reversible clock keeps the carriage, display and light in sync
  // when the page changes direction during a landing.
  playhead+=Math.sign(delta)*Math.min(Math.abs(delta),dt/duration);

  const rx=reduced?0:tx,rz=reduced?0:tz;
  moving||=Math.abs(rx-unit.rotation.x)+Math.abs(rz-unit.rotation.z)>.0002;
  unit.rotation.x+=(rx-unit.rotation.x)*follow;
  unit.rotation.z+=(rz-unit.rotation.z)*follow;
  if(!reduced)clock+=dt;

  const phase=keys.map((_,i)=>duration*clamp(playhead-i+1));
  let roll=-1,impact=0;

  for(let i=0;i<4;i++){
    const k=keys[i],t=phase[i],lift=hover===i?1:0;
    moving||=Math.abs(k.hover-lift)>.01;
    k.hover+=(lift-k.hover)*follow;
    k.row.visible=t>0;
    if(!k.row.visible)continue;

    let depth=3;
    for(let j=i+1;j<4;j++){
      const lag=(j-i-1)*.033;
      depth-=ease(phase[j],.018+lag,.265+lag);
    }
    depth=Math.max(0,Math.min(3,depth));
    const lo=Math.floor(depth),hi=Math.min(3,lo+1),mix=depth-lo;
    k.row.position.set(5,0,T.MathUtils.lerp(slotDepth[lo],slotDepth[hi],mix));
    k.row.scale.z=T.MathUtils.lerp(slotScale[lo],slotScale[hi],mix);
    calibrate(k,Math.round(depth));

    // 290ms accelerating fall, followed by one compression and release.
    const fall=clamp(t/.29);
    const compression=2*(ease(t,.29,.365)-ease(t,.365,.45));
    k.key.position.y=120*(1-fall*fall)-compression+k.hover;
    k.key.rotation.z=-.092*(1-ease(t,.02,.29));
    k.key.rotation.x=.058*(1-ease(t,0,.28));
    impact=Math.max(impact,ease(t,.29,.335)-ease(t,.335,.45));

    const lit=ease(t,.60,.78)*ease(k.row.scale.z,.36,.75);
    k.label.o.material.opacity=lit;
    k.reflect.material.opacity=lit*.009;
    k.scan.value=i===step&&t>.66&&t<.94 ? (t-.66)/.28*1.25-.125 : -2;
    k.sweep.uniforms.phase.value=reduced?-2:(clock%8)*.85-1;

    const reply=ease(phase[1],.29,.45);
    const pulse=reduced ? .78 : .76+.20*Math.sin(clock*2.4);
    const brightness=i ? .67 : T.MathUtils.lerp(pulse,.34,reply);
    k.edge.color.copy(dark).lerp(i?white:red,ease(t,.29,.45)*brightness);
    roll+=ease(t,.29,.53);
  }

  unit.position.y=-impact;
  if(Math.abs(roll-stripState.roll)>.002||
     (Number.isInteger(roll)&&roll!==stripState.roll)){
    stripState.roll=roll;
    strip.redraw();
  }
  rim.color.copy(dark).lerp(red,reduced ? .18 : .18+.045*Math.sin(clock*.78));

  links.forEach((link,slot)=>{
    const end=slotDepth[slot];
    link.tap.material.color.copy(dark);
    for(let j=0;j<4;j++){
      const proximity=clamp(1-Math.abs(keys[j].row.position.z-end)/18);
      link.tap.material.color.lerp(j?white:red,proximity*ease(phase[j],.90,.98)*.64);
    }
    link.ink.color.copy(dark).lerp(phase[1]>.78?white:red,.42*ease(phase[0],.78,.98));

    const flight=ease(phase[slot],.78,.98);
    const start=slot?slotDepth[2]:deckZ(-131),front=slotDepth[3];
    link.spark.visible=flight>0&&flight<1;
    link.spark.position.set(
      railX+11*ease(flight,.86,1),
      14.18,
      T.MathUtils.lerp(start,front,clamp(flight/.86))
    );
    link.spark.rotation.y=Math.PI*.5*ease(flight,.82,.91);
  });

  if(dirtyShadow||moving){
    renderer.shadowMap.needsUpdate=true;
    dirtyShadow=false;
  }
  if(!moving&&!reduced&&now-lastRender<33){wake();return}

  lastRender=now;
  const more=render(!moving&&reduced);
  if(more||moving||!reduced)wake();
};


    printed.forEach(f=>f());
    loadFonts().then(()=>{if(!dead){printed.forEach(f=>f());invalidate()}});
    invalidate();
  }

  build().catch(()=>{
    if(dead)return;
    destroy();
    const fallback=document.createElement('div');
    fallback.style.cssText='width:100%;height:100%;background:#111113';
    el.append(fallback);
    if(instance===session)instance={destroy:()=>fallback.remove(),invalidate(){}};
  });
}

window.CinderSlab={
  mount,
  setStep(n){
    if(!Number.isFinite(n))return;
    const v=Math.max(0,Math.min(3,Math.round(n)));
    if(v!==step){step=v;instance?.invalidate()}
  },
  setProgress(){},
  destroy(){instance?.destroy();instance=null}
};
window.dispatchEvent(new Event('cinder-slab'));
