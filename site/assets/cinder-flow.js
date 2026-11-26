// A ribbon of fine strands, always flowing, with crimson pulses running along it. Time-driven only.
// data-flow="c": bent into the Cinder C. data-flow="wave": a long wave crossing the section.
// data-flow="thread" (homepage hero): loose strands come in scattered, pass through a machined ring and leave as one tight ribbon.
import * as T from 'three';
const RM=false;
// wave presets: amplitude, frequency, width, twist, tilt, roll. One per page, so no two backdrops match.
const V=[[.36,5.2,.3,7.5,.5,-.1],[.2,3,.42,4,.75,.12],[.5,7.5,.22,11,.3,0],[.28,2.2,.5,3,.95,-.2],[.42,4.2,.26,14,.55,.18],[.16,9,.34,6,.4,-.05],[.6,3.6,.2,9,.65,.1],[.3,6,.46,5,.85,0],[.24,4.6,.38,17,.6,-.16],[.46,2.8,.3,8,.35,.2],[.18,6.8,.5,10,.7,-.08],[.54,5,.24,3.5,.45,.14],[.26,2.6,.62,6.5,.82,.07]];
document.querySelectorAll('[data-flow]').forEach(host=>{const P=V[(+host.dataset.v||0)%V.length];
  const wave=host.dataset.flow==='wave',thread=host.dataset.flow==='thread',small=innerWidth<700;
  const cv=document.createElement('canvas');cv.className='flow-cv';cv.setAttribute('aria-hidden','true');host.append(cv);
  const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});r.setClearColor(0,0);
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(32,1,.1,50);cam.position.set(0,0,4.6);
  const LINES=small?110:wave?150:thread?330:190,SEG=small?260:420,n=LINES*(SEG+1),aT=new Float32Array(n),aS=new Float32Array(n),aR=new Float32Array(n*3),idx=[];
  for(let l=0,v=0;l<LINES;l++){const s=l/(LINES-1)*2-1,r1=Math.random(),r2=Math.random(),r3=Math.random();
    for(let k=0;k<=SEG;k++,v++){aT[v]=k/SEG;aS[v]=s;aR[v*3]=r1;aR[v*3+1]=r2;aR[v*3+2]=r3;if(k)idx.push(v-1,v)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute('aT',new T.BufferAttribute(aT,1));g.setAttribute('aS',new T.BufferAttribute(aS,1));g.setAttribute('aR',new T.BufferAttribute(aR,3));g.setIndex(idx);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:thread,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uIn:{value:0},uMode:{value:wave?1:thread?2:0},uP:{value:new T.Vector4(P[0],P[1],P[2],P[3])},uG:{value:new T.Vector3()},uGain:{value:1},uD:{value:new T.Vector3(0,-1,0)},uK:{value:1}},
  vertexShader:`uniform float uTime;uniform float uIn;uniform float uMode;uniform float uK;uniform float uGain;uniform vec4 uP;uniform vec3 uG;uniform vec3 uD;attribute float aT;attribute float aS;attribute vec3 aR;varying vec3 vC;
  void main(){float tm=uTime;vec3 z=vec3(0.,0.,1.),nr,c,off;float w,ph,up=0.,fq=38.;
    if(uMode<.5){float th=mix(.62,5.66,aT);float R=1.+.07*sin(th*1.3+tm*.23)+.03*sin(th*3.1-tm*.31);
      w=.2+.09*sin(th*2.1-tm*.19+1.)+.03*sin(th*5.-tm*.4);ph=th*1.35+tm*.16+.35*sin(tm*.07);
      nr=vec3(cos(th),sin(th),0.);c=nr*R+z*(.16*sin(th*1.6+tm*.14));off=(nr*cos(ph)+z*sin(ph))*aS*w;}
    else if(uMode<1.5){float x=mix(-3.3,3.3,aT);fq=46.;nr=vec3(0.,1.,0.);
      c=vec3(x,uP.x*sin(aT*uP.y+tm*.21)+uP.x*.36*sin(aT*uP.y*2.1-tm*.3),.25*sin(aT*3.3-tm*.17));
      w=uP.z+uP.z*.43*sin(aT*6.-tm*.19)+.04*sin(aT*15.+tm*.33);ph=aT*uP.w+tm*.16+.3*sin(tm*.06);off=(nr*cos(ph)+z*sin(ph))*aS*w;}
    else{float tg=.46;fq=30.;vec3 A0=uG+vec3(2.3,1.75,-2.7)*uK,A1=uG-uD*.95*uK,B1=uG+uD*.8*uK,B2=uG+vec3(-.6,-1.9,1.15)*uK,tn;
      if(aT<tg){float q=aT/tg,u=1.-q;c=u*u*A0+2.*u*q*A1+q*q*uG;tn=2.*u*(A1-A0)+2.*q*(uG-A1);}
      else{float q=(aT-tg)/(1.-tg),u=1.-q;c=u*u*uG+2.*u*q*B1+q*q*B2;tn=2.*u*(B1-uG)+2.*q*(B2-B1);}
      tn=normalize(tn);nr=normalize(cross(tn,z));vec3 bn=cross(tn,nr);up=1.-smoothstep(0.,tg,aT);float dn=smoothstep(tg,1.,aT);
      w=(mix(.07,.25,dn)+.03*sin(aT*9.-tm*.3)*dn)*uK;ph=aT*8.+tm*.16+.3*sin(tm*.07);float a=aR.x*6.2832,sp=pow(up,1.35)*uK;
      off=(nr*cos(ph)+bn*sin(ph))*aS*w*(1.-.7*up)+(nr*cos(a)+bn*sin(a))*sqrt(aR.y)*sp*.95+(nr*sin(aT*7.+aR.z*30.+tm*.45)+bn*cos(aT*5.3+aR.x*20.-tm*.37))*.14*sp;}
    float wob=.007*sin(aT*36.+tm*1.1+aR.x*40.)*(.4+abs(aS));
    vec4 mv=modelViewMatrix*vec4(c+off+nr*wob,1.);gl_Position=projectionMatrix*mv;
    float depth=mix(.28,1.,smoothstep(-5.9,-3.7,mv.z));float grow=smoothstep(aT,aT+.08,uIn*1.25-aR.y*.18);
    float sheen=.5+.5*cos(ph*2.+aS*.6-.8);float edge=smoothstep(.82,1.,abs(aS));
    float head=fract(tm*(.07+.09*aR.x)+aR.y);float d=head-aT;float pulse=(d>0.?exp(-d*14.):exp(d*500.))*step(.5,aR.z);float run=.6+.4*sin(aT*fq-tm*2.5+aR.x*6.2832);
    float taper=smoothstep(0.,.14,aT)*smoothstep(1.,.8,aT);vec3 grey=vec3(.66,.66,.7),red=vec3(.86,.05,.15);
    vec3 base=(grey*(.035+.16*sheen*sheen*sheen+.12*edge)+red*.07*(1.-sheen))*run*1.25*mix(1.,.95,up);
    float front=exp(-pow((uIn*1.25-aR.y*.18-aT)*18.,2.))*(1.-step(1.,uIn));
    vC=(base+red*pulse*.9+vec3(1.,.92,.92)*pow(pulse,8.)*.7+red*front*.8)*taper*depth*grow*uGain;}`,
  fragmentShader:`varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.);}`});
  const ribbon=new T.LineSegments(g,mat);ribbon.frustumCulled=false;const grp=new T.Group();grp.add(ribbon);scene.add(grp);
  // the ring the strands pass through: dark machined race, steel edge, one crimson line, a dial of ticks
  let ring=null,dial=null;const D=new T.Vector3(-.45,-.55,.7).normalize(),tags=[].slice.call(host.querySelectorAll('[data-flow-tag]'));
  if(thread){r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;const st=new T.Scene();st.background=new T.Color(0);
    for(const [x,y,z,w,h,i] of [[-2.3,5.6,-1.15,6.2,4.9,4.1],[-3.75,-1.4,3.6,3.1,6.8,2.65],[3.5,-1,-3.45,1.45,6.5,2.05]]){const m=new T.MeshBasicMaterial({color:0xf2f1ee});m.color.multiplyScalar(i);const c=new T.Mesh(new T.PlaneGeometry(w,h),m);c.position.set(x,y,z);c.lookAt(0,0,0);st.add(c)}
    const pm=new T.PMREMGenerator(r);scene.environment=pm.fromScene(st,.02).texture;pm.dispose();const key=new T.DirectionalLight(0xf2f1ee,1.4);key.position.set(-2.4,3.2,3);scene.add(key);
    const c=.012,h=.07,ri=.25,ro=.41,race=new T.LatheGeometry([[ri+c,-h],[ro-c,-h],[ro,-h+c],[ro,h-c],[ro-c,h],[ri+c,h],[ri,h-c],[ri,-h+c],[ri+c,-h]].map(p=>new T.Vector2(p[0],p[1])),160);
    const dark=new T.MeshPhysicalMaterial({color:0x1b1b1e,metalness:.92,roughness:.36,clearcoat:.25,clearcoatRoughness:.3}),steel=new T.MeshPhysicalMaterial({color:0xcfcfd4,metalness:.95,roughness:.26});
    ring=new T.Group();dial=new T.Group();ring.add(dial);ring.add(new T.Mesh(race,dark));
    const tor=(R,t,m,y)=>{const o=new T.Mesh(new T.TorusGeometry(R,t,10,180),m);o.rotation.x=Math.PI/2;o.position.y=y;ring.add(o);return o};
    tor(ro-.004,.0065,steel,h-.003);tor(ro-.004,.0065,steel,-h+.003);tor(ri+.02,.005,new T.MeshBasicMaterial({color:0xff1f3a,toneMapped:false}),h+.001);
    const tk=new T.InstancedMesh(new T.BoxGeometry(.0034,.0016,1),new T.MeshBasicMaterial({color:0x77777d,toneMapped:false}),72),o=new T.Object3D();
    for(let i=0;i<72;i++){const a=i/72*Math.PI*2,L=i%6?.018:.034;o.position.set(Math.cos(a)*(.375-L/2),h+.001,Math.sin(a)*(.375-L/2));o.rotation.set(0,-a+Math.PI/2,0);o.scale.set(1,1,L);o.updateMatrix();tk.setMatrixAt(i,o.matrix)}dial.add(tk);
    ring.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),D);scene.add(ring);mat.uniforms.uD.value.copy(D)}
  let W=1,H=1,raf=0,vis=true,tt=34,last=performance.now(),lastY=scrollY,boost=0,sc=0,px=0,py=0,tx=0,ty=0;const t0=performance.now();
  // the hero ribbon leans toward the pointer; every ribbon runs faster while the page is scrolling
  if(!wave&&!thread&&matchMedia('(hover:hover) and (pointer:fine)').matches)addEventListener('pointermove',e=>{tx=e.clientX/innerWidth*2-1;ty=e.clientY/innerHeight*2-1},{passive:true});
  function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix();if(!raf)raf=requestAnimationFrame(draw)}
  function draw(now){raf=0;const t=RM?20:(now-t0)/1000+20,narrow=W<700,u=H/(2*4.6*Math.tan(16*Math.PI/180));
    const dt=Math.min(.05,(now-last)/1000);last=now;boost+=(Math.min(1,Math.abs(scrollY-lastY)/36)-boost)*.1;lastY=scrollY;tt+=dt*1.7*(1+2.4*boost);mat.uniforms.uTime.value=RM?34:tt;const it=RM||wave?1:Math.min(1,(now-t0)/2600);mat.uniforms.uIn.value=1-Math.pow(1-it,3);
    if(thread){const hw=1.3194*W/H,K=narrow?.66:1.28,G=mat.uniforms.uG.value;G.set(narrow?hw*.14:hw*.43,narrow?-.5:.02,0);mat.uniforms.uK.value=K;ring.position.copy(G);ring.scale.setScalar(K);dial.rotation.y=t*.06;
      if(tags.length){const A0=new T.Vector3(2.3,1.75,-2.7).multiplyScalar(K).add(G),A1=D.clone().multiplyScalar(-.95*K).add(G),B1=D.clone().multiplyScalar(.8*K).add(G),B2=new T.Vector3(-.6,-1.9,1.15).multiplyScalar(K).add(G),v=new T.Vector3();
        tags.forEach(el=>{const nn=narrow&&el.dataset.n?el.dataset.n.split(',').map(Number):null,a=nn?nn[0]:+el.dataset.flowTag,up=a<.46,q=up?a/.46:(a-.46)/.54,m=1-q,p=up?[A0,A1,G]:[G,B1,B2];v.set(0,0,0).addScaledVector(p[0],m*m).addScaledVector(p[1],2*m*q).addScaledVector(p[2],q*q).project(cam);el.style.left=((v.x+1)/2*W+(nn?nn[1]:+el.dataset.dx||0))+'px';el.style.top=((1-v.y)/2*H+(nn?nn[2]:+el.dataset.dy||0))+'px'})}}
    else if(wave){grp.scale.setScalar(Math.max(narrow?2.1:1.2,1.12*W/(6.6*u))*(narrow?.55:1));grp.position.set(0,0,0);grp.rotation.set(P[4]+.06*Math.sin(t*.08),.1*Math.sin(t*.05),P[5]+.03*Math.sin(t*.06))}
    else{const Rp=narrow?W*.72:Math.min(W*.46,800),cyp=narrow?Rp*1.02:Rp*1.12,cxp=narrow?W*.1:W*.12,k=Math.min(1,dt*7);
      sc+=(Math.min(1,scrollY/(innerHeight*.44))-sc)*k;px+=(tx-px)*k*.5;py+=(ty-py)*k*.5;const e=sc*sc*(3-2*sc);
      // scrolling away: the sweep closes into the Cinder C, upright in the middle of the screen, while the next section rises over it
      const L=(a,b)=>a+(b-a)*e,Rc=Math.min(H*.25,W*.3),sw=1-e;mat.uniforms.uGain.value=L(1,.62);
      grp.scale.setScalar(L(Rp,Rc)/u);grp.position.set(L(cxp,0)/u,(H/2-L(cyp,H*.33))/u,0);grp.rotation.set(L(.42,.1)+.08*Math.sin(t*.09)*sw+py*.05,L(-.38,-.08)+.14*Math.sin(t*.061)*sw+px*.07,L(.2,0)+.05*Math.sin(t*.047)*sw)}
    r.render(scene,cam);if(vis&&!RM)raf=requestAnimationFrame(draw)}
  new ResizeObserver(size).observe(host);
  new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis&&!raf)raf=requestAnimationFrame(draw)}).observe(host);size();
});
