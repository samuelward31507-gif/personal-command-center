// A ribbon of fine strands, always flowing, with crimson pulses running along it. Time-driven only.
// data-flow="c": bent into the Cinder C (hero). data-flow="wave": a long wave crossing the section.
import * as T from 'three';
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
// wave presets: amplitude, frequency, width, twist, tilt, roll. One per page, so no two backdrops match.
const V=[[.36,5.2,.3,7.5,.5,-.1],[.2,3,.42,4,.75,.12],[.5,7.5,.22,11,.3,0],[.28,2.2,.5,3,.95,-.2],[.42,4.2,.26,14,.55,.18],[.16,9,.34,6,.4,-.05],[.6,3.6,.2,9,.65,.1],[.3,6,.46,5,.85,0],[.24,4.6,.38,17,.6,-.16],[.46,2.8,.3,8,.35,.2],[.18,6.8,.5,10,.7,-.08],[.54,5,.24,3.5,.45,.14]];
document.querySelectorAll('[data-flow]').forEach(host=>{const P=V[(+host.dataset.v||0)%V.length];
  const wave=host.dataset.flow==='wave',small=innerWidth<700;
  const cv=document.createElement('canvas');cv.className='flow-cv';cv.setAttribute('aria-hidden','true');host.append(cv);
  const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});r.setClearColor(0,0);
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(32,1,.1,50);cam.position.set(0,0,4.6);
  const LINES=small?110:wave?150:190,SEG=small?260:420,n=LINES*(SEG+1),aT=new Float32Array(n),aS=new Float32Array(n),aR=new Float32Array(n*3),idx=[];
  for(let l=0,v=0;l<LINES;l++){const s=l/(LINES-1)*2-1,r1=Math.random(),r2=Math.random(),r3=Math.random();
    for(let k=0;k<=SEG;k++,v++){aT[v]=k/SEG;aS[v]=s;aR[v*3]=r1;aR[v*3+1]=r2;aR[v*3+2]=r3;if(k)idx.push(v-1,v)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute('aT',new T.BufferAttribute(aT,1));g.setAttribute('aS',new T.BufferAttribute(aS,1));g.setAttribute('aR',new T.BufferAttribute(aR,3));g.setIndex(idx);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uIn:{value:0},uMode:{value:wave?1:0},uP:{value:new T.Vector4(P[0],P[1],P[2],P[3])}},
  vertexShader:`uniform float uTime;uniform float uIn;uniform float uMode;uniform vec4 uP;attribute float aT;attribute float aS;attribute vec3 aR;varying vec3 vC;
  void main(){float tm=uTime;vec3 z=vec3(0.,0.,1.),nr,c;float w,ph;
    if(uMode<.5){float th=mix(.62,5.66,aT);float R=1.+.07*sin(th*1.3+tm*.23)+.03*sin(th*3.1-tm*.31);
      w=.2+.09*sin(th*2.1-tm*.19+1.)+.03*sin(th*5.-tm*.4);ph=th*1.35+tm*.16+.35*sin(tm*.07);
      nr=vec3(cos(th),sin(th),0.);c=nr*R+z*(.16*sin(th*1.6+tm*.14));}
    else{float x=mix(-3.3,3.3,aT);nr=vec3(0.,1.,0.);
      c=vec3(x,uP.x*sin(aT*uP.y+tm*.21)+uP.x*.36*sin(aT*uP.y*2.1-tm*.3),.25*sin(aT*3.3-tm*.17));
      w=uP.z+uP.z*.43*sin(aT*6.-tm*.19)+.04*sin(aT*15.+tm*.33);ph=aT*uP.w+tm*.16+.3*sin(tm*.06);}
    vec3 off=(nr*cos(ph)+z*sin(ph))*aS*w;float wob=.007*sin(aT*36.+tm*1.1+aR.x*40.)*(.4+abs(aS));
    vec4 mv=modelViewMatrix*vec4(c+off+nr*wob,1.);gl_Position=projectionMatrix*mv;
    float depth=mix(.28,1.,smoothstep(-5.9,-3.7,mv.z));float grow=smoothstep(aT,aT+.08,uIn*1.25-aR.y*.18);
    float sheen=.5+.5*cos(ph*2.+aS*.6-.8);float edge=smoothstep(.82,1.,abs(aS));
    float head=fract(tm*(.045+.06*aR.x)+aR.y);float d=head-aT;float pulse=(d>0.?exp(-d*14.):exp(d*500.))*step(.62,aR.z);
    float taper=smoothstep(0.,.14,aT)*smoothstep(1.,.8,aT);vec3 grey=vec3(.66,.66,.7),red=vec3(.86,.05,.15);
    vec3 base=grey*(.035+.16*sheen*sheen*sheen+.12*edge)+red*.07*(1.-sheen);
    float front=exp(-pow((uIn*1.25-aR.y*.18-aT)*18.,2.))*(1.-step(1.,uIn));
    vC=(base+red*pulse*.9+vec3(1.,.92,.92)*pow(pulse,8.)*.7+red*front*.8)*taper*depth*grow;}`,
  fragmentShader:`varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.);}`});
  const ribbon=new T.LineSegments(g,mat);ribbon.frustumCulled=false;const grp=new T.Group();grp.add(ribbon);scene.add(grp);
  let W=1,H=1,raf=0,vis=true;const t0=performance.now();
  function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix();if(!raf)raf=requestAnimationFrame(draw)}
  function draw(now){raf=0;const t=RM?20:(now-t0)/1000+20,narrow=W<700,u=H/(2*4.6*Math.tan(16*Math.PI/180));
    mat.uniforms.uTime.value=t*1.7;const it=RM||wave?1:Math.min(1,(now-t0)/2600);mat.uniforms.uIn.value=1-Math.pow(1-it,3);
    if(wave){grp.scale.setScalar(Math.max(narrow?2.1:1.2,1.12*W/(6.6*u))*(narrow?.55:1));grp.position.set(0,0,0);grp.rotation.set(P[4]+.06*Math.sin(t*.08),.1*Math.sin(t*.05),P[5]+.03*Math.sin(t*.06))}
    else{const Rp=narrow?W*.72:Math.min(W*.46,800),cyp=narrow?Rp*1.02:Rp*1.12,cxp=narrow?W*.1:W*.12;
      grp.scale.setScalar(Rp/u);grp.position.set(cxp/u,(H/2-cyp)/u,0);grp.rotation.set(.42+.08*Math.sin(t*.09),-.38+.14*Math.sin(t*.061),.2+.05*Math.sin(t*.047))}
    r.render(scene,cam);if(vis&&!RM)raf=requestAnimationFrame(draw)}
  new ResizeObserver(size).observe(host);
  new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis&&!raf)raf=requestAnimationFrame(draw)}).observe(host);size();
});
