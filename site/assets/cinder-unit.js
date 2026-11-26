// The Cinder unit, V3 round 2 (studio lighting). API: mount, setProgress, setActive, destroy.
const names=['Answering','Booking','Quote follow-up','Invoices','Reviews','Website'];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function ease(p,a,b){
  const t=clamp((p-a)/(b-a));
  return t*t*(3-2*t);
}

let progress=0,active=-1,session;
function destroy(){
  session?.dispose();
  session=null;
}

function mount(el){
  destroy();
  const frame=document.createElement('div');
  frame.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate';
  frame.setAttribute('role','group');
  frame.setAttribute('aria-label','Cinder Revenue unit');
  el.append(frame);

  const releases=[],assets=new Set();
  let dead=false,renderer,raf=0,timer=0,visible=false,lost=false;

  function own(item){assets.add(item);return item}
  function stop(){
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf=timer=0;
  }
  function dispose(){
    dead=true;
    stop();
    releases.splice(0).forEach(fn=>fn());
    assets.forEach(resource=>resource.dispose());
    assets.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    frame.remove();
  }
  function listen(node,type,fn){
    node.addEventListener(type,fn);
    releases.push(()=>node.removeEventListener(type,fn));
  }
  session={dispose,wake(){}};

  async function build(){
    const [
      T,{RoundedBoxGeometry},{mergeGeometries},{RectAreaLightUniformsLib},
      {GTAOPass},{SMAAPass},{FullScreenQuad}
    ]=await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/utils/BufferGeometryUtils.js'),
      import('three/addons/lights/RectAreaLightUniformsLib.js'),
      import('three/addons/postprocessing/GTAOPass.js'),
      import('three/addons/postprocessing/SMAAPass.js'),
      import('three/addons/postprocessing/Pass.js')
    ]);
    if(dead)return;

    const canvas=document.createElement('canvas');
    const opts={alpha:true,antialias:true,powerPreference:'high-performance'};
    const gl=canvas.getContext('webgl2',opts)||canvas.getContext('webgl',opts);
    if(!gl){frame.style.background='#111113';return}

    renderer=new T.WebGLRenderer({...opts,canvas,context:gl});
    renderer.setClearColor(0,0);
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    renderer.outputColorSpace=T.SRGBColorSpace;
    canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Six machined graphite layers with a red dial');
    frame.append(canvas);

    const scene=new T.Scene();
    const camera=new T.OrthographicCamera(-1,1,1,-1,1,3600);
    camera.position.set(1000,816.49658,1000);
    camera.lookAt(0,0,0);
    camera.updateMatrixWorld();

    const gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=gpuInfo?gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL):'';
    const hdr=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
    const mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches;
    let lightTier=mobile||!hdr||/swiftshader|llvmpipe|mali|adreno|intel.*(uhd|hd graphics)/i.test(gpu)||
      (navigator.deviceMemory||8)<=4||renderer.capabilities.maxTextureSize<8192;

    // Three softboxes share positions, orientation and proportions with their PMREM cards.
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false;
    RectAreaLightUniformsLib.init();

    const studio=new T.Scene();
    studio.background=new T.Color(0);
    const aim=new T.Vector3(0,135,0),panels=[];
    for(const [x,y,z,w,h,intensity] of [
      [-230,560,-115,620,490,4.1],
      [-375,-140,360,310,680,2.65],
      [350,-100,-345,145,650,2.05]
    ]){
      const panel=new T.RectAreaLight(0xf2f1ee,intensity,w,h);
      panel.position.set(x,y,z).add(aim);
      panel.lookAt(aim);
      scene.add(panel);
      panels.push(panel);

      const material=new T.MeshBasicMaterial({color:0xf2f1ee});
      material.color.multiplyScalar(intensity);
      const card=new T.Mesh(new T.PlaneGeometry(w*.01,h*.01),material);
      card.position.set(x*.01,y*.01,z*.01);
      card.quaternion.copy(panel.quaternion);
      card.rotateY(Math.PI);
      studio.add(card);
    }
    const pm=new T.PMREMGenerator(renderer);
    try{scene.environment=own(pm.fromScene(studio,.015)).texture}
    finally{
      pm.dispose();
      studio.children.forEach(o=>{o.geometry.dispose();o.material.dispose()});
    }

    const key=new T.DirectionalLight(0xf2f1ee,1.9);
    key.castShadow=true;
    key.position.set(-385,820,350);
    key.target.position.copy(aim);
    scene.add(key,key.target);
    const sh=own(key.shadow),shadowCam=sh.camera;
    sh.mapSize.setScalar(Math.min(lightTier?2048:4096,renderer.capabilities.maxTextureSize));
    sh.bias=-.00010;
    sh.normalBias=.12;
    key.updateMatrixWorld();
    key.target.updateMatrixWorld();
    sh.updateMatrices(key);

    function texture(w,h,paint,color=true){
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      paint(c.getContext('2d'));
      const t=own(new T.CanvasTexture(c));
      if(color)t.colorSpace=T.SRGBColorSpace;
      t.anisotropy=renderer.capabilities.getMaxAnisotropy();
      return t;
    }

    const grain=texture(128,128,c=>{
      const data=c.createImageData(128,128);
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const n=4*(128*y+x);
        const v=Math.sin(y*91.713)*.8+Math.sin((y+1)*(y+11)*1.379+x*.01)*.2;
        data.data[n]=128;
        data.data[n+1]=128+v*8;
        data.data[n+2]=253;
        data.data[n+3]=255;
      }
      c.putImageData(data,0,0);
    },false);
    grain.wrapS=grain.wrapT=T.RepeatWrapping;
    grain.repeat.set(2,4);
    const sideGrain=own(grain.clone());
    sideGrain.rotation=Math.PI/2;
    sideGrain.needsUpdate=true;

    const roughMap=texture(128,128,c=>{
      const image=c.createImageData(128,128);
      for(let i=0;i<128*128;i++){
        const x=i%128,y=i>>7;
        const value=243+3*Math.sin(y*y*1.71+x*.016)+2*Math.sin(x*.079+y*.19);
        image.data.set([value,value,value,255],i*4);
      }
      c.putImageData(image,0,0);
    },false);
    roughMap.wrapS=roughMap.wrapT=T.RepeatWrapping;
    roughMap.repeat.set(2,4);

    function mat(color,roughness=.36,extra={}){
      return own(new T.MeshPhysicalMaterial({color,metalness:.9,roughness,roughnessMap:roughMap,...extra}));
    }
    const satin=mat(0x3a3a40,.39,{
      metalness:.86,normalMap:sideGrain,normalScale:new T.Vector2(.15,.22)
    });
    const top=mat(0x77767c,.3,{
      anisotropy:.40,anisotropyRotation:0,clearcoat:.12,clearcoatRoughness:.34,
      normalMap:grain,normalScale:new T.Vector2(.12,.18)
    });
    const steel=mat(0xa3a19d,.28,{metalness:.95}),dark=mat(0x111113,.42);
    const rubber=mat(0x111113,.89,{metalness:0});
    const glass=mat(0x111113,.28,{metalness:.18,clearcoat:.9});
    const red=mat(0xe5172f,.31,{emissive:0xe5172f,emissiveIntensity:.9});

    const geometryCache=new Map();
    function rounded(w,h,d,r){
      const id=[w,h,d,r].join('/');
      if(!geometryCache.has(id))geometryCache.set(id,own(new RoundedBoxGeometry(w,h,d,6,r)));
      return geometryCache.get(id);
    }
    function mesh(parent,geometry,material,x=0,y=0,z=0){
      const object=new T.Mesh(own(geometry),material);
      object.position.set(x,y,z);
      parent.add(object);
      return object;
    }

    const dummy=new T.Object3D();
    function repeat(parent,geometry,material,poses){
      const batch=own(new T.InstancedMesh(own(geometry),material,poses.length));
      poses.forEach(([x,y,z,angle=0],i)=>{
        dummy.position.set(x,y,z);
        dummy.rotation.set(0,angle,0);
        dummy.updateMatrix();
        batch.setMatrixAt(i,dummy.matrix);
      });
      parent.add(batch);
      return batch;
    }

    function rect(w,d,r,x=0,z=0){
      const s=new T.Shape(),l=x-w/2,b=-z-d/2,h=l+w,t=b+d;
      s.moveTo(l+r,b);s.lineTo(h-r,b);s.quadraticCurveTo(h,b,h,b+r);
      s.lineTo(h,t-r);s.quadraticCurveTo(h,t,h-r,t);s.lineTo(l+r,t);
      s.quadraticCurveTo(l,t,l,t-r);s.lineTo(l,b+r);s.quadraticCurveTo(l,b,l+r,b);
      return s;
    }
    function circle(r,x=0,z=0){
      const s=new T.Shape(),n=r>40?128:r>10?64:40;
      for(let i=0;i<n;i++){
        const a=2*Math.PI*i/n;
        s[i?'lineTo':'moveTo'](x+r*Math.cos(a),-z+r*Math.sin(a));
      }
      s.closePath();
      return s;
    }
    function cut(shape,height,bevel,segments=8){
      const g=new T.ExtrudeGeometry(shape,{
        depth:height,curveSegments:segments,bevelEnabled:true,
        bevelSegments:6,bevelThickness:bevel,bevelSize:bevel,steps:1
      });
      g.rotateX(-Math.PI/2);
      const uv=g.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/280,uv.getY(i)/280);
      g.clearGroups();
      // These inserts seat in backing stock. Omit their buried lower bevel rings.
      const pos=g.attributes.position,indices=[];
      for(let i=0;i<pos.count;i+=3){
        if(Math.max(pos.getY(i),pos.getY(i+1),pos.getY(i+2))>.00001)indices.push(i,i+1,i+2);
      }
      g.setIndex(indices);
      return g;
    }
    function lathe(points,n=64){
      const path=points.map(([x,y])=>new T.Vector2(x,y)),smooth=[path[0]];
      for(let i=1;i<path.length-1;i++){
        const a=path[i-1],b=path[i],c=path[i+1];
        const radius=Math.min(.22,.45*b.distanceTo(a),.45*b.distanceTo(c));
        const start=b.clone().lerp(a,radius/b.distanceTo(a));
        const end=b.clone().lerp(c,radius/b.distanceTo(c));
        smooth.push(...new T.QuadraticBezierCurve(start,b,end).getPoints(6));
      }
      smooth.push(path.at(-1));
      return new T.LatheGeometry(smooth,n);
    }
    function disc(parent,r,h,material,x,y,z){
      const g=lathe([[.001,0],[r-.35,0],[r,.3],[r,h-.3],[r-.35,h],[.001,h]]);
      const {position,uv}=g.attributes;
      for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/280,position.getZ(i)/280);
      return mesh(parent,g,material,x,y,z);
    }
    function torus(parent,r,t,material,x,y,z){
      const object=mesh(parent,new T.TorusGeometry(r,t,8,96),material,x,y,z);
      object.rotation.x=-Math.PI/2;
      return object;
    }
    function textMap(text,w,h,font,spacing){
      return texture(w,h,c=>{
        c.font=font;c.textBaseline='middle';c.fillStyle='#a3a19d';
        const widths=Array.from(text,ch=>c.measureText(ch).width);
        let x=(w-widths.reduce((a,b)=>a+b,0)-spacing*(text.length-1))/2;
        Array.from(text).forEach((ch,i)=>{c.fillText(ch,x,h/2);x+=widths[i]+spacing});
      });
    }

    const plates=[],edges=[],hits=[],screws=[];
    const corners=[[-117,-117],[117,-117],[-117,117],[117,117]];
    const ventFace=rect(274,25,3);
    for(let i=0;i<13;i++)ventFace.holes.push(rect(2.6,13,1.25,(i-6)*8));
    const ventGeo=cut(ventFace,1.1,.22,4);
    ventGeo.rotateX(Math.PI/2);
    const rim=rect(279.3,279.3,5);
    rim.holes.push(rect(275,275,4));
    const rimGeo=cut(rim,.95,.20,5);
    const pockets=[
      circle(59),rect(70,50,4,0,94),circle(19,0,101),
      rect(100,12,3,0,100),rect(40,15,2,32,104),rect(72,31,3,0,100)
    ];

    for(let i=0;i<6;i++){
      const g=new T.Group();
      scene.add(g);
      plates.push(g);
      const body=mesh(g,rounded(280,30,277,5),satin,0,-2,-1.5);
      body.userData.index=i;
      hits.push(body);
      const face=rect(278,278,5);
      face.holes.push(pockets[i]);
      if(!i){
        corners.forEach(([x,z])=>face.holes.push(circle(6,x,z)));
        face.holes.push(rect(78,17,3,0,-87));
      }
      const cover=mesh(g,cut(face,3.35,.35,12),top,0,13.3,0);
      cover.userData.index=i;
      hits.push(cover);
      const edge=own(steel.clone());
      edge.color.setHex(0x6f6d69);
      edges.push(edge);
      mesh(g,rimGeo,edge,0,11.95,0);
      if(i<5)mesh(g,rounded(267,1.4,267,.65),rubber,0,-17.2,0);
      const vent=mesh(g,ventGeo,satin,0,-2,138.45);
      vent.userData.index=i;
      hits.push(vent);
      mesh(g,new T.PlaneGeometry(107,16),dark,0,-2,137.98);
      const floor=new T.ShapeGeometry(pockets[i].clone(),12);
      floor.rotateX(-Math.PI/2);
      mesh(g,floor,dark,0,13.12,0);
    }

    const lid=plates[0];
    disc(lid,53.5,2.4,top,0,13.4,0);
    torus(lid,55.8,.85,red,0,15.1,0);
    const ticks=Array.from({length:48},(_,i)=>{
      const a=i*Math.PI/24;
      return [64*Math.sin(a),17.03,64*Math.cos(a),a];
    });
    repeat(lid,cut(rect(.52,2.62,.2),.13,.08,2),steel,ticks);
    mesh(lid,rounded(1.1,.4,9,.19),steel,0,15.9,-43);

    const grille=rect(76.8,15.8,2.5);
    for(let i=0;i<45;i++){
      const hole=new T.Path(),x=(i%15-7)*4.8,z=-4.8+Math.floor(i/15)*4.8;
      hole.absarc(x,-z,1.25,0,2*Math.PI,false);
      grille.holes.push(hole);
    }
    mesh(lid,cut(grille,.62,.12,5),top,0,16.15,-87);
    mesh(lid,rounded(76,.7,15,.3),dark,0,13.6,-87);

    const ink=own(new T.MeshBasicMaterial({
      map:textMap('CINDER REVENUE · UNIT',2048,128,'500 78px "Geist Mono",monospace',12),
      transparent:true,depthWrite:false
    }));
    const label=mesh(lid,new T.PlaneGeometry(116,7.25),ink,0,17.06,96);
    label.rotation.x=-Math.PI/2;

    const cross=new T.Shape();
    [
      [-1,-3.6],[1,-3.6],[1,-1],[3.6,-1],[3.6,1],[1,1],
      [1,3.6],[-1,3.6],[-1,1],[-3.6,1],[-3.6,-1],[-1,-1]
    ].forEach(([x,y],i)=>cross[i?'lineTo':'moveTo'](x,y));
    cross.closePath();
    const head=circle(5.35);
    head.holes.push(cross);
    const headGeo=cut(head,1.55,.2,20);
    const shaftGeo=lathe([[.01,-30],[1.8,-30],[2.1,-29.4],[2.1,-1],[4.8,-.6],[5.15,0],[.01,0]],32);
    const threadPoints=Array.from({length:217},(_,i)=>{
      const a=i*Math.PI/9;
      return new T.Vector3(2.12*Math.cos(a),-29+i*.12,2.12*Math.sin(a));
    });
    const thread=new T.TubeGeometry(new T.CatmullRomCurve3(threadPoints),216,.43,5,false);
    const pieces=[headGeo,shaftGeo,thread].map(g=>g.index?g.toNonIndexed():g);
    const screwGeo=mergeGeometries(pieces);
    new Set([...pieces,headGeo,shaftGeo,thread]).forEach(g=>g.dispose());
    const crossFloor=new T.ShapeGeometry(cross);
    crossFloor.rotateX(-Math.PI/2);
    for(const [x,z] of corners){
      const screw=new T.Group();
      screw.position.set(x,15.25,z);
      lid.add(screw);
      screws.push(screw);
      mesh(screw,screwGeo,steel);
      mesh(screw,crossFloor,dark,0,.06,0);
    }

    const keycap=cut(rect(10.8,8.8,.8),1.9,.6,6),keys=[];
    for(let i=0;i<12;i++){
      const xyz=[(i%4-1.5)*15,14.6,94+(Math.floor(i/4)-1)*13];
      if(i===10)mesh(plates[1],keycap,red,...xyz);
      else keys.push(xyz);
    }
    repeat(plates[1],keycap,satin,keys);
    disc(plates[2],16.8,3.7,top,0,13.25,101);
    const knurls=Array.from({length:40},(_,i)=>{
      const a=i*Math.PI/20;
      return [16.6*Math.sin(a),15.35,101+16.6*Math.cos(a),a];
    });
    repeat(plates[2],lathe([[.01,-1.2],[.52,-1],[.52,1],[.01,1.2]],6),steel,knurls);
    mesh(plates[2],rounded(1.2,.32,8,.15),steel,0,17.04,91.5);
    mesh(plates[3],rounded(93,.8,5,.35),satin,0,13.8,103);

    const star=new T.Shape();
    for(let i=0;i<10;i++){
      const a=Math.PI/2+i*Math.PI/5,r=i%2?4.3:9;
      star[i?'lineTo':'moveTo'](r*Math.cos(a),r*Math.sin(a));
    }
    star.closePath();
    mesh(plates[4],cut(star,.4,.2),steel,-13,17,104);
    const digits=own(new T.MeshPhysicalMaterial({
      color:0xf2f1ee,roughness:.42,metalness:.85,
      map:texture(256,1024,c=>{
        c.fillStyle='#1c1c1f';
        c.fillRect(0,0,256,1024);
        c.fillStyle='#f2f1ee';
        c.font='500 96px "Geist Mono",monospace';
        c.textAlign='center';
        c.textBaseline='middle';
        for(let i=0;i<10;i++)c.fillText(String(i),128,(i+.5)*102.4);
      })
    }));
    const drumGeo=new T.CylinderGeometry(5,5,10,48,1,true);
    for(let i=0;i<3;i++){
      const drum=mesh(plates[4],drumGeo,digits,20+i*12,11.9,104);
      drum.rotation.z=Math.PI/2;
      drum.rotateY(Math.PI*(.4+i*.2));
    }
    const duv=drumGeo.attributes.uv;
    for(let i=0;i<duv.count;i++){
      const u=duv.getX(i);
      duv.setXY(i,duv.getY(i),u);
    }

    mesh(plates[5],rounded(70,2.6,29,1.2),glass,0,14.7,100);
    const cablePoints=[
      [97,-5,-136],[97,-5,-156],[110,-11,-176],
      [135,-15,-182],[156,-15,-190],[165,-15,-208]
    ];
    const path=new T.CatmullRomCurve3(cablePoints.map(p=>new T.Vector3(...p)));
    mesh(plates[5],new T.TubeGeometry(path,48,2.5,10,false),rubber);
    const boot=mesh(plates[5],lathe([
      [3,0],[5.4,1],[5.4,4],[4.3,5],[5,7],[4,8],[4.6,10],[3.8,11],[4,13],[2.7,16]
    ],32),rubber,97,-5,-139);
    boot.rotation.x=-Math.PI/2;

    function shaded(m){
      const result=own(m.clone()),gain={value:1};
      result.onBeforeCompile=shader=>{
        shader.uniforms.cinderGain=gain;
        shader.fragmentShader='uniform float cinderGain;\n'+shader.fragmentShader.replace(
          '#include <opaque_fragment>','outgoingLight *= cinderGain;\n#include <opaque_fragment>'
        );
      };
      result.userData.gain=gain;
      return result;
    }
    const gains=plates.map((g,i)=>{
      const cache=new Map();
      g.traverse(o=>{
        if(!o.isMesh)return;
        const original=o.material;
        if(!cache.has(original))cache.set(original,shaded(original));
        o.material=cache.get(original);
      });
      edges[i]=cache.get(edges[i]);
      return Array.from(cache.values());
    });

    // Merge rigid pieces by finish while retaining the original local picking surfaces.
    plates.forEach(group=>{
      const buckets=new Map();
      for(const o of group.children.slice()){
        if(!o.isMesh||o.isInstancedMesh||o.material.transparent)continue;
        const list=buckets.get(o.material)||[];
        list.push(o);
        buckets.set(o.material,list);
      }
      for(const [material,list] of buckets){
        if(list.length<2)continue;
        const parts=list.map(o=>{
          o.updateMatrix();
          const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
          return g.applyMatrix4(o.matrix);
        });
        const merged=mesh(group,mergeGeometries(parts),material);
        parts.forEach(g=>g.dispose());
        for(const o of list){
          group.remove(o);
          if(hits.includes(o)){o.visible=false;group.add(o)}
        }
        merged.userData.batch=true;
      }
    });

    const ringMaterial=lid.children.find(o=>o.geometry?.type==='TorusGeometry').material;
    const stamp=texture(128,128,c=>{
      const contact=c.createRadialGradient(64,64,5,64,64,64);
      contact.addColorStop(0,'rgba(0,0,0,.96)');
      contact.addColorStop(.52,'rgba(0,0,0,.72)');
      contact.addColorStop(1,'rgba(0,0,0,0)');
      const floor=c.createRadialGradient(60,63,12,64,64,64);
      floor.addColorStop(0,'rgba(28,28,31,.65)');
      floor.addColorStop(1,'rgba(17,17,19,0)');
      c.fillStyle=floor;c.fillRect(0,0,128,128);
      c.translate(3,2);c.scale(.85,.85);
      c.fillStyle=contact;c.fillRect(0,0,128,128);
    });
    const shadow=mesh(scene,new T.PlaneGeometry(420,420),own(new T.MeshBasicMaterial({
      map:stamp,transparent:true,depthWrite:false,toneMapped:false
    })),0,-18,0);
    shadow.rotation.x=-Math.PI/2;
    const exempt=[label,shadow];
    for(const group of plates)group.traverse(o=>{
      if(o.isMesh&&o.visible){
        o.receiveShadow=true;
        o.castShadow=!o.material.transparent&&(
          o.userData.index!==undefined||o.parent.parent===lid||
          (o.isInstancedMesh&&o.count===11)||o.userData.batch===true
        );
      }
    });

    // Linear HDR beauty → contact occlusion → optional sample average → ACES/sRGB → SMAA.
    const target=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
    const beauty=target(hdr?T.HalfFloatType:T.UnsignedByteType,true);
    const encoded=target(T.UnsignedByteType);
    let ao=null,composite=null,history=null;
    if(!lightTier){
      ao=own(new GTAOPass(scene,camera,1,1,undefined,
        {radius:3.4,thickness:2.2,samples:8,scale:.85},
        {radius:2,samples:4,rings:1}
      ));
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.pdMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.blendIntensity=.27;
      ao.blendMaterial.blendSrcAlpha=T.ZeroFactor;
      ao.blendMaterial.blendDstAlpha=T.OneFactor;
      own(ao.gtaoMaterial);
      own(ao.blendMaterial);
      composite=target(T.HalfFloatType);
      history=target(T.HalfFloatType);
    }

    const smaa=own(new SMAAPass(1,1));
    const quad=own(new FullScreenQuad(null));
    const vertex='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
    function screenMaterial(fragment,extra={}){
      return own(new T.ShaderMaterial({
        uniforms:{source:{value:null},factor:{value:1}},
        vertexShader:vertex,fragmentShader:fragment,
        depthTest:false,depthWrite:false,toneMapped:false,...extra
      }));
    }
    const sumPass=screenMaterial(
      'uniform sampler2D source;varying vec2 v;void main(){gl_FragColor=texture2D(source,v)/16.;}',
      {transparent:true,blending:T.CustomBlending,blendEquation:T.AddEquation,
       blendSrc:T.OneFactor,blendDst:T.OneFactor}
    );
    const display=screenMaterial(`
      uniform sampler2D source;
      uniform float factor;
      varying vec2 v;
      #include <common>
      #include <tonemapping_pars_fragment>
      void main(){
        vec4 c=texture2D(source,v)*factor;
        float a=clamp(c.a,0.,1.);
        vec3 linear=c.rgb/max(c.a,.00001);
        linear*=1.-.035*smoothstep(.18,.75,length(v-.5));
        vec3 mapped=ACESFilmicToneMapping(linear);
        gl_FragColor=vec4(sRGBTransferOETF(vec4(mapped,1.)).rgb*a,a);
      }`);
    display.uniforms.toneMappingExposure={value:renderer.toneMappingExposure};

    let samples=0,pw=0,ph=0,slow=0,moveScale=1,lastShadow='',dirty=true;
    function sizeTargets(ratio){
      const max=renderer.capabilities.maxTextureSize;
      ratio=Math.min(ratio,max/w,max/h);
      const nx=Math.max(1,Math.floor(w*ratio)),ny=Math.max(1,Math.floor(h*ratio));
      if(nx===pw&&ny===ph)return;
      pw=nx;ph=ny;samples=0;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w,h,false);
      beauty.setSize(nx,ny);
      encoded.setSize(nx,ny);
      smaa.setSize(nx,ny);
      if(ao&&!lightTier){
        ao.setSize(Math.max(1,Math.ceil(nx*.67)),Math.max(1,Math.ceil(ny*.67)));
        composite.setSize(nx,ny);
        history.setSize(nx,ny);
      }
    }
    function halton(n,base){
      let result=0,fraction=1;
      while(n){
        fraction/=base;
        result+=fraction*(n%base);
        n=Math.floor(n/base);
      }
      return result;
    }
    function photograph(still){
      const refining=still&&!lightTier;
      if(!refining||dirty)samples=0;
      sizeTargets(refining?devicePixelRatio:Math.min(devicePixelRatio,2)*moveScale);
      const projection=camera.projectionMatrix;
      const cx=projection.elements[12],cy=projection.elements[13];
      if(refining){
        projection.elements[12]+=(halton(samples+1,2)-.5)*2/pw;
        projection.elements[13]+=(halton(samples+1,3)-.5)*2/ph;
        camera.projectionMatrixInverse.copy(projection).invert();
      }

      renderer.setRenderTarget(beauty);
      renderer.render(scene,camera);
      let source=beauty;
      if(ao&&!lightTier){
        exempt.forEach(o=>o.visible=false);
        ao.render(renderer,composite,beauty);
        exempt.forEach(o=>o.visible=true);
        source=composite;
      }
      projection.elements[12]=cx;
      projection.elements[13]=cy;
      camera.projectionMatrixInverse.copy(projection).invert();

      if(refining){
        renderer.setRenderTarget(history);
        if(!samples)renderer.clear();
        renderer.autoClear=false;
        quad.material=sumPass;
        sumPass.uniforms.source.value=source.texture;
        quad.render(renderer);
        renderer.autoClear=true;
        samples++;
        source=history;
      }
      display.uniforms.source.value=source.texture;
      display.uniforms.factor.value=refining?16/samples:1;
      renderer.setRenderTarget(encoded);
      quad.material=display;
      quad.render(renderer);
      smaa.renderToScreen=true;
      smaa.render(renderer,null,encoded);
      dirty=false;
      return refining&&samples<16;
    }

    const rows=names.map((name,i)=>{
      const tag=document.createElement('div');
      const number=document.createElement('span'),word=document.createElement('span');
      tag.style.cssText='visibility:hidden;position:absolute;top:0;left:0;display:flex;align-items:center;gap:.5em;white-space:nowrap;pointer-events:none;color:#f2f1ee;font:600 14px/1.2 Inter,Arial,sans-serif';
      number.style.cssText='font:500 .83em "Geist Mono",monospace;color:#a3a19d';
      number.textContent='0'+(i+1);
      word.textContent=name;
      tag.append(number,word);
      const lines=Array.from({length:2},()=>{
        const line=document.createElement('i');
        line.style.cssText='position:absolute;left:0;top:0;height:1px;background:rgba(242,241,238,.3);transform-origin:0 50%;pointer-events:none';
        frame.append(line);
        return line;
      });
      frame.append(tag);
      return {tag,word,lines};
    });

    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const fine=matchMedia('(hover:hover) and (pointer:fine)');
    const weights=new Float64Array(6),from=new Float64Array(6);
    const anchors=plates.map(()=>new T.Vector3());
    let p=progress,v=0,previous=0,chosen=-1,changed=0,hover=-1;
    let clock=0,lastTick=0,w=0,h=0,labelWidth=0,phone=false,dpr=0;
    const signal=new T.Color(0xe5172f),silver=new T.Color(0x6f6d69);
    const point=new T.Vector3(),ray=new T.Raycaster(),pointer=new T.Vector2();

    function wake(){
      if(dead||lost||!visible||document.hidden||!w||!h)return;
      clearTimeout(timer);
      timer=0;
      if(!raf)raf=requestAnimationFrame(draw);
    }
    function invalidate(){
      dirty=true;
      samples=0;
      wake();
    }
    function hoverAt(i){
      if(i===hover)return;
      hover=i;
      invalidate();
      el.onHover?.(i);
    }
    listen(frame,'pointermove',e=>{
      if(!fine.matches||!w||!h)return;
      const rect=frame.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/w*2-1,1-(e.clientY-rect.top)/h*2);
      ray.setFromCamera(pointer,camera);
      hoverAt(ray.intersectObjects(hits,false)[0]?.object.userData.index??-1);
    });
    listen(frame,'pointerleave',()=>hoverAt(-1));

    function resize(){
      const nw=frame.clientWidth,nh=frame.clientHeight,nd=Math.min(devicePixelRatio||1,2);
      if(nw===w&&nh===h&&nd===dpr)return;
      w=nw;h=nh;dpr=nd;
      if(!w||!h)return;
      dirty=true;samples=0;
      phone=w/h<.9||w<580;
      labelWidth=0;
      rows.forEach(({tag,word},i)=>{
        word.textContent=phone?['Answer','Book','Quotes','Invoices','Reviews','Web'][i]:names[i];
        tag.style.fontSize=(phone?12:14)+'px';
        labelWidth=Math.max(labelWidth,tag.offsetWidth);
      });
      wake();
    }
    document.fonts?.ready.then(()=>{if(!dead){w=0;resize()}});

    const shadowBox=new T.Box3(),shadowPoint=new T.Vector3();
    function caster(x,y,z){
      shadowPoint.set(x,y,z).applyMatrix4(shadowCam.matrixWorldInverse);
      shadowBox.expandByPoint(shadowPoint);
    }
    const bounds=new Float64Array(4);
    function include(x,y,z){
      const u=(x-z)*Math.SQRT1_2,t=y*.8660254038-(x+z)*.3535533906;
      bounds[0]=Math.min(bounds[0],u);
      bounds[1]=Math.max(bounds[1],u);
      bounds[2]=Math.min(bounds[2],t);
      bounds[3]=Math.max(bounds[3],t);
    }
    function leader(line,x,y,xx,yy,opacity){
      const dx=xx-x,dy=yy-y;
      line.style.width=Math.hypot(dx,dy)+'px';
      line.style.transform='translate('+x+'px,'+y+'px) rotate('+Math.atan2(dy,dx)+'rad)';
      line.style.opacity=opacity;
    }

    function draw(now){
      raf=0;
      if(dead||lost||!visible||document.hidden||!w||!h)return;
      const elapsed=previous?now-previous:0,dt=previous?Math.min(.05,elapsed/1000):1/60;
      previous=now;
      const goal=progress;
      const e=p-goal,k=v+40*e,d=Math.exp(-40*dt);
      p=goal+(e+k*dt)*d;
      v=(v-40*k*dt)*d;
      if(reduce.matches||(Math.abs(p-goal)<.00008&&Math.abs(v)<.004)){p=goal;v=0}

      const index=active>=0?active:hover;
      if(index!==chosen){
        from.set(weights);
        chosen=index;
        changed=now;
      }
      const select=reduce.matches?1:ease(now,changed,changed+250);
      const show=ease(p,.14,.22)*(1-ease(p,.84,.95));
      const hold=ease(p,.2,.24)*(1-ease(p,.8,.84));
      let sum=0;
      for(let i=0;i<6;i++){
        weights[i]=from[i]+((i===chosen?1:0)-from[i])*select;
        sum+=weights[i];
      }

      shadowBox.makeEmpty();
      let lift=0;
      bounds.set([Infinity,-Infinity,Infinity,-Infinity]);
      for(let i=5;i>=0;i--){
        if(i<5){
          const open=ease(p,.2+i*.1,.28+i*.1);
          const close=ease(p,.8+(4-i)*.012,.87+(4-i)*.012);
          lift+=46*open**(1+.035*i)*(1-close);
        }
        const g=plates[i],fraction=i===5?0:lift/(46*(5-i));
        g.position.set((5-i)*1.3*fraction,(5-i)*35.5+lift+6*weights[i]*hold,0);
        g.rotation.y=(5-i)*Math.PI/300*fraction;

        const amount=active<0?weights[i]:weights[i]*hold;
        edges[i].color.copy(silver).lerp(signal,amount);
        edges[i].emissive.copy(signal);
        edges[i].emissiveIntensity=.68*amount;
        const gain=1-.55*(sum-weights[i])*hold;
        gains[i].forEach(m=>m.userData.gain.value=gain);

        g.updateMatrixWorld(true);
        for(const x of [-140,140])for(const y of [-18,17.5])for(const z of [-140,140]){
          point.set(x,y,z).applyMatrix4(g.matrixWorld);
          include(point.x,point.y,point.z);
          caster(point.x,point.y,point.z);
        }
        anchors[i].set(138,10,-136).applyMatrix4(g.matrixWorld);
      }

      screws.forEach((s,i)=>{
        const rise=ease(p,.06+i*.009,.213+i*.009)*(1-ease(p,.94+i*.003,.991+i*.003));
        s.position.y=15.25+70*rise;
        s.rotation.y=i*.31+4*Math.PI*(1-(1-rise)**2);
        point.copy(s.position).applyMatrix4(lid.matrixWorld);
        include(point.x-6,point.y+3,point.z+6);
        include(point.x+6,point.y+3,point.z-6);
        include(point.x-6,point.y+3,point.z-6);
        caster(point.x,point.y+5,point.z);
      });
      for(const [x,y,z] of cablePoints){include(x+3,y-3,z-3);caster(x,y,z)}

      const pose=[p,...weights.map(n=>n*hold)].join('/');
      if(pose!==lastShadow){
        const lo=shadowBox.min,hi=shadowBox.max;
        shadowCam.left=lo.x-9;shadowCam.right=hi.x+9;
        shadowCam.top=hi.y+9;shadowCam.bottom=lo.y-9;
        shadowCam.near=Math.max(1,-hi.z-12);
        shadowCam.far=-lo.z+12;
        shadowCam.updateProjectionMatrix();
        renderer.shadowMap.needsUpdate=true;
        lastShadow=pose;
      }

      const pad=.08*w,right=w-pad,labelX=right-labelWidth;
      const end=phone?labelX-14:Math.min(w*.60,labelX-22);
      const zoneRight=right+(end-right)*show,zoneLeft=pad;
      const scale=Math.min(
        Math.max(1,zoneRight-zoneLeft)/(bounds[1]-bounds[0]),
        h*.70/(bounds[3]-bounds[2])
      );
      const centerX=(zoneLeft+zoneRight)/2;
      const midU=(bounds[0]+bounds[1])/2,midT=(bounds[2]+bounds[3])/2;
      camera.left=midU-centerX/scale;
      camera.right=camera.left+w/scale;
      camera.top=midT+h/(2*scale);
      camera.bottom=midT-h/(2*scale);
      camera.updateProjectionMatrix();

      // Project leaders with the unjittered camera so text stays stationary during refinement.
      let rail=-Infinity;
      for(const a of anchors){
        a.project(camera);
        a.x=(a.x+1)*w/2;
        a.y=(1-a.y)*h/2;
        rail=Math.max(rail,a.x);
      }
      rail+=2;
      const gap=Math.min(h*.145,Math.max(phone?21:26,(anchors[5].y-anchors[0].y)/5));
      const start=clamp((anchors[0].y+anchors[5].y-5*gap)/2,h*.08,h*.92-5*gap);
      const opacity=show*ease(labelX-rail,3,10);
      rows.forEach(({tag,lines},i)=>{
        const y=start+i*gap,a=anchors[i],alpha=opacity*ease(p,.2+i*.1,.26+i*.1)*(1-.55*(sum-weights[i])*hold);
        tag.style.transform='translate('+labelX+'px,'+y+'px) translateY(-50%)';
        tag.style.opacity=alpha;
        tag.style.visibility=alpha>.001?'visible':'hidden';
        leader(lines[0],a.x,a.y,rail,a.y,alpha);
        leader(lines[1],rail,a.y,labelX-5,y,alpha);
      });

      const moving=p!==goal||v!==0||select<1;
      if(moving&&elapsed>28&&elapsed<250)slow++;
      else slow=Math.max(0,slow-1);

      if(slow>22){
        slow=0;
        moveScale=Math.max(.62,moveScale*.85);
        if(!lightTier){
          lightTier=true;samples=0;
          sh.map?.dispose();sh.map=null;
          sh.mapSize.setScalar(2048);
          lastShadow='';
          ao.setSize(1,1);
          history.setSize(1,1);
          composite.setSize(1,1);
        }
      }

      // Hold the exposure and lighting still throughout one accumulation sequence.
      if(!reduce.matches&&(moving||lightTier))clock+=lastTick?Math.min(100,now-lastTick):0;
      lastTick=now;
      const phase=reduce.matches?0:clock*.001;
      panels[1].position.x=-375+16*Math.sin(phase*2*Math.PI/7);
      panels[1].lookAt(aim);
      ringMaterial.emissiveIntensity=.9+.1*Math.sin(phase*Math.PI/2);

      const more=photograph(!moving);
      if(moving||more)wake();
      else if(lightTier&&!reduce.matches)timer=setTimeout(wake,1000/30);
    }

    session.wake=invalidate;
    function visibility(){
      stop();
      previous=lastTick=0;
      invalidate();
    }
    listen(document,'visibilitychange',visibility);
    listen(reduce,'change',invalidate);
    listen(window,'resize',resize);
    listen(canvas,'webglcontextlost',e=>{
      e.preventDefault();
      lost=true;
      stop();
      frame.style.visibility='hidden';
    });
    listen(canvas,'webglcontextrestored',()=>{if(!dead)mount(el)});
    const ro=new ResizeObserver(resize);
    ro.observe(el);
    releases.push(()=>ro.disconnect());
    const io=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      visibility();
    });
    io.observe(el);
    releases.push(()=>io.disconnect());
    resize();
  }

  build().catch(()=>{
    if(dead)return;
    dispose();
    const fallback=document.createElement('div');
    fallback.style.cssText='width:100%;height:100%;background:#111113';
    el.append(fallback);
    session={wake(){},dispose(){fallback.remove()}};
  });
}

window.CinderUnit={
  mount,
  setProgress(p){
    if(Number.isFinite(p)&&clamp(p)!==progress){
      progress=clamp(p);
      session?.wake();
    }
  },
  setActive(i){
    if(Number.isInteger(i)&&i>=-1&&i<6&&i!==active){
      active=i;
      session?.wake();
    }
  },
  destroy
};
window.dispatchEvent(new Event('cinder-unit'));
