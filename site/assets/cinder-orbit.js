// Cinder orbit diagram: one hairline wireframe that morphs with scroll through three stages.
// 0 Leads come in (gravity well, leads fall to the center)
// 1 Answered and booked (top-down rings, signals pulse out from the hub)
// 2 Followed up until done (tilted orbits, follow-ups circling)
(function(){
  var sec=document.getElementById('orbit');if(!sec)return;
  var cv=sec.querySelector('canvas'),ctx=cv.getContext('2d'),steps=[].slice.call(sec.querySelectorAll('.ob-step')),bars=[].slice.call(sec.querySelectorAll('.ob-bars i'));
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches,vis=false,raf=0,t0=performance.now(),P=0,W=0,H=0,dpr=1;
  var RINGS=6,RAD=16,orbitDots=[],leads=[];
  for(var i=0;i<14;i++)leads.push({a:i/14*Math.PI*2+(i%3)*.3,o:i*.37,red:i%4===0});
  for(var k=0;k<9;k++)orbitDots.push({ring:1+(k%4),a:k*1.9,sp:.12+(k%3)*.05,red:k%3===0});
  function sm(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
  function size(){var r=cv.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  function params(p){ // blend the three stages
    var a=sm((p-.30)/.12),b=sm((p-.64)/.12);
    return{
      tilt:.95*(1-a)+1.5708*a*(1-b)+.52*b,
      well:.95*(1-a),
      radial:(1-a)+.35*a*(1-b),
      inflow:1-a,
      pulse:a*(1-b),
      orbit:b,
      ring:.55+.45*a
    }
  }
  function proj(r,th,q,R,cx,cy){
    var x=r*Math.cos(th),z=r*Math.sin(th),y=q.well*(.42/(r+.22)-.34);
    var c=Math.cos(q.tilt),s=Math.sin(q.tilt),y2=y*c-z*s,z2=y*s+z*c,f=3.2/(3.2+z2);
    return[cx+x*f*R,cy+y2*f*R,f];
  }
  function draw(now){
    raf=0;var T=RM?2:(now-t0)/1000,q=params(P),R=Math.min(W*.46,H*.44),cx=W/2,cy=H*.5;
    ctx.clearRect(0,0,W,H);ctx.lineWidth=1;
    // rings
    for(var i=1;i<=RINGS;i++){
      var r=i/RINGS;ctx.beginPath();
      for(var j=0;j<=96;j++){var p=proj(r,j/96*Math.PI*2,q,R,cx,cy);j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])}
      ctx.strokeStyle='rgba(242,241,238,'+(.1+.1*q.ring*(1-i/RINGS*.4)).toFixed(3)+')';ctx.stroke();
    }
    // radial spokes of the well
    if(q.radial>.01){for(var k=0;k<RAD;k++){var th=k/RAD*Math.PI*2;ctx.beginPath();
      for(var m=0;m<=28;m++){var rr=.06+m/28*.94,pp=proj(rr,th,q,R,cx,cy);m?ctx.lineTo(pp[0],pp[1]):ctx.moveTo(pp[0],pp[1])}
      ctx.strokeStyle='rgba(242,241,238,'+(.12*q.radial).toFixed(3)+')';ctx.stroke()}}
    // leads falling into the center
    if(q.inflow>.01)leads.forEach(function(L){var u=((T*.22+L.o)%1),rr=1-sm(u)*.94,pp=proj(rr,L.a+u*.9,q,R,cx,cy),al=q.inflow*Math.sin(Math.PI*u);
      ctx.fillStyle=L.red?'rgba(255,42,58,'+al.toFixed(3)+')':'rgba(242,241,238,'+(al*.9).toFixed(3)+')';ctx.beginPath();ctx.arc(pp[0],pp[1],L.red?2.6:1.8,0,7);ctx.fill()});
    // pulses out from the hub (stage 2)
    if(q.pulse>.01){for(var n=0;n<3;n++){var u2=((T*.35+n/3)%1),pr=u2;ctx.beginPath();
      for(var j2=0;j2<=96;j2++){var p2=proj(pr,j2/96*Math.PI*2,q,R,cx,cy);j2?ctx.lineTo(p2[0],p2[1]):ctx.moveTo(p2[0],p2[1])}
      ctx.strokeStyle='rgba(255,42,58,'+(q.pulse*(1-u2)*.7).toFixed(3)+')';ctx.lineWidth=1.2;ctx.stroke();ctx.lineWidth=1}
      var top=proj(1,-Math.PI/2,q,R,cx,cy),c0=proj(0,0,q,R,cx,cy),grow=sm((T*.5)%1.6);
      ctx.beginPath();ctx.moveTo(c0[0],c0[1]);ctx.lineTo(c0[0]+(top[0]-c0[0])*grow*.55,c0[1]+(top[1]-c0[1])*grow*.55);ctx.strokeStyle='rgba(242,241,238,'+(.85*q.pulse).toFixed(3)+')';ctx.stroke()}
    // orbiting follow-ups (stage 3)
    if(q.orbit>.01)orbitDots.forEach(function(D){var r3=(D.ring+1)/RINGS,p3=proj(r3,D.a+T*D.sp,q,R,cx,cy),al=q.orbit;
      ctx.fillStyle=D.red?'rgba(255,42,58,'+al.toFixed(3)+')':'rgba(242,241,238,'+(al*.9).toFixed(3)+')';ctx.beginPath();ctx.arc(p3[0],p3[1],(D.red?3:2.2)*p3[2],0,7);ctx.fill()});
    // hub
    var hc=proj(0,0,q,R,cx,cy),hr=q.orbit>.5?R*.11*q.orbit:5;
    if(q.orbit>.05){ctx.beginPath();ctx.ellipse(hc[0],hc[1],R*.1,R*.1*Math.max(.35,Math.cos(q.tilt)),0,0,7);ctx.strokeStyle='rgba(242,241,238,'+(.55*q.orbit).toFixed(3)+')';ctx.stroke()}
    ctx.fillStyle='#f2f1ee';ctx.beginPath();ctx.arc(hc[0],hc[1],4.5,0,7);ctx.fill();
    if(vis&&!RM)raf=requestAnimationFrame(draw);
  }
  function onScroll(){
    var r=sec.getBoundingClientRect(),span=r.height-innerHeight;P=Math.max(0,Math.min(1,-r.top/Math.max(1,span)));
    var s=P<.36?0:P<.7?1:2;steps.forEach(function(el,i){el.classList.toggle('on',i===s)});
    bars.forEach(function(b,i){var lo=[0,.36,.7][i],hi=[.36,.7,1][i];b.style.setProperty('--f',Math.max(0,Math.min(1,(P-lo)/(hi-lo))).toFixed(3))});
    if(!raf)raf=requestAnimationFrame(draw);
  }
  new IntersectionObserver(function(e){vis=e[0].isIntersecting;if(vis&&!raf)raf=requestAnimationFrame(draw)}).observe(sec);
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',function(){size();onScroll()});
  size();onScroll();
})();
