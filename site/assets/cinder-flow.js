// Hero animation: a silk ribbon of fine lines bent into the Cinder "C", always flowing.
// Crimson pulses travel the strands like leads moving through the system. Time-driven only.
import * as T from 'three';
const host=document.querySelector('#top .backdrop');
if(host){
  const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv=document.createElement('canvas');cv.className='flow-cv';cv.setAttribute('aria-hidden','true');host.append(cv);
  const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});r.setClearColor(0,0);
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(32,1,.1,50);cam.position.set(0,0,4.6);
  const narrowInit=innerWidth<700,LINES=narrowInit?110:190,SEG=narrowInit?260:420;
  const n=LINES*(SEG+1),aT=new Float32Array(n),aS=new Float32Array(n),aR=new Float32Array(n*3),idx=[];
  for(let l=0,v=0;l<LINES;l++){const s=l/(LINES-1)*2-1,r1=Math.random(),r2=Math.random(),r3=Math.random();
    for(let k=0;k<=SEG;k++,v++){aT[v]=k/SEG;aS[v]=s;aR[v*3]=r1;aR[v*3+1]=r2;aR[v*3+2]=r3;if(k)idx.push(v-1,v)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute('aT',new T.BufferAttribute(aT,1));g.setAttribute('aS',new T.BufferAttribute(aS,1));g.setAttribute('aR',new T.BufferAttribute(aR,3));g.setIndex(idx);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uDim:{value:1},uIn:{value:0}},
  vertexShader:`uniform float uTime;uniform float uIn;attribute float aT;attribute float aS;attribute vec3 aR;varying vec3 vC;
  void main(){float tm=uTime;float th=mix(.62,5.66,aT);
    float R=1.+.07*sin(th*1.3+tm*.23)+.03*sin(th*3.1-tm*.31);
    float w=.2+.09*sin(th*2.1-tm*.19+1.)+.03*sin(th*5.-tm*.4);
    float ph=th*1.35+tm*.16+.35*sin(tm*.07);
    vec3 nr=vec3(cos(th),sin(th),0.),z=vec3(0.,0.,1.);
    vec3 c=nr*R+z*(.16*sin(th*1.6+tm*.14));
    vec3 off=(nr*cos(ph)+z*sin(ph))*aS*w;
    float wob=.007*sin(aT*36.+tm*1.1+aR.x*40.)*(.4+abs(aS));
    vec4 mv=modelViewMatrix*vec4(c+off+nr*wob,1.);gl_Position=projectionMatrix*mv;float depth=mix(.28,1.,smoothstep(-5.9,-3.7,mv.z));float grow=smoothstep(aT,aT+.08,uIn*1.25-aR.y*.18);
    float sheen=.5+.5*cos(ph*2.+aS*.6-.8);float edge=smoothstep(.82,1.,abs(aS));
    float head=fract(tm*(.045+.06*aR.x)+aR.y);float d=head-aT;
    float pulse=(d>0.?exp(-d*14.):exp(d*500.))*step(.62,aR.z);
    float taper=smoothstep(0.,.14,aT)*smoothstep(1.,.8,aT);
    vec3 grey=vec3(.66,.66,.7),red=vec3(.86,.05,.15);
    vec3 base=grey*(.035+.16*sheen*sheen*sheen+.12*edge)+red*.07*(1.-sheen);
    float front=exp(-pow((uIn*1.25-aR.y*.18-aT)*18.,2.))*(1.-step(1.,uIn));
    vC=(base+red*pulse*.9+vec3(1.,.92,.92)*pow(pulse,8.)*.7+red*front*.8)*taper*depth*grow;}`,
  fragmentShader:`uniform float uDim;varying vec3 vC;void main(){gl_FragColor=vec4(vC*uDim,1.);}`});
  const ribbon=new T.LineSegments(g,mat);ribbon.frustumCulled=false;const grp=new T.Group();grp.add(ribbon);scene.add(grp);
  let W=1,H=1,raf=0,vis=true;const t0=performance.now();
  function size(){const b=host.getBoundingClientRect();W=Math.max(1,b.width);H=Math.max(1,b.height);r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix();if(!raf)raf=requestAnimationFrame(draw)}
  function draw(now){raf=0;const t=window.__flowT??(RM?20:(now-t0)/1000+20),narrow=W<700;
    mat.uniforms.uTime.value=t*1.7;const it=window.__flowIn??(RM?1:Math.min(1,(now-t0)/2600));mat.uniforms.uIn.value=1-Math.pow(1-it,3);
    const sc=narrow?.78:Math.min(1.18,.56+W/2500);grp.scale.setScalar(sc);
    grp.position.set(narrow?.12:.34,narrow?.5:.24,0);
    grp.rotation.set(.42+.08*Math.sin(t*.09),-.38+.14*Math.sin(t*.061),.2+.05*Math.sin(t*.047));
    r.render(scene,cam);if(vis&&!RM&&window.__flowT===undefined)raf=requestAnimationFrame(draw)}
  window.__flowDraw=()=>draw(performance.now());
  new ResizeObserver(size).observe(host);
  new IntersectionObserver(e=>{vis=e[0].isIntersecting;if(vis&&!raf)raf=requestAnimationFrame(draw)}).observe(host);
  size();
}
