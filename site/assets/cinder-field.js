// V1 red field: light through machined glass. API: CinderField.mount(el,{variant,seed,calm,intensity}) -> {setVariant,destroy}
// Rotation, pitch, view angle, card position, card angle, length, width, power.
const presets=[
  [-.075,.109,.61,.46,.18,.17,.59,.112,1.06],
  [-.68,.081,.71,.62,.29,-.37,.52,.054,1.22],
  [ .15,.045,.70,.30,.24,.34,.36,.067,.73],
  [0,.165,0,.62,.32,.02,.31,.100,1.13],
  [1.54,.090,.70,.54,.13,.08,.58,.128,1.12],
  [-.12,.241,.60,.53,.32,-.16,.36,.108,1.24]
];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const unit=(x,d)=>Number.isFinite(x)?clamp(x,0,1):d;
const valid=n=>Number.isInteger(n)&&n>=0&&n<6;
const entries=new Map(), onscreen=new Set();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const phone=matchMedia('(pointer:coarse)');
const cursor={x:-1e5,y:-1e5};
let frame=0,previous=0,serial=0;

function seedOf(value){
  if(value==null)value=Math.random()+'-'+(++serial);
  let h=2166136261;
  for(const c of String(value))h=Math.imul(h^c.codePointAt(0),16777619);
  return (h>>>0)/4294967296;
}

function cssLook(s){
  const p=presets[s.v],angle=Math.round(90-p[0]*57.3);
  const pitch=[46,30,13,28,39,88][s.v];
  const x=Math.round((p[3]+(s.seed-.5)*.08)*100),y=Math.round(100-p[4]*100);
  const fins=s.v===3
    ?`repeating-conic-gradient(from 5deg at ${x}% ${y}%,#000 0deg 3deg,transparent 3.3deg 7deg,#17080d 7.2deg 8deg)`
    :`repeating-linear-gradient(${angle}deg,#000 0px ${pitch*.33}px,transparent ${pitch*.35}px ${pitch*.89}px,rgba(16,2,6,.76) ${pitch*.92}px ${pitch-1}px,transparent ${pitch}px)`;
  const extent=s.v===2?'24% 13%':'52% 21%';
  return `radial-gradient(ellipse at 50% 46%,rgba(0,0,0,${.32+.62*s.calm}) 0%,transparent 58%),${fins},radial-gradient(ellipse ${extent} at ${x}% ${y}%,#ff3b30 0%,#b3122a 10%,#6e0a1a 28%,#2a0a0f 58%,#000 100%)`;
}

const vertex=`
attribute vec2 a;
varying vec2 uv;
void main(){
  uv=.5+.5*a;
  gl_Position=vec4(a,0.,1.);
}`;
const prefix='precision highp float;varying vec2 uv;\n';

// Store the square root of irradiance to preserve more levels in dark reds.
const lightSource=prefix+`
uniform vec4 card;
uniform vec3 lamp;
uniform float aspect;
void main(){
  vec2 p=(uv-card.xy)*vec2(aspect,1.);
  vec2 axis=vec2(cos(card.z),sin(card.z));
  vec2 q=vec2(dot(p,axis),dot(p,vec2(-axis.y,axis.x)));
  float longitudinal=q.x/card.w;
  float transverse=q.y/lamp.x;
  float endFall=exp(-1.65*longitudinal*longitudinal);
  float wide=exp(-.49*transverse*transverse)*endFall;
  float lip=exp(-3.8*abs(transverse+.42))*endFall;
  float core=exp(-2.6*transverse*transverse-2.2*longitudinal*longitudinal);
  gl_FragColor=vec4(sqrt(vec3(wide,lip,core)*lamp.y),1.);
}`;

// Step directly to the entrance plane and intersect the nearest periodic
// sidewall. The cost stays bounded as the fins compress into the distance.
const surface=prefix+`
uniform sampler2D source;
uniform vec4 geometry,style;
uniform vec2 pivot,size;
uniform float seed,parallax;
void main(){
  float aspect=size.x/size.y;
  vec2 screen=(uv-.5)*vec2(aspect,1.);
  float angle=geometry.x,pitch=geometry.y;
  vec2 a=vec2(cos(angle),sin(angle));
  vec2 q=vec2(dot(screen,a),dot(screen,vec2(-a.y,a.x)));
  float sn=sin(geometry.z),cs=cos(geometry.z);
  vec3 ray=vec3(q.x*cs+.88*sn,q.y,-.88*cs+q.x*sn);
  if(geometry.w>2.5&&geometry.w<3.5){
    vec2 v=(uv-pivot)*vec2(aspect,1.);
    ray=vec3(v.x+.035,.91,-abs(v.y)*1.65-.002);
  }
  float depth=.79/max(.002,-ray.z);
  float at=(ray.x*depth+seed*.31+parallax*.075)/pitch;
  float cell=fract(at),frontWidth=.30;
  float stepWidth=min(.53,abs(ray.x)/max(.08,-ray.z)*.155);
  float side=ray.x>=0.?1.-cell:cell-frontWidth;
  float aa=clamp(fwidth(at),.0001,.5);
  float front=smoothstep(-aa,aa,min(cell,frontWidth-cell));
  float wall=(1.-front)*smoothstep(-aa,aa,side)
    *(1.-smoothstep(stepWidth-aa,stepWidth+aa,side));
  float through=clamp(side/max(.001,stepWidth),0.,1.);
  float bevel=min(min(cell,1.-cell),abs(cell-frontWidth));
  float pixel=bevel/aa;
  float edge=(1.-smoothstep(.1,1.12,pixel))*(1.-smoothstep(.13,.48,aa));

  vec2 dir=a/vec2(aspect,1.);
  vec2 lookup=uv+dir*(.020+.018*sn)*front+dir*(.053-.075*through)*wall;
  vec3 light=texture2D(source,lookup).rgb;
  vec3 reflected=texture2D(source,uv-dir*.021).rgb;
  light*=light;
  reflected*=reflected;
  float range=clamp(1.40/(.48+depth),.10,1.);
  float attenuation=mix(.28,1.,range)*style.y;
  float path=mix(.47,1.,through);
  float faceShade=.53+.47*clamp(cell/frontWidth,0.,1.);
  vec3 body=front*faceShade*(vec3(.34,.015,.064)*light.r+vec3(.49,.041,.049)*light.b);
  body+=wall*path*(vec3(.49,.025,.061)*light.r+vec3(.50,.085,.054)*light.g);
  float rim=clamp(.009+.059*exp(-3.*dot(screen,screen))+reflected.r*.46+reflected.g*.76,0.,1.);
  vec3 metal=mix(vec3(.52,.11,.12),vec3(1.,.68,.55),sqrt(reflected.g))*rim;
  float resolve=1.-smoothstep(.18,.50,aa);
  body=mix(vec3(.17,.012,.026)*light.r,body,resolve);
  vec3 col=(body+edge*metal)*attenuation*(1.-smoothstep(16.,95.,depth));

  vec2 text=(uv-vec2(.5,.54))*vec2(2.55,4.45);
  float pocket=1.-style.x*.94*exp(-.85*dot(text,text));
  vec2 b=min(uv,1.-uv);
  float vignette=.64+.36*smoothstep(0.,.13,min(b.x,b.y));
  col=(1.-exp(-1.82*col))*pocket*vignette*style.z;
  float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
  col+=grain*(1.6/255.)*smoothstep(0.,.025,max(col.r,max(col.g,col.b)));
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

function device(canvas){
  const gl=canvas.getContext('webgl',{
    alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'
  });
  if(!gl)throw Error('WebGL unavailable');
  const resources=[];
  function own(obj,del){resources.push(()=>del.call(gl,obj));return obj}
  function dispose(){if(!gl.isContextLost())while(resources.length)resources.pop()()}
  function program(fragment){
    const p=own(gl.createProgram(),gl.deleteProgram);
    for(const [type,src] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=own(gl.createShader(type),gl.deleteShader);
      gl.shaderSource(shader,src);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(p,shader);
    }
    gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    const u={};
    for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){
      const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);
    }
    return {p,u};
  }
  try{
    if(!gl.getExtension('OES_standard_derivatives'))throw Error('Derivatives unavailable');
    const light=program(lightSource);
    const fins=program('#extension GL_OES_standard_derivatives : enable\n'+surface);
    const buffer=own(gl.createBuffer(),gl.deleteBuffer);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    const tex=own(gl.createTexture(),gl.deleteTexture);
    const fb=own(gl.createFramebuffer(),gl.deleteFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);
    for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    const max=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    let tw=0,th=0;
    function draw(s,box){
      const p=presets[s.v],aspect=box.width/box.height;
      const ratio=Math.min(devicePixelRatio||1,phone.matches?1:1.5,max/box.width,max/box.height);
      const w=Math.max(1,Math.round(box.width*ratio)),h=Math.max(1,Math.round(box.height*ratio));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
      const lw=Math.max(1,Math.ceil(w*s.scale)),lh=Math.max(1,Math.ceil(h*s.scale));
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.bindTexture(gl.TEXTURE_2D,tex);
      if(tw!==lw||th!==lh){
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,lw,lh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
          throw Error('Light buffer unavailable');
        tw=lw;th=lh;
      }
      const phase=s.time*2*Math.PI/49+s.seed*1.9;
      const x=p[3]+(.5-s.seed)*.08+Math.sin(phase)*.095+s.x*.15;
      const y=p[4]+Math.sin(phase*.89+.35)*.059+s.y*.12+s.scroll*.047;
      gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,lw,lh);gl.useProgram(light.p);
      gl.uniform4f(light.u.card,x,y,p[5]+Math.sin(phase*.73)*.075,p[6]*clamp(aspect,.68,1.45));
      gl.uniform3f(light.u.lamp,p[7],.98,0);gl.uniform1f(light.u.aspect,aspect);
      gl.drawArrays(gl.TRIANGLES,0,3);

      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);
      const bottom=clamp(Math.floor((box.bottom-innerHeight-80)*ratio),0,h);
      const top=clamp(Math.ceil((box.bottom+80)*ratio),0,h);
      gl.enable(gl.SCISSOR_TEST);gl.scissor(0,bottom,w,Math.max(0,top-bottom));
      gl.useProgram(fins.p);gl.uniform1i(fins.u.source,0);
      gl.uniform4f(fins.u.geometry,p[0]+(s.seed-.5)*.045,p[1],p[2],s.v);
      gl.uniform4f(fins.u.style,s.calm,p[8],s.intensity,0);
      gl.uniform2f(fins.u.pivot,p[3]+(s.seed-.5)*.07,p[4]);
      gl.uniform2f(fins.u.size,w,h);
      gl.uniform1f(fins.u.seed,s.seed);gl.uniform1f(fins.u.parallax,s.scroll);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    return {draw,dispose,release(){dispose();gl.getExtension('WEBGL_lose_context')?.loseContext()}};
  }catch(e){dispose();throw e}
}

function wake(){
  if(!frame&&!document.hidden&&onscreen.size)frame=requestAnimationFrame(tick);
}
function reveal(s){
  if(!s.shown){
    s.shown=true;
    s.layer.animate([{opacity:0},{opacity:1}],{duration:1200,easing:'ease-out'});
  }
}
function staticField(s){
  s.failed=true;onscreen.delete(s);s.gpu?.dispose();s.gpu=null;
  s.canvas.style.visibility='hidden';s.layer.style.backgroundImage=cssLook(s);
  s.layer.style.backgroundColor='#000';s.layer.style.opacity=s.intensity;
  reveal(s);
}

// Capture the outgoing composition once. The incoming light keeps moving
// throughout the transition, including when another variant interrupts it.
function snapshot(s,box){
  const old=s.overlay;
  let plate;
  if(s.failed){
    plate=document.createElement('div');plate.style.backgroundImage=cssLook(s);
    if(old)plate.append(old);
  }else{
    s.gpu.draw(s,box);
    plate=document.createElement('canvas');plate.width=s.canvas.width;plate.height=s.canvas.height;
    const ctx=plate.getContext('2d',{alpha:false});
    ctx.drawImage(s.canvas,0,0);
    if(old){
      ctx.globalAlpha=Number(getComputedStyle(old).opacity);
      ctx.drawImage(old,0,0,plate.width,plate.height);old.remove();
    }
  }
  plate.style.cssText+=';position:absolute;inset:0;width:100%;height:100%;background-color:#000;pointer-events:none';
  s.layer.append(plate);s.overlay=plate;
  const fade=plate.animate([{opacity:1},{opacity:0}],{
    duration:1500,easing:'ease-in-out',fill:'forwards'
  });
  fade.onfinish=()=>{plate.remove();if(s.overlay===plate)s.overlay=null};
}

function render(s,now){
  const box=s.el.getBoundingClientRect();
  if(!box.width||!box.height)return;
  const dt=s.last?Math.min(.12,(now-s.last)/1000):0;
  s.last=now;s.time+=dt*(reduced.matches ? .25 : 1);
  const x=(cursor.x-box.left)/box.width-.5,y=.5-(cursor.y-box.top)/box.height;
  const follow=1-Math.exp(-dt*4.4);
  const over=!phone.matches&&!reduced.matches&&Math.abs(x)<=.5&&Math.abs(y)<=.5;
  s.x+=((over?x:0)-s.x)*follow;s.y+=((over?y:0)-s.y)*follow;
  if(reduced.matches)s.x=s.y=0;
  s.scroll=clamp((innerHeight*.5-box.top-box.height*.5)/box.height,-1,1);
  try{
    s.gpu??=device(s.canvas);
    if(s.next!==null){
      if(s.shown&&s.next!==s.v)snapshot(s,box);
      s.v=s.next;s.next=null;
    }
    s.gpu.draw(s,box);reveal(s);
  }catch{
    if(s.next!==null)s.v=s.next;
    s.next=null;staticField(s);
  }
}

// On a 60 Hz display two visible fields can take alternating frames.
// Only the light buffer changes scale. Fin visibility and bevel coverage
// are calculated at the final canvas resolution.
function tick(now){
  frame=0;if(document.hidden)return;
  const gap=previous?now-previous:16.7;previous=now;
  let due=null;
  for(const s of onscreen){
    s.late=clamp(s.late+(gap>21?2:-.25),0,12);
    const floor=phone.matches ? .6 : .75;
    if(s.late>=6){s.scale=floor;s.recover=now+3200}
    else if(!phone.matches&&onscreen.size>1)s.scale=.75;
    else if(s.late===0&&now>s.recover)s.scale=1;
    if((!s.last||now-s.last>=1000/30-.1)&&(!due||s.last<due.last))due=s;
  }
  if(due)render(due,now);
  wake();
}
const io=new IntersectionObserver(list=>{
  for(const item of list){
    const s=entries.get(item.target);if(!s)continue;
    s.visible=item.isIntersecting&&item.intersectionRatio>0;
    if(s.visible&&!s.failed)onscreen.add(s);else onscreen.delete(s);
    s.last=0;
  }
  if(!onscreen.size)previous=0;
  wake();
},{threshold:[0,.00001]});
const ro=new ResizeObserver(wake);
function move(e){if(e.pointerType!=='touch'){cursor.x=e.clientX;cursor.y=e.clientY}}
function leave(e){if(!e.relatedTarget)cursor.x=cursor.y=-1e5}
function visibility(){
  cancelAnimationFrame(frame);frame=previous=0;
  for(const s of onscreen)s.last=0;
  wake();
}
function events(add){
  const action=add?'addEventListener':'removeEventListener';
  document[action]('pointermove',move,{passive:true});
  document[action]('pointerout',leave);
  document[action]('visibilitychange',visibility);
  window[action]('blur',leave);
}
function mount(el,options={}){
  if(!(el instanceof Element))throw TypeError('Mount requires an element');
  entries.get(el)?.handle.destroy();
  const layer=document.createElement('div'),canvas=document.createElement('canvas');
  layer.setAttribute('aria-hidden','true');
  layer.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;background:#000;pointer-events:none';
  canvas.style.cssText='display:block;width:100%;height:100%';
  layer.append(canvas);el.append(layer);
  const saved=el.style.background;el.style.background='#000';
  const s={
    el,layer,canvas,v:valid(options.variant)?options.variant:0,seed:seedOf(options.seed),
    calm:unit(options.calm,.88),intensity:unit(options.intensity,1),
    x:0,y:0,last:0,time:0,scroll:0,next:null,overlay:null,shown:false,visible:false,
    failed:false,gpu:null,late:0,recover:0,scale:1,dead:false
  };
  function lost(e){
    e.preventDefault();
    if(!s.dead&&!s.failed){s.overlay?.remove();s.overlay=null;staticField(s)}
  }
  function restored(){
    if(s.dead)return;
    s.overlay?.remove();s.overlay=null;s.failed=false;s.last=0;
    canvas.style.visibility='visible';layer.style.backgroundImage='none';layer.style.opacity='1';
    if(s.visible)onscreen.add(s);
    wake();
  }
  canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('webglcontextrestored',restored);
  s.handle={
    setVariant(n){
      if(s.dead||!valid(n)||(s.next??s.v)===n)return;
      if(s.failed){if(s.visible)snapshot(s);s.v=n;layer.style.backgroundImage=cssLook(s)}
      else{s.next=n;wake()}
    },
    destroy(){
      if(s.dead)return;
      s.dead=true;
      canvas.removeEventListener('webglcontextlost',lost);
      canvas.removeEventListener('webglcontextrestored',restored);
      io.unobserve(el);ro.unobserve(el);onscreen.delete(s);entries.delete(el);
      s.gpu?.release();layer.remove();el.style.background=saved;
      if(!entries.size)events(false);
      if(!onscreen.size){cancelAnimationFrame(frame);frame=previous=0}
    }
  };
  if(!entries.size)events(true);
  entries.set(el,s);io.observe(el);ro.observe(el);
  return s.handle;
}
window.CinderField={
  mount,
  setVariant(n){for(const s of entries.values())s.handle.setVariant(n)},
  destroy(){for(const s of [...entries.values()])s.handle.destroy()}
};
window.dispatchEvent(new Event('cinder-field'));
