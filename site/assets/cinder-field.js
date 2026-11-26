// Cinder field v3: precision dot-matrix scenes. API: CinderField.mount(el,{variant,seed,calm,intensity}) -> {setVariant,destroy}
// Six spins of one language: 0 ridge, 1 ripple, 2 globe, 3 scanner, 4 flow, 5 canyon.
// Per variant: camera height, tilt, horizon offset, side shift, mode.
const V=[
  [0.62,0.36,-0.40, 0.00,0],
  [0.55,0.42,-0.58, 0.00,1],
  [0.00,0.00, 0.00, 0.62,2],
  [0.50,0.40,-0.42, 0.00,3],
  [0.40,0.28,-0.36, 0.00,4],
  [0.58,0.34,-0.46, 0.00,5]
];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const coarse=matchMedia('(pointer:coarse)');
const items=new Set();let raf=0;
const vs=`attribute vec2 g;
uniform vec4 cam;uniform float t,aspect,side,scroll,ps,mode,seed;
varying float vA,vC,vN,vG;
const float PI=3.14159265;
float h(vec2 p){return sin(p.x*1.7+t*.9)*.5*cos(p.y*1.3-t*.6)+sin((p.x+p.y)*.9+t*.45)*.35+sin(p.x*3.1-p.y*2.3+seed*6.)*.12;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 w;float crest=0.;
  vec2 p=vec2((g.x-.5)*16.,g.y*13.+.5);
  bool globe=mode>1.5&&mode<2.5;
  if(mode<.5){
    float ridge=2.6*exp(-pow(p.x*.30,2.))*smoothstep(2.,10.,p.y);
    float y=h(p*.45)*.32+ridge;
    w=vec3(p.x,y,p.y);
    crest=exp(-pow((p.y-mod(t*1.6+seed*9.,14.))*.6,2.))*(.35+.65*smoothstep(-.2,1.2,y))*1.5;
  } else if(mode<1.5){
    vec2 e=vec2(2.6+seed*2.,6.5);float r=length(p-e);
    float y=.75*sin(r*1.8-t*2.4)*exp(-r*.13)+h(p*.3)*.05;
    w=vec3(p.x,y,p.y);
    float ring=mod(r-t*1.15,7.);
    crest=exp(-ring*ring*1.6)*exp(-r*.03)*1.5;
  } else if(globe){
    float lat=(g.y-.5)*PI,lon=g.x*2.*PI+t*.06;
    vec3 s=vec3(cos(lat)*sin(lon),sin(lat),cos(lat)*cos(lon))*6.2;
    float tl=.35;s=vec3(s.x,s.y*cos(tl)-s.z*sin(tl),s.y*sin(tl)+s.z*cos(tl));
    w=vec3(s.x+side*15.,s.y-.2,s.z+12.5);
    float band=sin(lat)-sin(mod(t*.35+seed*3.,2.4)-1.2);
    crest=exp(-band*band*35.)*step(-.7,-s.z/6.2)*1.3;
  } else if(mode<3.5){
    float sy=13.5-mod(t*2.4+seed*10.,15.);float d=p.y-sy;
    float lift=.9*exp(-d*d*1.1)*(.6+.4*sin(p.x*1.3+t))+.04*h(p*.6)+.18*smoothstep(0.,-3.,d)*exp(d*.25);
    w=vec3(p.x,lift,p.y);
    crest=exp(-d*d*2.)*1.3;
  } else if(mode<4.5){
    float lane=floor(g.x*36.);float lx=(lane/35.-.5)*16.;
    float z=mod(g.y*13.-t*(1.2+hash(vec2(lane,1.))*1.4),13.)+.5;
    w=vec3(lx,.02*sin(z*2.+lane),z);
    float hot=step(.86,hash(vec2(lane,floor(t*.25))));
    crest=hot*smoothstep(13.,4.,z)*.95;
  } else {
    float wall=1.15*pow(abs(p.x)*.30,2.3);
    float y=wall+h(p*.4)*.16;
    w=vec3(p.x,y,p.y);
    crest=exp(-pow(p.x*.9,2.))*(.35+.65*exp(-pow((p.y-mod(t*1.4+seed*8.,14.))*.45,2.)))*1.4;
  }
  float yaw=scroll*(.42+seed*.2)*(fract(seed*7.)>.5?1.:-1.)+t*.012;
  vec2 piv=globe?vec2(side*15.,12.5):vec2(0.,6.5);
  vec2 rel=vec2(w.x,w.z)-piv;float cy=cos(yaw),sy=sin(yaw);
  w.xz=piv+vec2(rel.x*cy-rel.y*sy,rel.x*sy+rel.y*cy);
  vec3 q=vec3(w.x+(globe?0.:side*4.),w.y-cam.x*2.2,w.z-scroll*.6);
  float c=cos(cam.y),s2=sin(cam.y);
  vec3 v=vec3(q.x,q.y*c+q.z*s2,-q.y*s2+q.z*c);
  float d=max(v.z,.05);
  gl_Position=vec4(v.x/d/aspect*1.1,v.y/d*1.1+cam.z,0.,1.);
  vC=clamp(crest,0.,1.);
  vN=smoothstep(10.,1.2,d);
  vA=smoothstep(16.,1.3,d)*smoothstep(.1,.8,d);
  vG=step(.996,hash(g*97.+floor(t*.5)));
  gl_PointSize=ps*clamp(3.4/d,.8,3.6)*(1.+vC*.5);
}`;
const fs=`precision mediump float;varying float vA,vC,vN,vG;uniform float calm,inten;uniform vec2 res;
void main(){
  vec2 q=gl_PointCoord-.5;float r=dot(q,q);if(r>.25)discard;
  float soft=1.-smoothstep(.12,.25,r);
  vec2 uv=gl_FragCoord.xy/res;vec2 k=(uv-vec2(.5,.58))*vec2(2.,3.);
  float pocket=1.-calm*.86*exp(-dot(k,k));
  vec3 far=vec3(.55,.54,.53),near=vec3(.96,.94,.92);
  vec3 base=mix(far,near,vN);
  vec3 red=vec3(1.,.09,.16),hot=vec3(1.,.82,.78);
  vec3 col=mix(base,red,smoothstep(0.,.55,vC));col=mix(col,hot,pow(vC,6.));
  col=mix(col,vec3(1.),vG*.8);
  float a=vA*(.6+.4*max(vC,vG))*pocket*inten*soft;
  gl_FragColor=vec4(col*a,a);
}`;
function make(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function seedOf(v){let h=2166136261;for(const ch of String(v??Math.random()))h=Math.imul(h^ch.codePointAt(0),16777619);return (h>>>0)/4294967296}
function mount(el,o={}){
  const c=document.createElement('canvas');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';el.appendChild(c);
  const gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,powerPreference:'low-power'});
  if(!gl)return{destroy(){c.remove()},setVariant(){}};
  const p=gl.createProgram();gl.attachShader(p,make(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,make(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  const N=coarse.matches?[130,90]:[270,170];const pts=new Float32Array(N[0]*N[1]*2);let k=0;
  for(let j=0;j<N[1];j++)for(let i=0;i<N[0];i++){pts[k++]=i/(N[0]-1);pts[k++]=j/(N[1]-1)}
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,pts,gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'g');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U={};['cam','t','aspect','side','scroll','ps','mode','seed','calm','inten','res'].forEach(n=>U[n]=gl.getUniformLocation(p,n));
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const s={el,c,gl,U,n:N[0]*N[1],v:Number.isInteger(o.variant)?((o.variant%6)+6)%6:0,calm:o.calm??.88,inten:o.intensity??1,vis:true,t0:performance.now(),seed:seedOf(o.seed)};
  s.io=new IntersectionObserver(e=>{s.vis=e[0].isIntersecting;kick()});s.io.observe(el);
  c.addEventListener('webglcontextlost',e=>{e.preventDefault();items.delete(s)});
  items.add(s);kick();
  return{setVariant(n){s.v=((n%6)+6)%6;kick()},destroy(){items.delete(s);s.io.disconnect();c.remove()}};
}
function draw(s,now){
  const{gl,U,c,el}=s,dpr=Math.min(devicePixelRatio||1,2),w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const v=V[s.v],r=el.getBoundingClientRect(),sc=Math.max(-1,Math.min(1,-r.top/Math.max(1,innerHeight)));
  const t=reduced.matches?6+s.seed*20:(now-s.t0)/1000+s.seed*20;
  const globe=v[4]===2;
  gl.uniform4f(U.cam,v[0],v[1],v[2],0);gl.uniform1f(U.t,t);gl.uniform1f(U.aspect,w/h);
  gl.uniform1f(U.side,globe?(s.seed<.5?-v[3]:v[3]):(s.seed-.5)*.5);gl.uniform1f(U.scroll,sc);gl.uniform1f(U.ps,2.3*dpr);
  gl.uniform1f(U.mode,v[4]);gl.uniform1f(U.seed,s.seed);gl.uniform1f(U.calm,s.calm);gl.uniform1f(U.inten,s.inten);gl.uniform2f(U.res,c.width,c.height);
  gl.drawArrays(gl.POINTS,0,s.n);
}
function loop(now){raf=0;let any=false;for(const s of items)if(s.vis){draw(s,now);any=true}if(any&&!reduced.matches)raf=requestAnimationFrame(loop)}
function kick(){if(!raf)raf=requestAnimationFrame(loop)}
addEventListener('scroll',kick,{passive:true});addEventListener('resize',kick);
window.CinderField={mount};
window.dispatchEvent(new Event('cinder-field'));
