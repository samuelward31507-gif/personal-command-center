// The Cinder unit, V3 teardown: six trays with working mechanisms. API: mount, setProgress, setActive, destroy.
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
    const [T,{mergeGeometries},{RectAreaLightUniformsLib},{GTAOPass},{SMAAPass},{FullScreenQuad}]=await Promise.all([
      import('three'),
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
    renderer.outputColorSpace=T.SRGBColorSpace;
    canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Six aluminum instrument trays with exposed mechanisms and ribbon cables');
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

    // Studio illumination and reflection cards share the same orientation.
    renderer.toneMappingExposure=1.08;
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
        data.data.set([128,128+v*8,253,255],n);
      }
      c.putImageData(data,0,0);
    },false);
    grain.wrapS=grain.wrapT=T.RepeatWrapping;
    grain.repeat.set(2,4);

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
    const top=mat(0x77767c,.32,{
      anisotropy:.40,anisotropyRotation:0,clearcoat:.12,clearcoatRoughness:.34,
      normalMap:grain,normalScale:new T.Vector2(.12,.18)
    });

    const tau=Math.PI*2,half=Math.PI/2,geometryCache=new Map();
    const plates=[],covers=[],hits=[],screws=[],leds=[],rims=[],parts=[],batches=[];
    const gains=new Float32Array(6).fill(1),selection=new Float32Array(6),seams=new Float32Array(5);
    const graphite=0x2a2a2f,bright=0xa3a19d,black=0x111113,gold=0xb89b5e;
    const alloy=mat(0xffffff,.36,{metalness:.88,normalMap:grain,normalScale:new T.Vector2(.08,.12)});
    const enamel=mat(0xffffff,.54,{metalness:.23});
    const lamp=own(new T.MeshBasicMaterial({color:0xffffff}));
    const smoke=mat(0x3a3a40,.28,{
      metalness:.12,clearcoat:.94,transparent:true,opacity:.28,depthWrite:false
    });
    const screenMat=mat(0x3a3a40,.31,{metalness:.24,clearcoat:.8});

    function make(parent,x=0,y=0,z=0){
      const node=new T.Group();
      node.position.set(x,y,z);
      parent.add(node);
      return node;
    }
    function axis(parent,x,y,z){
      const node=make(parent,x,y,z);
      node.userData.layer=parent.userData.layer;
      return node;
    }
    function stock(key,fn){
      if(!geometryCache.has(key))geometryCache.set(key,own(fn()));
      return geometryCache.get(key);
    }
    function part(parent,g,m,color,x=0,y=0,z=0){
      const node=axis(parent,x,y,z);
      node.userData.tint=new T.Color(color);
      parts.push({node,g:own(g),m,index:parent.userData.layer??-1});
      return node;
    }
    function rect(w,d,r,x=0,z=0){
      const s=new T.Shape(),l=x-w/2,b=-z-d/2,h=l+w,t=b+d;
      s.moveTo(l+r,b);s.lineTo(h-r,b);s.quadraticCurveTo(h,b,h,b+r);
      s.lineTo(h,t-r);s.quadraticCurveTo(h,t,h-r,t);s.lineTo(l+r,t);
      s.quadraticCurveTo(l,t,l,t-r);s.lineTo(l,b+r);s.quadraticCurveTo(l,b,l+r,b);
      return s;
    }
    function circle(r,x=0,z=0){
      const s=new T.Shape(),n=r>40?112:r>10?48:20;
      for(let i=0;i<n;i++){
        const a=tau*i/n;
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
      g.rotateX(-half);
      const uv=g.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/280,uv.getY(i)/280);
      g.clearGroups();
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
        smooth.push(...new T.QuadraticBezierCurve(start,b,end).getPoints(mobile?2:6));
      }
      smooth.push(path.at(-1));
      return new T.LatheGeometry(smooth,n);
    }
    function plate(w,d,r,h,b=.3){
      return stock(['mill',w,d,r,h,b].join(),()=>cut(rect(w,d,r),h,b,4));
    }
    function block(parent,w,h,d,color,x,y,z,m=alloy){
      const micro=Math.min(w,h,d)<1.5;
      const geo=stock(micro?'small package':'milled block',()=>{
        const s=rect(1,1,.065);
        if(!micro)return cut(s,1,.035,3);
        const g=new T.ExtrudeGeometry(s,{
          depth:1,curveSegments:1,bevelSegments:1,bevelThickness:.04,bevelSize:.04
        });
        g.rotateX(-half);g.clearGroups();
        return g;
      });
      const o=part(parent,geo,m,color,x,y,z);
      o.scale.set(w,h,d);
      return o;
    }
    function cylinder(r,h,n=32){
      return stock(['turn',r,h,n].join(),()=>new T.CylinderGeometry(r,r,h,n));
    }
    function wheel(parent,r,h,color,x,y,z,m=alloy,n=mobile?24:48){
      return part(parent,cylinder(r,h,n),m,color,x,y,z);
    }
    function ring(parent,r,t,color,x,y,z,m=alloy){
      const geo=stock(['ring',r,t].join(),()=>new T.TorusGeometry(r,t,mobile?5:8,mobile?40:80));
      const o=part(parent,geo,m,color,x,y,z);
      o.rotation.x=-half;
      return o;
    }

    // Copper routing and its normal map use the same artwork.
    const chipSites=[[-96,99],[110,5],[-68,-73]];
    function pcbPattern(normal){
      return texture(512,512,c=>{
        const height=document.createElement('canvas');
        height.width=height.height=512;
        const a=height.getContext('2d');
        a.fillStyle='#111113';a.fillRect(0,0,512,512);
        a.strokeStyle='#49494b';a.lineWidth=1.55;a.lineCap='round';
        for(let bank=0;bank<3;bank++)for(let pin=0;pin<12;pin++){
          const [cx,cz]=chipSites[bank];
          const x=(cx+123)*512/260+pin*2.5,y=(cz+125)*512/260;
          const bend=(bank===0?-1:1)*(14+pin*2),end=445-pin*3;
          a.beginPath();a.moveTo(x,y);a.lineTo(x,y+bend);
          a.lineTo(x+17,y+bend+Math.sign(bend)*17);
          a.lineTo(end-20,y+bend+Math.sign(bend)*17);
          a.lineTo(end,y+bend+43);a.lineTo(end,445);a.stroke();
          a.fillStyle='#77767c';
          a.fillRect(x-1.7,y-2,3.4,5);a.fillRect(end-1.7,444,3.4,5);
        }
        if(!normal){c.drawImage(height,0,0);return}
        const src=a.getImageData(0,0,512,512).data,img=c.createImageData(512,512);
        for(let y=0;y<512;y++)for(let x=0;x<512;x++){
          const i=4*(y*512+x);
          img.data.set([
            128+(src[i]-src[4*(y*512+(x+1)%512)])*.35,
            128+(src[4*(((y+1)%512)*512+x)]-src[i])*.35,254,255
          ],i);
        }
        c.putImageData(img,0,0);
      },!normal);
    }
    const boardMat=mat(0xffffff,.61,{
      metalness:.13,envMapIntensity:.45,specularIntensity:.48,
      map:pcbPattern(false),normalMap:pcbPattern(true)
    });
    const boardGeo=own(new T.PlaneGeometry(260,260));
    boardGeo.rotateX(-half);
    const ids=['ANSWER','BOOK','FOLLOW','INVOICE','REVIEW','WEB'];
    function inscription(text){
      const map=texture(2048,128,c=>{
        c.font='500 68px "Geist Mono",monospace';
        c.textBaseline='middle';
        c.fillStyle='#a3a19d';
        const widths=Array.from(text,ch=>c.measureText(ch).width);
        let x=(2048-widths.reduce((a,b)=>a+b,0)-7*(text.length-1))/2;
        Array.from(text).forEach((ch,i)=>{c.fillText(ch,x,64);x+=widths[i]+7});
      });
      return own(new T.MeshBasicMaterial({map,color:0xf2f1ee,transparent:true,depthWrite:false}));
    }

    const frameShape=rect(280,280,5);
    frameShape.holes.push(rect(264,264,4));
    const collar=cut(frameShape,8.7,.28,5),wall=cut(frameShape,18,.45,5);
    const base=plate(277,277,5,2.5);
    const edgeShape=rect(279,279,5);
    edgeShape.holes.push(rect(275,275,4));
    const trimGeo=cut(edgeShape,1,.23,4);
    const tabShape=rect(32,12,2,9,0);
    tabShape.holes.push(circle(4.4));
    const tab=cut(tabShape,2.6,.2,4);
    const driverX=4,driverZ=12;
    const fastenerHead=circle(4),cross=new T.Shape();
    [
      [-.65,-2.6],[.65,-2.6],[.65,-.65],[2.6,-.65],[2.6,.65],[.65,.65],
      [.65,2.6],[-.65,2.6],[-.65,.65],[-2.6,.65],[-2.6,-.65],[-.65,-.65]
    ].forEach(([x,y],i)=>cross[i?'lineTo':'moveTo'](x,y));
    cross.closePath();fastenerHead.holes.push(cross);
    const screwGeo=cut(fastenerHead,1.3,.18,4);
    const ventMark=plate(2,12,.9,.22,.06);
    const lidPts=[[-117,-117],[117,-117],[-117,117],[117,117]];

    for(let i=0;i<6;i++){
      const g=make(scene);
      g.userData.layer=i;
      plates.push(g);
      const c=axis(g,0,13.6,0);
      covers.push(c);
      part(g,base,alloy,graphite,0,-17,0);
      part(g,wall,alloy,0x303035,0,-14.5,0);
      part(g,boardGeo,boardMat,0xffffff,0,-12.9,0);

      if(i!==3)part(c,collar,alloy,graphite,0,-9.15,0);
      else{
        // The break in the right collar is the receipt exit.
        block(c,273,9,5,graphite,0,-9.15,136);
        block(c,273,9,5,graphite,0,-9.15,-136);
        block(c,5,9,266,graphite,-136,-9.15,0);
        block(c,5,9,171,graphite,136,-9.15,-48);
        block(c,5,9,25,graphite,136,-9.15,121);
      }
      const shape=rect(279,279,5);
      shape.holes.push(i?rect(224,199,7,18,32):circle(64,driverX,driverZ));
      for(const x of [-124,124])shape.holes.push(circle(2.25,x,-83));
      if(!i){
        lidPts.forEach(([x,z])=>shape.holes.push(circle(5.5,x,z)));
        for(const sx of [-1,1])for(const sz of [-1,1])for(let pin=0;pin<7;pin++){
          const a=pin*tau/6,r=pin===6?0:3.1,hole=new T.Path();
          hole.absarc(driverX+66*sx+r*Math.cos(a),-driverZ-44*sz+r*Math.sin(a),1.05,0,tau,false);
          shape.holes.push(hole);
        }
      }
      const cover=part(c,stock(i?'open cover':'dial cover',()=>cut(shape,3,.48,6)),top,0xffffff);
      cover.userData.cast=true;
      rims.push(part(g,trimGeo,alloy,0x6f6d69,0,3.5,0));
      for(const side of [-1,1]){
        for(const z of [-109,109]){
          wheel(g,4.5,18,graphite,side*112,-4,z);
          part(g,tab,alloy,graphite,side*112,3.6,z).rotation.y=side<0?Math.PI:0;
          part(g,screwGeo,alloy,bright,side*112,5,z);
        }
        wheel(g,1.9,28.5,bright,side*124,.5,-83);
      }
      for(let j=0;j<13;j++){
        part(g,ventMark,enamel,black,(j-6)*7,-5,140.48).rotation.x=half;
      }
      const line=part(c,new T.PlaneGeometry(134,8.4),inscription(
        i?'CR-0'+(i+1)+' '+ids[i]+'   △  ESD':'CINDER REVENUE · UNIT'
      ),0x18181b,0,3.53,i?-93:126);
      line.rotation.x=-half;
      part(g,new T.PlaneGeometry(65,5.4),inscription('CR-0'+(i+1)+' '+ids[i]),0x303035,-87,-4,140.6);
      leds.push(block(g,8,2,2.4,0x181818,101,-5,139.5,lamp));
      if(i<5)block(g,8,4,17,graphite,139,-4,-62,enamel);
      if(i>0)block(g,8,4,17,graphite,139,-4,-41,enamel);

      if(!mobile)for(const [x,z] of chipSites){
        block(g,17,2.8,15,black,x,-12,z,enamel);
        for(let k=0;k<8;k++)for(const side of [-1,1]){
          block(g,2.7,.7,1.05,0x6f6d69,x+side*9.2,-12,z+(k-3.5)*1.65);
        }
        for(let k=0;k<4;k++){
          block(g,4.2,1.4,2,0x565250,x+12,-12,z+k*4,enamel);
          wheel(g,1.1,.32,gold,x-15,-12.5,z+k*3,alloy,8);
        }
        wheel(g,3.1,5,graphite,x+19,-10,z+13,enamel);
      }
    }

    // 01 — Speaker assembly stays in the tray. The dial rides with its cover.
    const lid=plates[0],cap=covers[0];
    const driver=axis(lid,driverX,0,driverZ),cone=axis(driver,0,0,0);
    wheel(driver,51,6,black,0,-8,0,enamel);
    ring(driver,48,4,graphite,0,-4,0);
    part(cone,lathe([[47,0],[43,1],[16,-6],[9,-3],[.01,-4]],mobile?32:72),enamel,0x48484b);
    ring(driver,45,2.2,black,0,1,0,enamel);
    wheel(cone,9,2,graphite,0,-2.8,0);
    for(let j=0;j<4;j++){
      const x=(j%2?1:-1)*66,z=(j<2?-1:1)*44;
      wheel(driver,5.4,3,bright,x,-5,z);
      wheel(driver,3.3,1,black,x,-3,z,enamel);
    }
    const bearing=axis(cap,driverX,1.2,driverZ);
    ring(bearing,61.7,2,bright,0,0,0);
    const dialLight=ring(bearing,58.5,1.15,0xe5172f,0,0,0,lamp);
    ring(bearing,54.8,1.6,graphite,0,0,0);
    const dial=circle(53);dial.holes.push(circle(44));
    part(bearing,cut(dial,2,.35,6),top,0x929298);
    for(let j=0;j<3;j++){
      const a=j*tau/3;
      block(bearing,2.5,1.2,47,graphite,23*Math.sin(a),.3,23*Math.cos(a)).rotation.y=a;
    }
    wheel(bearing,7,2.4,graphite,0,1,0);
    block(bearing,1.2,.6,6,bright,0,2.35,-3);
    for(let j=0;j<48;j++){
      const a=j*tau/48;
      block(cap,.65,.32,3.6,bright,driverX+69*Math.sin(a),3.48,driverZ+69*Math.cos(a)).rotation.y=a;
    }
    for(let j=0;j<36;j++)for(const sign of [-1,1]){
      block(lid,.85,12,1,0x6f6d69,sign*140,-11,(j-17.5)*4.2).rotation.z=sign*.18;
    }
    part(cap,new T.PlaneGeometry(92,5.75),inscription('CR-01 ANSWER  /  SN 000126'),
      0x18181b,0,3.52,-94).rotation.x=-half;

    const helix=new T.CatmullRomCurve3(Array.from({length:145},(_,j)=>{
      const a=j*tau/12;
      return new T.Vector3(1.9*Math.cos(a),-29+j*.18,1.9*Math.sin(a));
    }));
    const lidHead=own(screwGeo.clone());
    const thread=new T.TubeGeometry(helix,mobile?36:144,.34,mobile?3:5,false);
    for(const [x,z] of lidPts){
      const screw=axis(cap,x,2.2,z);
      screws.push(screw);
      part(screw,lidHead,alloy,bright);
      wheel(screw,1.8,29,bright,0,-14.4,0);
      part(screw,thread,alloy,bright);
    }

    // 02 — Calendar wheels, shaft, split leaf and weekday keys.
    const numberMap=texture(2048,256,c=>{
      c.fillStyle='#1c1c1f';c.fillRect(0,0,2048,256);
      c.fillStyle='#f2f1ee';c.font='600 178px Inter,Arial,sans-serif';
      c.textAlign='center';c.textBaseline='middle';
      for(let j=0;j<10;j++){
        c.save();c.translate((j+.5)*204.8,128);c.rotate(half);c.fillText(j,0,0);c.restore();
        c.fillStyle='#111113';c.fillRect(j*204.8,0,4,256);c.fillStyle='#f2f1ee';
      }
    });
    const drumMat=mat(0xffffff,.43,{map:numberMap,metalness:.18});
    function numberDrum(parent,x,y,z,r,width){
      const axle=axis(parent,x,y,z);
      const geo=stock(['digits',r,width].join(),()=>new T.CylinderGeometry(r,r,width,10,1,true));
      part(axle,geo,drumMat,0xffffff).rotation.z=half;
      return axle;
    }
    const book=axis(plates[1],22,0,9);
    const drums=[numberDrum(book,30,-2,73,13,26),numberDrum(book,61,-2,73,13,26)];
    const leafPivot=axis(book,61,7.1,79);
    const flapGeo=own(new T.PlaneGeometry(24,7));flapGeo.translate(0,3.5,0);
    part(leafPivot,flapGeo,mat(0xffffff,.48,{
      metalness:.15,side:T.DoubleSide,map:texture(256,96,c=>{
        c.fillStyle='#1c1c1f';c.fillRect(0,0,256,96);
        c.fillStyle='#f2f1ee';c.textAlign='center';
        c.font='600 176px Inter,Arial,sans-serif';c.fillText('6',128,166);
      })
    }),0xffffff);
    wheel(book,2.3,81,bright,46,-2,73).rotation.z=half;
    for(const x of [9,82])block(book,4,22,37,bright,x,-12,73);
    block(book,82,1.1,1.4,black,46,7.1,79,enamel);
    for(let j=0;j<7;j++)block(book,9,3,9,j===3?0xe5172f:graphite,5+j*13,-5,106,j===3?lamp:alloy);
    const weekInk=own(new T.MeshBasicMaterial({
      transparent:true,depthWrite:false,map:texture(896,128,c=>{
        c.fillStyle='#f2f1ee';c.font='600 88px "Geist Mono",monospace';
        c.textAlign='center';c.textBaseline='middle';
        [...'MTWTFSS'].forEach((d,i)=>c.fillText(d,64+128*i,64));
      })
    }));
    part(book,new T.PlaneGeometry(91,7.5),weekInk,0xffffff,44,-1.8,106).rotation.x=-half;

    // 03 — The escape wheel, transmission and balance have independent pivots.
    function gearShape(teeth,r){
      const s=new T.Shape();
      for(let i=0;i<teeth*4;i++){
        const a=i*tau/(teeth*4),radius=(i%4===1||i%4===2)?r:r-2.4;
        s[i?'lineTo':'moveTo'](radius*Math.cos(a),radius*Math.sin(a));
      }
      s.closePath();s.holes.push(circle(r*.54));
      return s;
    }
    const follow=axis(plates[2],115,0,147),gears=[];
    follow.rotation.y=Math.PI;
    for(const [x,z,r,teeth] of [[65,84,25,24],[27,84,15,14],[5,69,13,12]]){
      const o=axis(follow,x,-2,z);gears.push(o);
      part(o,cut(gearShape(teeth,r),2,.14,2),alloy,bright);
      for(let k=0;k<3;k++){
        const a=k*tau/3;
        block(o,2.8,1.8,r*.6,bright,Math.sin(a)*r*.26,.05,Math.cos(a)*r*.26).rotation.y=a;
      }
      wheel(o,3,3,graphite,0,1,0);
    }
    const balance=axis(follow,5,1,38);
    ring(balance,18.5,1.8,bright,0,0,0);
    block(balance,2,1.5,37,bright,0,-.5,0);
    wheel(balance,3.4,3,graphite,0,1,0);
    const spiral=new T.CatmullRomCurve3(Array.from({length:65},(_,j)=>{
      const a=j*tau/16,r=2+j*.21;
      return new T.Vector3(r*Math.cos(a),1.5,r*Math.sin(a));
    }));
    part(balance,new T.TubeGeometry(spiral,mobile?32:96,.46,4,false),alloy,bright);
    const fork=axis(follow,4,-1,55);
    block(fork,3,2,12,graphite,0,0,0);
    for(const x of [-3,3])block(fork,2,2,6,bright,x,0,5).rotation.y=x*.09;

    // 04 — Receipt stock passes over the feed roller and beneath the cutter.
    const invoice=plates[3],roller=axis(invoice,78,-.7,72);
    part(roller,cylinder(9,72,mobile?18:40),enamel,graphite).rotation.x=half;
    block(roller,1.5,1,69,0x6f6d69,0,8.8,0);
    for(const z of [32,112])block(invoice,27,22,5,bright,78,-12,z);
    const blade=new T.Shape();
    blade.moveTo(0,0);blade.lineTo(4,3);blade.lineTo(4,5);blade.lineTo(0,3);blade.closePath();
    part(invoice,new T.ExtrudeGeometry(blade,{
      depth:72,bevelSize:.13,bevelThickness:.13,bevelSegments:6
    }),alloy,bright,113,7.1,36);
    block(invoice,3.5,2,78,graphite,118,11.9,72);

    function strip(points,width){
      const pos=[],uv=[],idx=[];
      points.forEach(([x,y,z],i)=>{
        pos.push(x,y,z-width/2,x,y,z+width/2);
        uv.push(0,i/(points.length-1),1,i/(points.length-1));
        const k=2*i;
        if(i)idx.push(k-2,k-1,k,k,k-1,k+1);
      });
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      g.setIndex(idx);g.computeVertexNormals();
      return g;
    }
    const paperMat=mat(0xffffff,.83,{
      metalness:0,side:T.DoubleSide,map:texture(256,512,c=>{
        c.fillStyle='#d9d7d2';c.fillRect(0,0,256,512);c.fillStyle='#6f6d69';
        for(let j=0;j<10;j++){
          c.fillRect(24,28+j*43,75+(j%3)*16,3);c.fillRect(195,28+j*43,32,3);
        }
        for(let j=0;j<23;j++)c.fillRect(25+j*5,467,1+j%3,18);
      })
    });
    const paper=axis(invoice,0,0,0);
    const paperPath=[[42,-4,72],[62,4,72],[78,9.1,72],[105,7,72],[132,6,72],[152,4,72],[163,-1,72],[169,-9,72]];
    const feedCurve=new T.CatmullRomCurve3(paperPath.map(v=>new T.Vector3(...v)));
    part(paper,strip(feedCurve.getPoints(mobile?14:32).map(v=>v.toArray()),44),paperMat,0xffffff);

    // 05 — Stars on the barrel and a separately indexed three-wheel counter.
    const review=plates[4],starAxle=axis(review,28,-2,80);
    part(starAxle,cylinder(13,38,mobile?15:40),alloy,graphite).rotation.z=half;
    const star=new T.Shape();
    for(let i=0;i<10;i++){
      const a=half+i*Math.PI/5,r=i%2?2.9:6.6;
      star[i?'lineTo':'moveTo'](r*Math.cos(a),r*Math.sin(a));
    }
    star.closePath();
    const starGeo=cut(star,.5,.15,3);
    for(let i=0;i<5;i++){
      const a=i*tau/5;
      part(starAxle,starGeo,alloy,bright,0,13*Math.cos(a),13*Math.sin(a)).rotation.x=a;
    }
    const counters=[61,74,87].map(x=>numberDrum(review,x,-1,80,10,11));
    block(covers[4],115,1.2,39,0xffffff,49,-1,80,smoke);
    for(const x of [-10,108])block(covers[4],3,3,81,graphite,x,-2,96);

    // 06 — Display back, light guide, etched face and flex termination.
    const web=plates[5];
    block(web,119,3,69,graphite,44,-11,70);
    const backlight=block(web,111,2,61,0xf2f1ee,44,-6.7,70,lamp);
    const pageTex=texture(1024,512,c=>{
      c.fillStyle='#202023';c.fillRect(0,0,1024,512);c.fillStyle='#a3a19d';
      c.fillRect(50,46,190,13);c.fillRect(50,98,920,3);c.fillRect(50,143,387,28);
      c.fillRect(50,200,319,8);c.fillRect(50,225,244,8);
      c.strokeStyle='#6f6d69';c.lineWidth=3;c.strokeRect(550,141,415,170);
      for(let j=0;j<3;j++)c.strokeRect(50+j*314,358,282,91);
    });
    screenMat.map=pageTex;screenMat.color.setHex(0xffffff);
    screenMat.emissiveMap=pageTex;screenMat.emissive.setHex(0xf2f1ee);
    const pane=own(new T.PlaneGeometry(110,60));pane.rotateX(-half);
    const screen=part(web,pane,screenMat,0xffffff,44,-1,70);
    block(web,39,4,8,graphite,44,-10,24);
    for(let j=0;j<8;j++)block(web,1.3,.5,3.2,gold,32+j*3.4,-6,27);
    part(web,strip([[6,-8,31],[16,-4,31],[29,-4,31],[43,-8,31]],12),alloy,0x6f6d69);
    const cablePoints=[[97,-5,-136],[97,-5,-156],[110,-11,-176],[135,-15,-182],[156,-15,-190],[165,-15,-208]];
    const cablePath=new T.CatmullRomCurve3(cablePoints.map(p=>new T.Vector3(...p)));
    part(web,new T.TubeGeometry(cablePath,36,2.5,8,false),enamel,black);
    for(let j=0;j<5;j++)wheel(web,5-j*.4,3,black,97,-5,-140-j*3,enamel).rotation.x=half;

    // A shared batch can contain parts from several independently moving trays.
    const grouped=new Map();
    for(const obj of parts){
      const k=obj.g.uuid+obj.m.uuid;
      if(!grouped.has(k))grouped.set(k,[]);
      grouped.get(k).push(obj);
    }
    const scratchColor=new T.Color();
    for(const list of grouped.values()){
      const {g,m}=list[0],batch=own(new T.InstancedMesh(g,m,list.length));
      batch.frustumCulled=false;batch.receiveShadow=true;
      batch.castShadow=g===wall||g===base||g===lidHead||list.some(o=>o.node.userData.cast);
      batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(batch);batches.push([batch,list]);
      if(g===wall||list.some(o=>o.node.userData.cast)){
        batch.userData.layers=list.map(o=>o.index);
        hits.push(batch);
      }
    }
    function updateBatches(){
      for(const [batch,list] of batches){
        list.forEach(({node,index},i)=>{
          batch.setMatrixAt(i,node.matrixWorld);
          batch.setColorAt(i,scratchColor.copy(node.userData.tint).multiplyScalar(gains[index]??1));
        });
        batch.instanceMatrix.needsUpdate=true;
        batch.instanceColor.needsUpdate=true;
        if(batch.userData.layers)batch.computeBoundingSphere();
      }
    }

    // Reuse five flattened tubes. Solve the outward bend for the available cable length.
    const flexMat=mat(0xffffff,.54,{
      metalness:.25,side:T.DoubleSide,map:texture(32,128,c=>{
        c.fillStyle='#39393b';c.fillRect(0,0,32,128);c.fillStyle='#6e0a1a';
        for(const y of [58,122])c.fillRect(0,y,32,2);
      })
    });
    const flexes=[],curve=new T.CubicBezierCurve3();
    const tube=new T.TubeGeometry(new T.LineCurve3(new T.Vector3(),new T.Vector3(0,1,0)),20,1,4,false);
    const flexGeo=own(mergeGeometries(Array.from({length:5},()=>tube)));tube.dispose();
    const flexMesh=new T.Mesh(flexGeo,flexMat);
    scene.add(flexMesh);
    flexMesh.frustumCulled=false;
    const tangent=new T.Vector3(),wide=new T.Vector3(),thin=new T.Vector3(),center=new T.Vector3();
    const flexPos=flexGeo.attributes.position;
    flexPos.setUsage(T.DynamicDrawUsage);
    for(let i=0;i<5;i++)flexes.push([new T.Vector3(),new T.Vector3()]);
    const scratch=new T.Vector3(),signal=new T.Color(0xe5172f),rimBase=new T.Color(0x6f6d69);

    function updateFlex(){
      flexes.forEach(([a,b],i)=>{
        a.set(143,-4,-62).applyMatrix4(plates[i].matrixWorld);
        b.set(143,-4,-41).applyMatrix4(plates[i+1].matrixWorld);
        curve.v0.copy(a);curve.v3.copy(b);
        let low=3,high=88;
        for(let k=0;k<8;k++){
          const reach=(low+high)/2;
          curve.v1.copy(a);curve.v1.x+=reach;
          curve.v2.copy(b);curve.v2.x+=reach;
          curve.needsUpdate=true;
          if(curve.getLengths(16).at(-1)>133)high=reach;else low=reach;
        }
        for(let j=0;j<=20;j++){
          curve.getPoint(j/20,center);curve.getTangent(j/20,tangent);
          wide.set(0,0,1).addScaledVector(tangent,-tangent.z).normalize();
          thin.crossVectors(tangent,wide).normalize();
          for(let k=0;k<5;k++){
            const sx=k===0||k===3||k===4?-5.7:5.7;
            const sy=(k<2||k===4) ? .32 : -.32;
            scratch.copy(center).addScaledVector(wide,sx).addScaledVector(thin,sy);
            flexPos.setXYZ(i*105+j*5+k,scratch.x,scratch.y,scratch.z);
          }
        }
      });
      flexPos.needsUpdate=true;
      flexGeo.computeVertexNormals();
    }

    function animateModules(seconds){
      const beat=seams[2]*Math.sin(seconds*4.4),w=selection;
      dialLight.userData.tint.copy(signal).multiplyScalar(.9+.1*Math.sin(seconds*Math.PI/2));
      cone.position.y=seams[0]*.45*Math.sin(seconds*2.5)+1.2*Math.sin(Math.PI*w[0]);
      drums[0].rotation.x=2.5*tau/10-.74;
      drums[1].rotation.x=6.5*tau/10-.74+.035*Math.sin(Math.PI*w[1]);
      leafPivot.rotation.x=-.83+Math.PI*w[1];
      balance.rotation.y=.38*beat+.28*w[2];fork.rotation.y=.12*beat;
      gears.forEach((o,i)=>{
        o.rotation.y=(i===1?-1:1)*(w[2]+seams[2]*Math.floor(seconds*1.4)/12)*tau/[24,14,12][i];
      });
      roller.rotation.z=seams[3]*seconds*.1+w[3]*.75;
      paper.position.x=w[3]*6;
      starAxle.rotation.x=w[4]*tau/5;
      counters.forEach((o,i)=>o.rotation.x=(i+1.5+(i===2?w[4]:0))*tau/10-.74);
      backlight.position.y=-6.7+seams[4]*1.2;
      screen.position.y=-1+seams[4]*7;
      backlight.userData.tint.setScalar(.17+.7*w[5]);
      screenMat.emissiveIntensity=.13+.75*w[5];
      for(let i=0;i<6;i++){
        leds[i].userData.tint.setHex(0x101010).lerp(signal,w[i]);
        rims[i].userData.tint.copy(rimBase).lerp(signal,w[i]);
      }
    }

    const stamp=texture(128,128,c=>{
      const contact=c.createRadialGradient(64,64,5,64,64,64);
      contact.addColorStop(0,'rgba(0,0,0,.96)');
      contact.addColorStop(.52,'rgba(0,0,0,.72)');
      contact.addColorStop(1,'rgba(0,0,0,0)');
      const floor=c.createRadialGradient(60,63,12,64,64,64);
      floor.addColorStop(0,'rgba(28,28,31,.65)');floor.addColorStop(1,'rgba(17,17,19,0)');
      c.fillStyle=floor;c.fillRect(0,0,128,128);
      c.translate(3,2);c.scale(.85,.85);c.fillStyle=contact;c.fillRect(0,0,128,128);
    });
    const shadow=new T.Mesh(own(new T.PlaneGeometry(420,420)),own(new T.MeshBasicMaterial({
      map:stamp,transparent:true,depthWrite:false,toneMapped:false
    })));
    shadow.position.y=-18;shadow.rotation.x=-half;scene.add(shadow);
    const exempt=[shadow,...batches.filter(([batch])=>batch.material.transparent).map(([batch])=>batch)];

    // Linear HDR → contact occlusion → optional sample average → ACES/sRGB → SMAA.
    const target=(type,depth=false)=>own(new T.WebGLRenderTarget(1,1,{type,depthBuffer:depth}));
    const beauty=target(hdr?T.HalfFloatType:T.UnsignedByteType,true),encoded=target(T.UnsignedByteType);
    let ao=null,composite=null,history=null;
    if(!lightTier){
      ao=own(new GTAOPass(scene,camera,1,1,undefined,
        {radius:3.4,thickness:2.2,samples:8,scale:.85},{radius:2,samples:4,rings:1}));
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.pdMaterial.defines.PERSPECTIVE_CAMERA=0;
      ao.blendIntensity=.27;
      ao.blendMaterial.blendSrcAlpha=T.ZeroFactor;ao.blendMaterial.blendDstAlpha=T.OneFactor;
      own(ao.gtaoMaterial);own(ao.blendMaterial);
      composite=target(T.HalfFloatType);history=target(T.HalfFloatType);
    }
    const smaa=own(new SMAAPass(1,1)),quad=own(new FullScreenQuad(null));
    const vertex='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
    function screenMaterial(fragment,extra={}){
      return own(new T.ShaderMaterial({
        uniforms:{source:{value:null},factor:{value:1}},
        vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false,...extra
      }));
    }
    const sumPass=screenMaterial(
      'uniform sampler2D source;varying vec2 v;void main(){gl_FragColor=texture2D(source,v)/16.;}',
      {transparent:true,blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneFactor}
    );
    const display=screenMaterial(`
      uniform sampler2D source;uniform float factor;varying vec2 v;
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
      renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
      beauty.setSize(nx,ny);encoded.setSize(nx,ny);smaa.setSize(nx,ny);
      if(ao&&!lightTier){
        ao.setSize(Math.max(1,Math.ceil(nx*.67)),Math.max(1,Math.ceil(ny*.67)));
        composite.setSize(nx,ny);history.setSize(nx,ny);
      }
    }
    function halton(n,base){
      let r=0,f=1;
      while(n){f/=base;r+=f*(n%base);n=Math.floor(n/base)}
      return r;
    }
    function photograph(still){
      const refining=still&&!lightTier;
      if(!refining||dirty)samples=0;
      sizeTargets(refining?devicePixelRatio:Math.min(devicePixelRatio,2)*moveScale);
      const projection=camera.projectionMatrix,cx=projection.elements[12],cy=projection.elements[13];
      if(refining){
        projection.elements[12]+=(halton(samples+1,2)-.5)*2/pw;
        projection.elements[13]+=(halton(samples+1,3)-.5)*2/ph;
        camera.projectionMatrixInverse.copy(projection).invert();
      }
      renderer.setRenderTarget(beauty);renderer.render(scene,camera);
      let source=beauty;
      if(ao&&!lightTier){
        exempt.forEach(o=>o.visible=false);
        ao.render(renderer,composite,beauty);
        exempt.forEach(o=>o.visible=true);
        source=composite;
      }
      projection.elements[12]=cx;projection.elements[13]=cy;
      camera.projectionMatrixInverse.copy(projection).invert();

      if(refining){
        renderer.setRenderTarget(history);
        if(!samples)renderer.clear();
        renderer.autoClear=false;quad.material=sumPass;
        sumPass.uniforms.source.value=source.texture;quad.render(renderer);
        renderer.autoClear=true;samples++;source=history;
      }
      display.uniforms.source.value=source.texture;
      display.uniforms.factor.value=refining?16/samples:1;
      renderer.setRenderTarget(encoded);quad.material=display;quad.render(renderer);
      smaa.renderToScreen=true;smaa.render(renderer,null,encoded);
      dirty=false;
      return refining&&samples<16;
    }

    const rows=names.map((name,i)=>{
      const tag=document.createElement('div'),number=document.createElement('span'),word=document.createElement('span');
      tag.style.cssText='visibility:hidden;position:absolute;top:0;left:0;display:flex;align-items:center;gap:.5em;white-space:nowrap;pointer-events:none;color:#f2f1ee;font:600 14px/1.2 Inter,Arial,sans-serif';
      number.style.cssText='font:500 .83em "Geist Mono",monospace;color:#a3a19d';
      number.textContent='0'+(i+1);word.textContent=name;tag.append(number,word);
      const lines=Array.from({length:2},()=>{
        const line=document.createElement('i');
        line.style.cssText='position:absolute;left:0;top:0;height:1px;background:rgba(242,241,238,.3);transform-origin:0 50%;pointer-events:none';
        frame.append(line);return line;
      });
      frame.append(tag);
      return {tag,word,lines};
    });
    const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
    const weights=new Float64Array(6),from=new Float64Array(6),anchors=plates.map(()=>new T.Vector3());
    let p=progress,v=0,previous=0,chosen=-1,changed=0,hover=-1,clock=0,lastTick=0;
    let w=0,h=0,labelWidth=0,phone=false,dpr=0,flexPose='';
    const point=new T.Vector3(),ray=new T.Raycaster(),pointer=new T.Vector2();

    function wake(){
      if(dead||lost||!visible||document.hidden||!w||!h)return;
      clearTimeout(timer);timer=0;
      if(!raf)raf=requestAnimationFrame(draw);
    }
    function invalidate(){dirty=true;samples=0;wake()}
    function hoverAt(i){if(i!==hover){hover=i;invalidate();el.onHover?.(i)}}
    listen(frame,'pointermove',e=>{
      if(!fine.matches||!w||!h)return;
      const rect=frame.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/w*2-1,1-(e.clientY-rect.top)/h*2);
      ray.setFromCamera(pointer,camera);
      const hit=ray.intersectObjects(hits,false)[0];
      hoverAt(hit?hit.object.userData.layers[hit.instanceId]:-1);
    });
    listen(frame,'pointerleave',()=>hoverAt(-1));

    function resize(){
      const nw=frame.clientWidth,nh=frame.clientHeight,nd=Math.min(devicePixelRatio||1,2);
      if(nw===w&&nh===h&&nd===dpr)return;
      w=nw;h=nh;dpr=nd;
      if(!w||!h)return;
      dirty=true;samples=0;phone=w/h<.9||w<580;labelWidth=0;
      rows.forEach(({tag,word},i)=>{
        word.textContent=phone?['Answer','Book','Quotes','Invoices','Reviews','Web'][i]:names[i];
        tag.style.fontSize=(phone?12:14)+'px';
        labelWidth=Math.max(labelWidth,tag.offsetWidth);
      });
      wake();
    }
    document.fonts?.ready.then(()=>{if(!dead){w=0;resize()}});
    const shadowBox=new T.Box3(),shadowPoint=new T.Vector3(),bounds=new Float64Array(4);
    function caster(x,y,z){
      shadowPoint.set(x,y,z).applyMatrix4(shadowCam.matrixWorldInverse);
      shadowBox.expandByPoint(shadowPoint);
    }
    function include(x,y,z){
      const u=(x-z)*Math.SQRT1_2,t=y*.8660254038-(x+z)*.3535533906;
      bounds[0]=Math.min(bounds[0],u);bounds[1]=Math.max(bounds[1],u);
      bounds[2]=Math.min(bounds[2],t);bounds[3]=Math.max(bounds[3],t);
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
      const goal=progress,e=p-goal,k=v+40*e,d=Math.exp(-40*dt);
      p=goal+(e+k*dt)*d;v=(v-40*k*dt)*d;
      if(reduce.matches||(Math.abs(p-goal)<.00008&&Math.abs(v)<.004)){p=goal;v=0}

      const index=active>=0?active:hover;
      if(index!==chosen){from.set(weights);chosen=index;changed=now}
      const select=reduce.matches?1:ease(now,changed,changed+250);
      for(let i=0;i<5;i++){
        seams[i]=ease(p,.2+i*.1,.28+i*.1)*(1-ease(p,.80+i*.007,.892+i*.007));
      }
      const show=seams[0];
      let sum=0;
      for(let i=0;i<6;i++){
        weights[i]=from[i]+((i===chosen?1:0)-from[i])*select;
        sum+=weights[i];
      }

      shadowBox.makeEmpty();bounds.set([Infinity,-Infinity,Infinity,-Infinity]);
      let lift=0;
      for(let i=5;i>=0;i--){
        if(i<5)lift+=72*seams[i];
        const reveal=seams[Math.min(i,4)],room=i?Math.min(reveal,seams[i-1]):reveal;
        const g=plates[i],fraction=i===5?0:lift/(72*(5-i));
        selection[i]=weights[i]*room;
        covers[i].position.y=13.6+room*18+10*selection[i];
        g.position.set((5-i)*1.3*fraction,(5-i)*35.5+lift+6*selection[i],0);
        g.rotation.y=(5-i)*Math.PI/300*fraction;
        gains[i]=1-.55*(sum-weights[i])*reveal;
        g.updateMatrixWorld(true);
        for(const x of [-140,140])for(const y of [-18,covers[i].position.y+4])for(const z of [-140,140]){
          point.set(x,y,z).applyMatrix4(g.matrixWorld);
          include(point.x,point.y,point.z);caster(point.x,point.y,point.z);
        }
        anchors[i].set(138,10,-136).applyMatrix4(g.matrixWorld);
      }
      screws.forEach((s,i)=>{
        const rise=ease(p,.06+i*.008,.186+i*.008)*(1-ease(p,.94+i*.003,.991+i*.003));
        s.position.y=2.2+70*rise;
        s.rotation.y=i*.31+4*Math.PI*(1-(1-rise)**2);
        point.copy(s.position).applyMatrix4(cap.matrixWorld);
        include(point.x-6,point.y+3,point.z+6);include(point.x+6,point.y+3,point.z-6);
        include(point.x-6,point.y+3,point.z-6);caster(point.x,point.y+5,point.z);
      });
      for(const [x,y,z] of cablePoints){include(x+3,y-3,z-3);caster(x,y,z)}
      const pose=[p,...selection].join('/');
      point.set(169+selection[3]*6,-9,101).applyMatrix4(plates[3].matrixWorld);
      include(point.x,point.y,point.z);
      if(pose!==flexPose){updateFlex();flexPose=pose}
      for(const [a,b] of flexes){
        include(Math.max(a.x,b.x)+50,a.y,a.z-7);
        include(b.x,b.y,b.z+7);
      }

      if(pose!==lastShadow){
        const lo=shadowBox.min,hi=shadowBox.max;
        shadowCam.left=lo.x-9;shadowCam.right=hi.x+9;
        shadowCam.top=hi.y+9;shadowCam.bottom=lo.y-9;
        shadowCam.near=Math.max(1,-hi.z-12);shadowCam.far=-lo.z+12;
        shadowCam.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;
        lastShadow=pose;
      }

      const pad=.08*w,right=w-pad,labelX=right-labelWidth;
      const end=phone?labelX-14:Math.min(w*.60,labelX-22);
      const zoneRight=right+(end-right)*show,zoneLeft=pad;
      const scale=Math.min(
        Math.max(1,zoneRight-zoneLeft)/(bounds[1]-bounds[0]),
        h*.70/(bounds[3]-bounds[2])
      );
      const centerX=(zoneLeft+zoneRight)/2,midU=(bounds[0]+bounds[1])/2,midT=(bounds[2]+bounds[3])/2;
      camera.left=midU-centerX/scale;camera.right=camera.left+w/scale;
      camera.top=midT+h/(2*scale);camera.bottom=midT-h/(2*scale);
      camera.updateProjectionMatrix();

      let rail=-Infinity;
      for(const a of anchors){
        a.project(camera);a.x=(a.x+1)*w/2;a.y=(1-a.y)*h/2;
        rail=Math.max(rail,a.x);
      }
      rail+=2;
      const gap=Math.min(h*.145,Math.max(phone?21:26,(anchors[5].y-anchors[0].y)/5));
      const start=clamp((anchors[0].y+anchors[5].y-5*gap)/2,h*.08,h*.92-5*gap);
      rows.forEach(({tag,lines},i)=>{
        const y=start+i*gap,a=anchors[i];
        const alpha=seams[Math.min(i,4)]*ease(labelX-rail,3,10)*gains[i];
        tag.style.transform='translate('+labelX+'px,'+y+'px) translateY(-50%)';
        tag.style.opacity=alpha;tag.style.visibility=alpha>.001?'visible':'hidden';
        leader(lines[0],a.x,a.y,rail,a.y,alpha);leader(lines[1],rail,a.y,labelX-5,y,alpha);
      });

      const moving=p!==goal||v!==0||select<1;
      if(moving&&elapsed>28&&elapsed<250)slow++;else slow=Math.max(0,slow-1);
      if(slow>22){
        slow=0;moveScale=Math.max(.62,moveScale*.85);
        if(!lightTier){
          lightTier=true;samples=0;sh.map?.dispose();sh.map=null;
          sh.mapSize.setScalar(2048);lastShadow='';
          ao.setSize(1,1);history.setSize(1,1);composite.setSize(1,1);
        }
      }

      const live=!reduce.matches&&seams[0]>.001;
      // Keep the mechanism stationary within each accumulation exposure.
      if(moving||dirty||lightTier||samples===0){
        if(!reduce.matches&&lastTick)clock+=Math.min(900,now-lastTick);
        lastTick=now;
        const seconds=reduce.matches?0:clock*.001;
        panels[1].position.x=-375+16*Math.sin(seconds*tau/7);
        panels[1].lookAt(aim);
        animateModules(seconds);
        plates.forEach(g=>g.updateMatrixWorld(true));
        updateBatches();
      }
      const more=photograph(!moving);
      if(moving||more)wake();
      else if(live)timer=setTimeout(invalidate,lightTier?1000/30:85);
    }

    session.wake=invalidate;
    function visibility(){stop();previous=lastTick=0;invalidate()}
    listen(document,'visibilitychange',visibility);
    listen(reduce,'change',invalidate);
    listen(window,'resize',resize);
    listen(canvas,'webglcontextlost',e=>{
      e.preventDefault();lost=true;stop();frame.style.visibility='hidden';
    });
    listen(canvas,'webglcontextrestored',()=>{if(!dead)mount(el)});
    const ro=new ResizeObserver(resize);
    ro.observe(el);releases.push(()=>ro.disconnect());
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;visibility()});
    io.observe(el);releases.push(()=>io.disconnect());
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
    if(Number.isFinite(p)&&clamp(p)!==progress){progress=clamp(p);session?.wake()}
  },
  setActive(i){
    if(Number.isInteger(i)&&i>=-1&&i<6&&i!==active){active=i;session?.wake()}
  },
  destroy
};
window.dispatchEvent(new Event('cinder-unit'));
