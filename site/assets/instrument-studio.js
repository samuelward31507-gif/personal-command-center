const clamp=x=>Math.max(0,Math.min(1,x));
function ease(x,a,b){
  const t=clamp((x-a)/(b-a));
  return t*t*(3-2*t);
}
export function instrument({label,span,assemble,model}) {
  let target=0,session;

  function mount(el){
    session?.destroy();
    const host=document.createElement('div');
    host.style.cssText='position:relative;width:100%;height:100%;overflow:hidden';
    el.append(host);

    let dead=false,visible=false,raf=0,dirty=true,renderer,run=()=>{};
    const reduced=matchMedia('(prefers-reduced-motion:reduce)');
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
    function pause(){cancelAnimationFrame(raf);raf=0;wake()}

    const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;pause()});
    const ro=new ResizeObserver(invalidate);
    io.observe(host);ro.observe(host);
    on(document,'visibilitychange',pause);
    on(reduced,'change',invalidate);

    function releaseGPU(lost=false){
      assets.forEach(resource=>resource.dispose());
      assets.clear();
      renderer?.dispose();
      if(!lost)renderer?.forceContextLoss();
      renderer=null;
    }
    function destroy(){
      dead=true;
      cancelAnimationFrame(raf);
      io.disconnect();ro.disconnect();
      off.forEach(f=>f());
      releaseGPU();
      host.remove();el.classList.remove('instrument-ready');
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
      canvas.setAttribute('aria-label',label);
      host.append(canvas);

      on(canvas,'webglcontextlost',e=>{
        e.preventDefault();cancelAnimationFrame(raf);raf=0;run=()=>{};releaseGPU(true);
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

      function screw(x,y,z){
        const seat=new T.CylinderGeometry(5.1,5.1,.55,32);
        seat.rotateX(Math.PI/2);add(seat,seal,x,y,z);
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
        add(g,steel,x,y,z+.05);
      }

      function group(parent=scene){
        const o=new T.Group();parent.add(o);return o;
      }
      function disc(x,y,z,r,h,m,parent){
        const g=new T.CylinderGeometry(r,r,h,64);
        return add(g.rotateX(Math.PI/2),m,x,y,z,parent);
      }
      function ring(x,y,z,r,t,m,parent){
        return add(new T.TorusGeometry(r,t,8,72),m,x,y,z,parent);
      }
      function labelPlate(str,x,y,z,w,h,parent,color='#f2f1ee'){
        const map=tex(Math.ceil(w*5),Math.ceil(h*5),c=>{
          c.scale(5,5);c.font='500 '+(h*.63)+'px "Geist Mono",monospace';
          c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;
          c.fillText(str,w/2,h/2,w-2);
        });
        const mat=own(new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
        return add(new T.PlaneGeometry(w,h),mat,x,y,z,parent||scene);
      }
      await document.fonts.ready;
      if(dead||!renderer)return;
      const pose=model({T,scene,camera,group,box,disc,ring,add,screw,own,labelPlate,
        deck,side,steel,seal,glass,ink,ease,invalidate});
      for(const [m,parts] of batches){
        const gs=parts.map(g=>g.index?g.toNonIndexed():g);
        const o=new T.Mesh(own(mergeGeometries(gs)),m);
        o.castShadow=o.receiveShadow=true;scene.add(o);
        new Set([...parts,...gs]).forEach(g=>g.dispose());
      }

      const rt=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
      const beauty=rt(hdr?T.HalfFloatType:T.UnsignedByteType,true);
      const encoded=rt(T.UnsignedByteType);
      const smaa=own(new SMAAPass(1,1)),quad=own(new FullScreenQuad(null));
      await Promise.all([smaa.areaTexture.image.decode(),smaa.searchTexture.image.decode()]);
      if(dead||!renderer)return;
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
        const scale=Math.min(.88*w/span[0],.86*h/span[1]);
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
        sampleCamera.position.copy(camera.position);\n        sampleCamera.quaternion.copy(camera.quaternion);\n        sampleCamera.zoom=camera.zoom;\n        sampleCamera.updateMatrixWorld();\n        sampleCamera.projectionMatrix.copy(camera.projectionMatrix);
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


      let started=null;
      run=now=>{
        if(gl.isContextLost()||!resize())return;
        started??=now;
        const arrival=assemble&&!reduced.matches?ease(now-started,0,1050):1;
        const moving=arrival<1;
        if(dirty||moving||samples===0){
          pose(target,arrival);
          renderer.shadowMap.needsUpdate=true;samples=0;
        }
        const more=photo(!moving);
        if(!canvas.dataset.ready){canvas.dataset.ready='true';el.classList.add('instrument-ready')}
        dirty=false;
        if(more||moving)wake();
      };
      invalidate();
    }
    build().catch(error=>{if(!dead){console.warn(label,error);destroy()}});
  }
  return {
    mount,setProgress(p){
      if(!Number.isFinite(p))return;
      p=clamp(p);if(p!==target){target=p;session?.wake()}
    },
    destroy(){session?.destroy();session=null}
  };
}
