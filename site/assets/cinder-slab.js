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
  function invalidate(){reset=true;wake()}
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
    const camera=new T.OrthographicCamera(-1,1,1,-1,1,2000);
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
    let compact=false,mainSize=13,smallSize=9,status=-1;
    place(mesh(unit,plate(285,25,3,1,.32),flank,5,13.8,-131));
    place(mesh(unit,plate(281,21,2.3,1,.24),glass,5,15,-131));
    const strip=print(unit,273,18,5,16.5,-131,(c,w)=>{
      text(c,'LINE 01',5,9,8,true,'#bcb9b4');
      if(status>=0){
        c.fillStyle=status===0?'#e5172f':'#e5e0d6';
        c.fillRect(w-112,7.4,3.2,3.2);
        text(c,copy[status][3],w-5,9,9,true,'#e6e1db',true);
      }
    });
    place(strip.o);
    place(print(unit,288,15,5,13.9,147,(c,w)=>{
      text(c,'CINDER · LINE 01',0,7.5,8,true,'#18181a');
      text(c,'S/N CR-L01-0427',w,7.5,6.4,true,'#262529',true);
    }).o);

    const keys=[],picks=[],links=[],railX=-152;
    for(let i=0;i<4;i++){
      const row=new T.Group(),key=new T.Group();
      unit.add(row);row.add(key);row.position.set(5,0,rows[i]);
      mesh(row,plate(291,46,3.6,1,.25),rubber,0,7);
      mesh(key,plate(275,33,3,6,.34),flank,0,4.5);
      mesh(key,plate(285,41,3.4,3,.42),alloy,0,10);
      const edge=basic(0x251e21);
      mesh(key,plate(281.5,37.5,2.9,.7,.16),edge,0,13.3);
      const cap=mesh(key,plate(280,36,2.6,2.6,.44),glass,0,14.05);
      cap.userData.index=i;picks.push(cap);
      const label=print(key,269,34,0,17.12,0,(c,w)=>{
        text(c,copy[i][0],3,7.6,smallSize,true,'#d4d0ca');
        text(c,copy[i][2],w-3,7.6,smallSize,true,'#d4d0ca',true);
        text(c,copy[i][1],3,23,mainSize,false);
      });
      const sweep=own(new T.ShaderMaterial({
        transparent:true,depthWrite:false,uniforms:{phase:{value:-1}},
        vertexShader:`varying vec2 v;
          void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 v;uniform float phase;
          void main(){float d=abs(v.x+.13*v.y-phase);
          gl_FragColor=vec4(.84,.83,.8,(1.-smoothstep(.0,.16,d))*.065);}`
      }));
      const sheen=mesh(key,new T.PlaneGeometry(276,33),sweep,0,17.22);
      sheen.rotation.x=-Math.PI/2;sheen.castShadow=sheen.receiveShadow=false;
      keys.push({row,key,label,edge,sweep,level:0,hover:0,scale:1});
      const ink=basic(0x201e20);
      const leg=mesh(unit,plate(1.4,1,.45,.19,.08),ink,railX,13.8);
      const tap=mesh(unit,plate(12,1.4,.53,.2,.08),ink,railX+5.6,13.8);
      links.push({ink,leg,tap});
    }

    // Render the opaque hardware and transparent canvas into a linear target.
    // Average still samples before display conversion and the final SMAA pass.
    const target=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
    const beauty=target(lite?T.UnsignedByteType:T.HalfFloatType,true);
    const encoded=target(T.UnsignedByteType);
    const smaa=own(new SMAAPass(1,1)),quad=own(new FullScreenQuad(null));
    let ao,contact,history;
    if(!lite){
      ao=own(new GTAOPass(scene,camera,1,1,undefined,
        {radius:3.4,thickness:2.2,samples:8,scale:.85},{radius:2,samples:4,rings:1}));
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.pdMaterial.defines.PERSPECTIVE_CAMERA=0;
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
      const m=camera.projectionMatrix.elements,cx=m[12],cy=m[13];
      if(refine){
        m[12]+=(halton(samples+1,2)-.5)*2/nx;
        m[13]+=(halton(samples+1,3)-.5)*2/ny;
      }
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.setRenderTarget(beauty);renderer.render(scene,camera);
      let src=beauty;
      if(ao){ao.render(renderer,contact,beauty);src=contact}
      m[12]=cx;m[13]=cy;
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
      w=width;h=height;compact=w<600&&w/h>1.05;
      const px=Math.min(w*(compact ? .90 : .75)/376,h*.90/(compact?205:327));
      camera.left=-w/(2*px);camera.right=-camera.left;
      camera.top=h/(2*px);camera.bottom=-camera.top;camera.updateProjectionMatrix();
      mainSize=Math.min(compact?18.8:17.2,(compact?14:15.6)/(px*.918));
      smallSize=Math.min(compact?12.2:11.6,(compact?9.7:11)/(px*.918));
      printed.forEach(f=>f());
      renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
      nx=canvas.width;ny=canvas.height;
      for(const t of [beauty,encoded,contact,history])t?.setSize(nx,ny);
      smaa.setSize(nx,ny);ao?.setSize(Math.ceil(nx*.67),Math.ceil(ny*.67));
      layout='';reset=true;
      return true;
    }

    // Compress the corresponding portions of the milled deck with their keys.
    // Screw positions, slots, trace junctions and the front grille stay registered.
    function shapeDeck(){
      const sig=keys.map(k=>k.scale.toFixed(3)).join('/');
      if(sig===layout)return;
      layout=sig;
      function map(z){
        let v=z;
        for(let i=0;i<4;i++)v+=(keys[i].scale-1)*(60*clamp((z-rows[i]+30)/60)-30);
        return v;
      }
      for(const [o,src] of body){
        const pos=o.geometry.attributes.position;
        for(let i=0;i<pos.count;i++)pos.setZ(i,map(src[i*3+2]));
        pos.needsUpdate=true;o.geometry.computeBoundingSphere();
      }
      fixed.forEach(([o,z])=>o.position.z=map(z));
      keys.forEach((k,i)=>{
        const z=map(rows[i]),start=i?map(rows[i-1]):map(-131);
        k.row.position.z=z;k.row.scale.z=k.scale;
        const l=links[i];
        l.leg.position.z=(start+z)/2;l.leg.scale.z=(z-start)/1.16;l.tap.position.z=z;
      });
    }

    const ray=new T.Raycaster(),pt=new T.Vector2();
    function hit(e){
      const b=canvas.getBoundingClientRect();
      pt.set(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);
      ray.setFromCamera(pt,camera);
      return ray.intersectObjects(picks,false)[0]?.object.userData.index??-1;
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
    let dirtyShadow=true;
    run=now=>{
      if(dead||!resize())return;
      if(reset){samples=0;dirtyShadow=true;reset=false}
      const dt=last?Math.min(.08,(now-last)/1000):0;
      last=now;
      const snap=rm.matches,follow=snap?1:1-Math.exp(-dt*11);
      const rx=snap?0:tx,rz=snap?0:tz;
      let moving=Math.abs(rx-unit.rotation.x)+Math.abs(rz-unit.rotation.z)>.00015;
      unit.rotation.x+=(rx-unit.rotation.x)*follow;
      unit.rotation.z+=(rz-unit.rotation.z)*follow;
      if(!snap)clock+=dt;
      let state=-1;

      for(let i=0;i<4;i++){
        const k=keys[i],goal=i<=step?1:0;
        const sg=compact&&(i>step||i<step-1) ? .29 : 1;
        const next=snap?goal:k.level+Math.sign(goal-k.level)*
          Math.min(Math.abs(goal-k.level),dt/(.88+i*.026));
        const lift=!snap&&hover===i?1:0;
        moving||=next!==k.level||Math.abs(k.hover-lift)>.006||Math.abs(k.scale-sg)>.001;
        k.level=next;k.hover+=(lift-k.hover)*follow;k.scale+=(sg-k.scale)*follow;
        if(Math.abs(k.scale-sg)<.001)k.scale=sg;

        // One reversible phase drives the rise, click, label delay and trace.
        k.key.position.y=-6+13*ease(next,0,.43)-ease(next,.43,.53)+ease(next,.53,.62)+k.hover;
        const lit=ease(next,.79,.92);
        k.label.o.material.opacity=lit*ease(k.scale,.35,.85);
        k.label.o.visible=k.label.o.material.opacity>.001;
        if(next>=.62)state=i;

        const pulse=snap ? .78 : .74+.22*Math.sin(clock*2.4);
        const missed=pulse+(.34-pulse)*ease(keys[1].level,.55,.65);
        k.edge.color.copy(dark).lerp(i?white:red,ease(next,.48,.64)*(i ? .70 : missed));
        k.sweep.uniforms.phase.value=snap?-1:(clock%8)*.85-1;
        const trail=snap||clock%8>6?0:Math.exp(-7*((clock%8)*.90-i-.5)**2);
        links[i].ink.color.copy(dark).lerp(i?white:red,ease(next,.92,1)*(.44+.34*trail));
      }
      shapeDeck();
      if(state!==status){status=state;strip.redraw()}
      const idleChange=!snap&&(keys[1].level<.65||clock%8<6);
      if(dirtyShadow||moving){renderer.shadowMap.needsUpdate=true;dirtyShadow=false}
      if(moving||idleChange||!samples||samples<16){
        if(!moving&&idleChange&&now-lastRender<33){wake();return}
        lastRender=now;
        if(render(!moving&&!idleChange))wake();
      }
      if(moving||!snap)wake();
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
