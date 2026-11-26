// "Where the jobs go" v2: an engineering drawing in perspective.
// A machined double rail crosses a hairline ground grid; six stations stand on it; a lead travels the rail.
// At each leak, crimson particles fall through the floor. The camera orbits slightly with scroll.
(function(){
  var sec=document.getElementById('leaks');if(!sec)return;
  var map=sec.querySelector('.lk-map'),cv=sec.querySelector('.lk-cv'),ctx=cv.getContext('2d');
  var st=[].slice.call(sec.querySelectorAll('.lk-st')),tot=sec.querySelector('.lk-total b');
  var RM=false,shown=0,tIn=0,P=0,raf=0,vis=false,dpr=1,W=0,H=0,t0=performance.now(),last=-1;
  map.classList.add('is3d');
  function sm(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
  function narrow(){return W<700}
  function size(){var r=map.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  var N=6,LEN=10;
  function station(i){var u=i/(N-1)*LEN-LEN/2;return narrow()?{x:0,z:u}:{x:u,z:0}}
  var cam={yaw:0,pitch:0,dist:0,fov:0};
  function setCam(p){
    if(narrow()){cam.yaw=(p-.5)*.14;cam.pitch=.95;cam.dist=10.4;cam.fov=1.3}
    else{cam.yaw=-.38+(p-.5)*.34;cam.pitch=.42;cam.dist=12.5;cam.fov=1.32}
  }
  function proj(x,y,z){
    var cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),X=x*cy-z*sy,Z=x*sy+z*cy;
    var cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),Y=y*cp-Z*sp,Z2=y*sp+Z*cp+cam.dist;
    var f=(Math.min(W,H*1.6)*cam.fov)/Z2;
    return[W*(narrow()?.3:.5)+X*f,H*(narrow()?.64:.56)-Y*f,f,Z2];
  }
  function line(a,b,style){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.strokeStyle=style;ctx.lineWidth=1;ctx.stroke()}
  function frame(now){
    raf=0;var T=RM?3:(now-t0)/1000,u=sm((P-.05)/.82),head=u*(N-1);setCam(P);
    ctx.clearRect(0,0,W,H);
    if(vis&&!tIn)tIn=now;var intro=tIn?sm((now-tIn)/1500):0;
    var off=.16,leaks=st.map(function(el){return +el.dataset.leak||0}),nw=narrow();
    for(var s=0;s<N-1;s++){
      var A=station(s),B=station(s+1);
      for(var side=-1;side<=1;side+=2){
        var ox=nw?off*side:0,oz=nw?0:off*side,f=Math.max(0,Math.min(1,head-s)),a0=proj(A.x+ox,.02,A.z+oz),b0=proj(B.x+ox,.02,B.z+oz);
        var dr=Math.max(0,Math.min(1,intro*(N-1)-s));if(dr>0)line(a0,[a0[0]+(b0[0]-a0[0])*dr,a0[1]+(b0[1]-a0[1])*dr],'rgba(242,241,238,.26)');if(f>0)line(a0,[a0[0]+(b0[0]-a0[0])*f,a0[1]+(b0[1]-a0[1])*f],'rgba(242,241,238,.98)');
      }
    }
    var sum=0;
    st.forEach(function(el,i){
      var S=station(i),reached=head>=i-.02,leak=leaks[i],g=i?sm((head-(i-.45))/.45):intro,pad=.06+.24*g;
      var base=proj(S.x,0,S.z),top=proj(S.x,.12+1.13*g,S.z);
      var pl=[[-pad,-pad],[pad,-pad],[pad,pad],[-pad,pad]].map(function(o){return proj(S.x+o[0],0,S.z+o[1])});el.style.opacity=(.0+g).toFixed(3);
      ctx.beginPath();pl.forEach(function(p,j){j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])});ctx.closePath();
      ctx.fillStyle=reached?(leak?'rgba(255,42,58,.14)':'rgba(242,241,238,.08)'):'rgba(242,241,238,.02)';ctx.fill();
      ctx.strokeStyle=reached?(leak?'rgba(255,42,58,.75)':'rgba(242,241,238,.6)'):'rgba(242,241,238,.2)';ctx.stroke();
      line(base,top,reached?(leak?'rgba(255,42,58,.85)':'rgba(242,241,238,.7)'):'rgba(242,241,238,.22)');
      ctx.fillStyle=reached?(leak?'#ff2a3a':'#f2f1ee'):'rgba(242,241,238,.35)';ctx.beginPath();ctx.arc(top[0],top[1],2.4,0,7);ctx.fill();
      el.style.transform='translate('+top[0].toFixed(1)+'px,'+top[1].toFixed(1)+'px)';
      el.style.zIndex=String(1000-Math.round(top[3]*10));
      el.classList.toggle('on',reached);
      if(reached&&leak){sum+=leak;el.classList.add('leak');
        for(var n=0;n<14;n++){var life=((T*.5+n/14)%1),r=.12+.22*((n*7)%5)/5,ang=n*2.4;
          var p=proj(S.x+Math.cos(ang)*r,-life*2.4,S.z+Math.sin(ang)*r);
          ctx.fillStyle='rgba(255,42,58,'+((1-life)*.9).toFixed(2)+')';ctx.beginPath();ctx.arc(p[0],p[1],1.7,0,7);ctx.fill()}
        line(base,proj(S.x,-2.2,S.z),'rgba(255,42,58,.25)');
      }else el.classList.remove('leak');
    });
    if(u>0&&u<1){for(var k2=0;k2<14;k2++){var q=Math.max(0,head-k2*.03),j=Math.min(N-2,Math.floor(q)),g2=q-j,A2=station(j),B2=station(j+1);
      var pp=proj(A2.x+(B2.x-A2.x)*g2,.05,A2.z+(B2.z-A2.z)*g2);
      ctx.fillStyle='rgba(255,255,255,'+(1-k2/14).toFixed(2)+')';ctx.beginPath();ctx.arc(pp[0],pp[1],Math.max(.6,3.4-k2*.2),0,7);ctx.fill()}}
    shown+=(sum-shown)*.14;if(Math.abs(sum-shown)<4)shown=sum;var sv=Math.round(shown/10)*10;if(sv!==last){last=sv;tot.textContent='$'+sv.toLocaleString('en-US')}
    if(vis)raf=requestAnimationFrame(frame);
  }
  function onScroll(){var r=sec.getBoundingClientRect();P=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));if(!raf)raf=requestAnimationFrame(frame)}
  new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis&&!raf)raf=requestAnimationFrame(frame)}).observe(sec);
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',function(){size();onScroll()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){size();onScroll()});
  size();onScroll();
})();
