const rows=[
  ['How leads come in','Six sources, one inbox',0],
  ['How they get answered','After-hours calls go to voicemail',2400],
  ['How estimates get booked','Booked the same day',0],
  ['How quotes get followed up','No follow-up after day two',3100],
  ['How jobs get paid and reviewed','No review request after the job',900]
];
const fixes=['1  Chase every quote','2  Answer after-hours calls','3  Ask for the review'];
const clamp=x=>Math.max(0,Math.min(1,x));
function ease(x,a,b){
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
}
let target=0,session;

function mount(el){
  session?.destroy();
  const host=document.createElement('div');
  host.style.cssText='position:relative;width:100%;height:100%;overflow:hidden';
  el.append(host);

  let dead=false,visible=false,raf=0,last=0,dirty=true,renderer,run=()=>{},fallback;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const assets=new Set(),off=[];
  const own=x=>(assets.add(x),x);

  function on(o,n,f){
    o.addEventListener(n,f);
    off.push(()=>o.removeEventListener(n,f));
  }
  function wake(){
    if(!dead&&visible&&!document.hidden&&!raf){
      raf=requestAnimationFrame(t=>{raf=0;run(t)});
    }
  }
  function invalidate(){dirty=true;wake()}
  function pause(){cancelAnimationFrame(raf);raf=0;last=0;wake()}

  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;pause()});
  const ro=new ResizeObserver(invalidate);
  io.observe(host);ro.observe(host);
  on(document,'visibilitychange',pause);
  on(reduced,'change',invalidate);

  function destroy(){
    dead=true;
    cancelAnimationFrame(raf);
    io.disconnect();ro.disconnect();
    off.forEach(f=>f());
    assets.forEach(o=>o.dispose());
    renderer?.dispose();renderer?.forceContextLoss();
    host.remove();fallback?.remove();
  }
  session={wake:invalidate,destroy};

  async function build(){
    const [T,{RoundedBoxGeometry},{mergeGeometries},{RectAreaLightUniformsLib},
      {GTAOPass},{SMAAPass},{FullScreenQuad}]=await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/utils/BufferGeometryUtils.js'),
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
      import('three/addons/postprocessing/GTAOPass.js'),
      import('three/addons/postprocessing/SMAAPass.js'),
      import('three/addons/postprocessing/Pass.js')
    ]);
    if(dead)return;

    renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setClearColor(0,0);
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    const canvas=renderer.domElement;
    canvas.style.cssText='display:block;width:100%;height:100%';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Example business audit with five findings and three priorities.');
    host.append(canvas);

    on(canvas,'webglcontextlost',e=>{
      e.preventDefault();cancelAnimationFrame(raf);raf=0;run=()=>{};
    });
    on(canvas,'webglcontextrestored',()=>{if(!dead)mount(el)});

    const scene=new T.Scene();
    const camera=new T.OrthographicCamera(-1,1,1,-1,1,2000);
    camera.position.set(77,-238,810);
    camera.lookAt(0,0,0);
    camera.updateMatrixWorld();
    const sampleCamera=camera.clone();

    const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'';
    const hdr=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
    const lite=!hdr||matchMedia('(pointer:coarse)').matches||
      /swiftshader|llvmpipe|adreno|mali|intel.*uhd/i.test(gpu);

    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;

    RectAreaLightUniformsLib.init();
    const studio=new T.Scene();
    studio.background=new T.Color(0);
    for(const [x,y,z,w,h,i] of [
      [-320,200,540,570,440,4.1],
      [-380,-55,30,90,610,2.65],
      [355,110,80,70,620,2.05]
    ]){
      const l=new T.RectAreaLight(0xf2f1ee,i*.67,w,h);
      l.position.set(x,y,z);l.lookAt(0,0,0);scene.add(l);
      const m=new T.MeshBasicMaterial({color:0xf2f1ee});
      m.color.multiplyScalar(i);
      const card=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),m);
      card.position.copy(l.position).multiplyScalar(.01);
      card.quaternion.copy(l.quaternion);
      card.rotateY(Math.PI);
      studio.add(card);
    }
    const pm=new T.PMREMGenerator(renderer);
    scene.environment=own(pm.fromScene(studio,.015)).texture;
    pm.dispose();
    studio.children.forEach(o=>{o.geometry.dispose();o.material.dispose()});

    const sun=new T.DirectionalLight(0xf2f1ee,1.55);
    sun.position.set(-320,390,700);sun.castShadow=true;scene.add(sun);
    Object.assign(sun.shadow.camera,{left:-340,right:340,top:340,bottom:-340,near:360,far:1300});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.setScalar(lite?2048:4096);
    sun.shadow.normalBias=.12;sun.shadow.bias=-.00012;own(sun.shadow);

    function tex(w,h,paint,color=true){
      const c=document.createElement('canvas');
      c.width=w;c.height=h;paint(c.getContext('2d'));
      const t=own(new T.CanvasTexture(c));
      if(color)t.colorSpace=T.SRGBColorSpace;
      t.anisotropy=renderer.capabilities.getMaxAnisotropy();
      return t;
    }
    const grain=tex(128,128,c=>{
      const a=c.createImageData(128,128);
      for(let i=0;i<16384;i++){
        a.data.set([128,128+8*Math.sin((i>>7)*91.71+(i%128)*.016),252,255],i*4);
      }
      c.putImageData(a,0,0);
    },false);
    grain.wrapS=grain.wrapT=T.RepeatWrapping;
    grain.repeat.set(2,5);

    const metal=(color,r,extra={})=>own(new T.MeshPhysicalMaterial({
      color,roughness:r,metalness:.9,...extra
    }));
    const deck=metal(0x77767c,.32,{
      anisotropy:.4,clearcoat:.12,normalMap:grain,normalScale:new T.Vector2(.12,.18)
    });
    const side=metal(0x2a2a2f,.36),steel=metal(0xa3a19d,.21);
    const seal=metal(0x111113,.8,{metalness:0});
    const glass=metal(0x0d0d10,.23,{
      metalness:.15,ior:1.2,specularIntensity:.28,clearcoat:.12,envMapIntensity:.32
    });
    const ink=color=>own(new T.MeshBasicMaterial({color}));
    const batches=new Map();

    function add(g,m,x,y,z,parent){
      if(!parent){
        g.translate(x,y,z);
        if(!batches.has(m))batches.set(m,[]);
        batches.get(m).push(g);
        return;
      }
      const o=new T.Mesh(own(g),m);
      o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;
      parent.add(o);
      return o;
    }
    function box(x,y,z,w,h,d,m,r=.7,parent){
      return add(new RoundedBoxGeometry(w,h,d,4,Math.min(r,d*.49)),m,x,y,z,parent);
    }

    box(0,0,-5,430,552,19,side,6);
    box(0,0,5,428,550,2,seal);
    box(0,0,9,430,552,7,deck,3);
    box(5,0,13.2,398,490,3,seal);
    box(5,0,15,394,487,2.6,glass,1);
    box(0,239,18,255,40,6,side,2.7);
    box(0,241,22,252,37,4,deck,1.8);
    box(0,221,21,244,4,4,steel,1);

    function screw(x,y){
      const seat=new T.CylinderGeometry(5.1,5.1,.55,32);
      seat.rotateX(Math.PI/2);add(seat,seal,x,y,24.1);
      const shape=new T.Shape();
      shape.absarc(0,0,4.15,0,2*Math.PI,false);
      const cross=new T.Path();
      [
        [-.65,-2.6],[.65,-2.6],[.65,-.65],[2.6,-.65],[2.6,.65],[.65,.65],
        [.65,2.6],[-.65,2.6],[-.65,.65],[-2.6,.65],[-2.6,-.65],[-.65,-.65]
      ].forEach(([a,b],i)=>cross[i?'lineTo':'moveTo'](a,b));
      cross.closePath();shape.holes.push(cross);
      const g=new T.ExtrudeGeometry(shape,{
        depth:.8,bevelThickness:.18,bevelSize:.16,bevelSegments:5,curveSegments:16
      });
      g.rotateZ(x*y>0?.21:-.35);
      add(g,steel,x,y,24.15);
    }
    for(const x of [-115,115])for(const y of [231,251])screw(x,y);

    const railX=-183,ys=[160,98,36,-26,-88],home=199;
    box(railX,42,17.1,13,335,2.1,seal);
    add(new T.CylinderGeometry(2.75,2.75,324,32),steel,railX,42,23);
    for(const y of [-119,203])box(railX,y,21,14,10,9,side,2);

    const carriage=new T.Group();
    scene.add(carriage);carriage.position.set(railX,home,0);
    box(0,0,25,20,20,9,deck,2,carriage);
    box(7,0,26,10,10,7,side,1.2,carriage);
    box(8,0,29,6.4,3.2,1.5,seal,.5,carriage);
    for(const y of [-10,10])add(new T.CylinderGeometry(4.4,4.4,4,28),steel,0,y,23,carriage);

    const led=ink(0x2a0a0f);
    add(new T.SphereGeometry(1.7,16,10),led,-3,2,29.5,carriage);
    const beam=box(0,0,24,1,1,1,ink(0xf2f1ee),.2,scene);
    beam.castShadow=false;

    const redraw=[];
    function lettering(x,y,z,w,h,paint){
      const scale=Math.min(6,renderer.capabilities.maxTextureSize/w);
      let ctx;
      const map=tex(Math.ceil(w*scale),Math.ceil(h*scale),c=>{
        ctx=c;c.scale(c.canvas.width/w,c.canvas.height/h);
      });
      function refresh(){
        ctx.clearRect(0,0,w,h);ctx.textBaseline='middle';paint(ctx,w,h);map.needsUpdate=true;
      }
      refresh();redraw.push(refresh);
      const m=own(new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
      const o=add(new T.PlaneGeometry(w,h),m,x,y,z,scene);
      o.castShadow=o.receiveShadow=false;
      return o;
    }
    function text(c,s,x,y,size,mono=false,color='#f2f1ee'){
      c.fillStyle=color;
      c.font=(mono?'500 ':'600 ')+size+'px '+(mono?'"Geist Mono",monospace':'Inter,Arial,sans-serif');
      c.fillText(s,x,y);
    }

    lettering(0,241,24.3,192,22,c=>text(c,'CINDER · AUDIT',39,11,13,true,'#111113'));
    lettering(0,-259,12.8,390,20,c=>
      text(c,'EXAMPLE BUSINESS · SAMPLE FINDINGS',12,10,11.2,true,'#111113'));
    lettering(-198,36,13,12,312,c=>{
      c.fillStyle='#3a3a40';
      for(let n=0;n<=40;n++){
        const y=32+n*6.2,len=n%10===0?9:n%5===0?6:3;
        c.fillRect(12-len,y,len,n%10===0?1.2:.65);
      }
    });

    const entries=[],wheels=[],hoverTargets=[];
    function digits(amount,x,y,size){
      const group=[];
      String(amount).split('').forEach((n,i)=>{
        const offset=i*size+(i&&amount>=1000?size*.34:0);
        group.push(wheels.length);
        wheels.push({x:x+offset,y,z:19.3,digit:Number(n),size,angle:0,visible:false});
      });
      return group;
    }

    ys.forEach((y,i)=>{
      const [title,detail,amount]=rows[i];
      box(12,y,17.1,359,55,2,side);
      const face=box(12,y,19.1,356,52,2.8,glass,1,scene);
      face.userData.index=i;hoverTargets.push(face);

      const titleObj=lettering(-38,y+9,21,246,22,c=>text(c,title,1,11,15.1));
      const finding=lettering(-38,y-11,21,246,20,c=>text(c,detail,1,10,11.4,false,'#c4c1bc'));

      box(138,y,21.1,97,40,2,side);
      box(138,y,22.2,94,37,.6,glass,.25);
      const state=lettering(140,y+(amount?9:0),22.7,77,15,c=>
        text(c,amount?'LEAK':'LOOKS FINE',0,7.5,10,true));
      const signal=ink(0x1c1c1f);
      add(new T.SphereGeometry(2,16,10),signal,96,y+(amount?9:0),22.25,scene).castShadow=false;

      const group=amount?digits(amount,109,y-8,9):[];
      const prefix=amount?lettering(137,y-8,25,91,17,c=>{
        text(c,'$',2,8.5,12,true);
        if(amount>=1000)text(c,',',21.5,9,9,true);
        text(c,'/mo',amount>=1000?57:48,8.5,9.7,true,'#a3a19d');
      }):null;

      const flash=own(new T.ShaderMaterial({
        transparent:true,depthWrite:false,
        uniforms:{phase:{value:-2},amp:{value:0}},
        vertexShader:`varying vec2 v;
          void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec2 v;uniform float phase,amp;
          void main(){
            float d=abs(v.x+.04*v.y-phase);
            gl_FragColor=vec4(.95,.93,.9,amp*(1.-smoothstep(.008,.15,d)));
          }`
      }));
      const film=add(new T.PlaneGeometry(354,50),flash,12,y,24,scene);
      film.castShadow=film.receiveShadow=false;
      entries.push({titleObj,finding,state,signal,prefix,group,flash});
    });

    box(12,-145,18,358,41,3,side);
    box(12,-145,20,354,37,2,glass);
    const totalLabel=lettering(-70,-145,21.3,176,24,c=>text(c,'MONTHLY LEAK ·',3,12,13,true));
    const totalGroup=digits(6400,109,-145,15);
    const dollars=lettering(125,-145,26,102,23,c=>{
      text(c,'$',16,11.5,17,true);text(c,',',42,14,12,true);
    });
    const itemUniform={value:0},maskUniform={value:0};
    const priorities=lettering(10,-204,17,348,72,c=>{
      text(c,'FIX FIRST',2,10,10,true,'#a3a19d');
      fixes.forEach((v,i)=>text(c,v,96,12+i*21,13));
    });
    priorities.material.onBeforeCompile=s=>{
      s.uniforms.items=itemUniform;s.uniforms.mask=maskUniform;
      s.fragmentShader='uniform float items,mask;\n'+s.fragmentShader.replace('#include <map_fragment>',`
        #include <map_fragment>
        if(vMapUv.y<mask)discard;
        float row=clamp(floor((1.-vMapUv.y)*72./21.),0.,2.);
        if(vMapUv.x>.25)diffuseColor.a*=smoothstep(row,row+.6,items);
      `);
    };

    // Physical drums share one numbered stock and one instanced draw.
    let drumPaint;
    const atlas=tex(1024,128,c=>{
      drumPaint=()=>{
        c.fillStyle='#171719';c.fillRect(0,0,1024,128);
        for(let i=0;i<10;i++){
          c.save();c.translate((i+.5)*102.4,64);c.rotate(-Math.PI/2);c.scale(1.52,.88);
          c.textAlign='center';c.textBaseline='middle';
          text(c,String(i),0,0,104,true);c.restore();
        }
      };
      drumPaint();
    });
    redraw.push(()=>{drumPaint();atlas.needsUpdate=true});
    atlas.wrapS=T.RepeatWrapping;
    const stock=own(new T.MeshBasicMaterial({map:atlas}));
    stock.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 drumNormal;\n'+s.vertexShader.replace('#include <begin_vertex>',`
        #include <begin_vertex>
        drumNormal=mat3(instanceMatrix)*normal;
      `);
      s.fragmentShader='varying vec3 drumNormal;\n'+s.fragmentShader.replace('#include <map_fragment>',`
        #include <map_fragment>
        float facing=dot(normalize(drumNormal),normalize(vec3(.095,-.294,1.)));
        if(facing<.963)discard;
        diffuseColor.rgb*=.6+.4*smoothstep(.963,1.,facing);
      `);
    };
    const drums=new T.InstancedMesh(
      own(new T.CylinderGeometry(1,1,1,120,1,true)),stock,wheels.length
    );
    drums.frustumCulled=false;scene.add(drums);own(drums);

    for(const [m,parts] of batches){
      const gs=parts.map(g=>g.index?g.toNonIndexed():g);
      const o=new T.Mesh(own(mergeGeometries(gs)),m);
      o.castShadow=o.receiveShadow=true;scene.add(o);
      new Set([...parts,...gs]).forEach(g=>g.dispose());
    }

    const dummy=new T.Object3D();
    function roll(group,t){
      group.forEach((id,j)=>{
        const wheel=wheels[id],travel=wheel.digit+10*(group.length-j);
        wheel.angle=.286-2*Math.PI*(.05+travel*ease(t,0,1)/10);
        wheel.visible=t>0;
      });
    }
    function updateDrums(){
      wheels.forEach((a,i)=>{
        const r=a.size*2.35;
        dummy.position.set(a.x-r*.087,a.y+r*.28,a.z-r*.956+3.9);
        dummy.rotation.set(0,0,-Math.PI/2);dummy.rotateY(a.angle);
        dummy.scale.set(r,a.visible?a.size*.96:0,r);
        dummy.updateMatrix();drums.setMatrixAt(i,dummy.matrix);
      });
      drums.instanceMatrix.needsUpdate=true;
    }

    const rt=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
    const beauty=rt(hdr?T.HalfFloatType:T.UnsignedByteType,true);
    const encoded=rt(T.UnsignedByteType);
    const smaa=own(new SMAAPass(1,1)),quad=own(new FullScreenQuad(null));
    let ao,contact,history;
    if(!lite){
      ao=own(new GTAOPass(scene,sampleCamera,1,1,undefined,
        {radius:2.5,thickness:1.8,samples:8,scale:.8},{radius:2,samples:4,rings:1}));
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA=ao.pdMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.blendIntensity=.24;
      ao.blendMaterial.blendSrcAlpha=T.ZeroFactor;
      ao.blendMaterial.blendDstAlpha=T.OneFactor;
      own(ao.gtaoMaterial);own(ao.blendMaterial);
      contact=rt(T.HalfFloatType);history=rt(T.HalfFloatType);
    }
    function pass(fragment,extra={}){
      return own(new T.ShaderMaterial({
        uniforms:{src:{value:null},gain:{value:1},toneMappingExposure:{value:1.08}},
        depthTest:false,depthWrite:false,
        vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:'varying vec2 v;uniform sampler2D src;uniform float gain;\n'+fragment,
        ...extra
      }));
    }
    const sum=pass('void main(){gl_FragColor=texture2D(src,v)/16.;}',{
      transparent:true,blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor
    });
    const display=pass(`#include <common>
      #include <tonemapping_pars_fragment>
      void main(){
        vec4 c=texture2D(src,v)*gain;
        float a=clamp(c.a,0.,1.);
        vec3 rgb=ACESFilmicToneMapping(c.rgb/max(.00001,a));
        gl_FragColor=vec4(sRGBTransferOETF(vec4(rgb,1.)).rgb*a,a);
      }`);

    let width=0,height=0,pixels=0,samples=0;
    function resize(){
      const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(!w||!h)return false;
      if(w===width&&h===height&&pixels===dpr)return true;
      width=w;height=h;pixels=dpr;
      const scale=Math.min(.80*w/431,.92*h/550);
      camera.left=-w/(2*scale);camera.right=-camera.left;
      camera.top=h/(2*scale);camera.bottom=-camera.top;
      camera.updateProjectionMatrix();
      sampleCamera.copy(camera);
      renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
      for(const t of [beauty,encoded,history,contact])t?.setSize(canvas.width,canvas.height);
      smaa.setSize(canvas.width,canvas.height);
      ao?.setSize(Math.ceil(canvas.width*.67),Math.ceil(canvas.height*.67));
      dirty=true;return true;
    }
    function halton(n,b){
      let x=0,f=1;
      while(n){f/=b;x+=f*(n%b);n=Math.floor(n/b)}
      return x;
    }
    function photo(still){
      // Only the sampling copy receives subpixel offsets. The scene camera
      // and the projection used for interaction stay fixed throughout the scan.
      const refine=still&&!lite;
      sampleCamera.projectionMatrix.copy(camera.projectionMatrix);
      if(refine){
        const m=sampleCamera.projectionMatrix.elements;
        m[12]+=(halton(samples+1,2)-.5)*2/canvas.width;
        m[13]+=(halton(samples+1,3)-.5)*2/canvas.height;
      }
      sampleCamera.projectionMatrixInverse.copy(sampleCamera.projectionMatrix).invert();
      renderer.setRenderTarget(beauty);renderer.render(scene,sampleCamera);
      let src=beauty;
      if(ao){ao.render(renderer,contact,beauty);src=contact}
      if(refine){
        renderer.setRenderTarget(history);
        if(!samples)renderer.clear();
        renderer.autoClear=false;
        quad.material=sum;sum.uniforms.src.value=src.texture;quad.render(renderer);
        renderer.autoClear=true;samples++;src=history;
      }
      renderer.setRenderTarget(encoded);
      quad.material=display;display.uniforms.src.value=src.texture;
      display.uniforms.gain.value=refine?16/samples:1;
      quad.render(renderer);
      smaa.renderToScreen=true;smaa.render(renderer,null,encoded);
      return refine&&samples<16;
    }

    let hover=-1;
    const ray=new T.Raycaster(),pointer=new T.Vector2();
    on(canvas,'pointermove',e=>{
      if(!fine.matches)return;
      const b=canvas.getBoundingClientRect();
      pointer.set((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2);
      ray.setFromCamera(pointer,camera);
      const i=ray.intersectObjects(hoverTargets,false)[0]?.object.userData.index??-1;
      if(i!==hover){hover=i;invalidate()}
    });
    on(canvas,'pointerleave',()=>{hover=-1;invalidate()});

    const offColor=new T.Color(0x1c1c1f),white=new T.Color(0xf2f1ee),red=new T.Color(0xe5172f);
    let p=target,velocity=0,clock=0,lastDraw=-Infinity,oldY=NaN,timer=0;
    off.push(()=>clearTimeout(timer));

    run=now=>{
      if(!resize())return;
      const dt=last?Math.min(.12,(now-last)/1000):0;last=now;
      const rest=reduced.matches;
      if(rest){p=target;velocity=0}
      else{
        const gap=p-target,k=38,b=velocity+k*gap,d=Math.exp(-k*dt);
        p=target+(gap+b*dt)*d;
        velocity=(velocity-k*b*dt)*d;
        if(Math.abs(p-target)<.00003&&Math.abs(velocity)<.001){p=target;velocity=0}
      }

      const moving=p!==target||velocity!==0,hold=p>=.85&&!rest;
      if(hold)clock+=dt;else clock=0;
      const idle=hold&&clock%8<1.9;
      if(idle&&!dirty&&!moving&&now-lastDraw<1000/30){wake();return}

      const index=Math.min(4,Math.floor(clamp((p-.08)/.62)*5));
      const u=clamp((p-(.08+index*.124))/.124);
      const prev=index?ys[index-1]:home;
      carriage.position.y=prev+(ys[index]-prev)*ease(u,0,.43);

      const sweep=ease(u,.39,.77),power=ease(u,.39,.48)*(1-ease(u,.78,.98));
      beam.visible=power>.002;
      beam.scale.set(Math.max(.01,360*sweep),.85,1);
      beam.position.set(railX+11+180*sweep,carriage.position.y,24.4);
      beam.material.color.copy(white).multiplyScalar(power);

      const blink=rows[index][2]?ease(u,.58,.67)*(1-ease(u,.68,.79)):0;
      led.color.setHex(0x2a0a0f).lerp(red,blink);

      entries.forEach((r,i)=>{
        const t=clamp((p-.08-i*.124)/.124);
        const read=ease(t,.42,.69),resolved=ease(t,.56,.73);
        r.titleObj.material.opacity=Math.min(1,.37+.58*read+(hover===i ? .13 : 0));
        r.finding.material.opacity=read*(hover===i?1:.86);
        r.state.material.opacity=resolved;
        r.signal.color.copy(offColor).lerp(rows[i][2]?red:white,resolved);
        if(r.prefix){r.prefix.material.opacity=resolved;roll(r.group,ease(t,.59,.97))}

        const flash=ease(t,.49,.83);
        r.flash.uniforms.phase.value=idle?(clock%8)/1.9*1.5-.25:flash*1.44-.22;
        r.flash.uniforms.amp.value=idle ? .045 : .105*Math.sin(Math.PI*flash);
      });

      const total=ease(p,.70,.81);
      totalLabel.material.opacity=.30+.70*total;
      dollars.material.opacity=total;
      roll(totalGroup,total);updateDrums();

      const lift=ease(p,.728,.81);
      priorities.position.y=-218+14*lift;
      priorities.material.opacity=lift;
      itemUniform.value=3*ease(p,.745,.85);
      maskUniform.value=(1.-lift)*.20;

      if(oldY!==carriage.position.y||dirty){
        renderer.shadowMap.needsUpdate=true;oldY=carriage.position.y;
      }
      if(moving||idle||dirty)samples=0;
      const more=photo(!moving&&!idle);
      dirty=false;lastDraw=now;

      if(moving||idle||more)wake();
      else if(hold){
        last=0;
        clearTimeout(timer);
        timer=setTimeout(()=>{clock=0;invalidate()},(8-clock%8)*1000);
      }
    };

    document.fonts?.ready.then(()=>{
      if(!dead){redraw.forEach(f=>f());invalidate()}
    });
    invalidate();
  }

  build().catch(()=>{
    if(dead)return;
    destroy();
    fallback=document.createElement('div');
    fallback.style.cssText='height:100%;background:#111113';
    el.append(fallback);
    session={wake(){},destroy:()=>fallback.remove()};
  });
}

window.CinderAudit={
  mount,
  setProgress(p){
    if(!Number.isFinite(p))return;
    p=clamp(p);
    if(target!==p){target=p;session?.wake()}
  },
  destroy(){session?.destroy();session=null}
};

window.dispatchEvent(new Event('cinder-audit'));
