(function(){
var items=[].slice.call(document.querySelectorAll('.lk-n li')),blocks=[].slice.call(document.querySelectorAll('.lk-b')),strip=document.querySelector('.lk-n ul'),at=0,tick=false;
if(!items.length)return;
function pick(){tick=false;var line=innerHeight*.42,n=0;for(var i=0;i<blocks.length;i++){if(blocks[i].getBoundingClientRect().top<=line)n=i}
if(n===at)return;items[at].classList.remove('on');items[n].classList.add('on');at=n;
if(strip.scrollWidth>strip.clientWidth+4){var el=items[n];strip.scrollTo({left:el.offsetLeft-20,behavior:'smooth'})}}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(pick)}},{passive:true});addEventListener('resize',pick);pick();
})();

(function(){
var qs=[].slice.call(document.querySelectorAll('.fq blockquote,.fq .cq-t'));if(!qs.length)return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
qs.forEach(function(q){
var words=q.textContent.split(' ');q.innerHTML=words.map(function(w){return '<span>'+w+'</span>'}).join(' ');q.classList.add('fill');
var sp=q.querySelectorAll('span'),last=-1,tick=false;
function paint(){tick=false;var r=q.getBoundingClientRect(),vh=innerHeight,p=(vh*.86-r.top)/(vh*.5),n=Math.round(Math.max(0,Math.min(1,p))*sp.length);
if(n===last)return;last=n;for(var i=0;i<sp.length;i++)sp[i].classList.toggle('on',i<n)}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(paint)}},{passive:true});addEventListener('resize',paint);paint();
});
})();

(function(){
var bd=document.querySelector('.bd');if(!bd)return;
var sets=[[1,2,3,4,5],[0,1,2],[0,3,5,7]],sp=bd.querySelectorAll('.bd-sp'),nd=bd.querySelectorAll('.bd-n'),lb=bd.querySelectorAll('.bd-l'),c2=bd.querySelector('.bd-c2'),tabs=bd.querySelectorAll('.bd-tabs button'),at=0,timer=0;
function show(k){at=k;for(var i=0;i<8;i++){var on=sets[k].indexOf(i)>-1;sp[i].classList.toggle('lit',on);nd[i].classList.toggle('lit',on);lb[i].classList.toggle('lit',on)}
c2.textContent=sets[k].length+' of 8';for(var j=0;j<tabs.length;j++)tabs[j].classList.toggle('on',j===k)}
[].forEach.call(tabs,function(t,k){t.addEventListener('click',function(){clearInterval(timer);timer=-1;show(k)})});
if(!('IntersectionObserver' in window))return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
bd.classList.add('pre');
new IntersectionObserver(function(e){if(e[0].isIntersecting){bd.classList.remove('pre');if(!timer)timer=setInterval(function(){show((at+1)%3)},3600)}else if(timer>0){clearInterval(timer);timer=0}},{threshold:.45}).observe(bd.querySelector('.bd-w'));
})();

(function(){
var ck=document.querySelector('.ck'),top=document.querySelector('.top'),darks=document.querySelectorAll('.au,.hw,.bd,.cl,.fo');if(!ck)return;
var q=location.search,force=/[?&]motion=on/.test(q),snap=/[?&]snap=1/.test(q),band=ck.querySelector('.ck-dark'),cur=-1,dk=false;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!force){onscroll=nav;nav();return}
ck.classList.add('on');
var pin=ck.querySelector('.ck-pin'),txt=ck.querySelector('.ck-top'),inner=ck.querySelector('.ck-i'),hands=ck.querySelector('.ck-h'),
wedge=ck.querySelector('.ck-w'),arc=ck.querySelector('.ck-a'),needle=ck.querySelector('.ck-n'),count=ck.querySelector('.ck-count'),title=ck.querySelector('.ck-title');
var vw,vh,R0,R1;
function cl(x){return x<0?0:x>1?1:x}
function ez(x){return x*x*(3-2*x)}
function measure(){vw=document.documentElement.clientWidth;vh=innerHeight;R0=Math.min(vh*.22,vw*.36,240);R1=Math.hypot(vw/2,vh/2)*1.03;
inner.setAttribute('transform','scale('+Math.min(.8,.44*vh/R1).toFixed(4)+')');cur=-1}
function target(){var r=ck.getBoundingClientRect();return cl((vh*.85-r.top)/(vh*.85))+cl(-r.top/(r.height-vh))}
function nav(){var c=ck.getBoundingClientRect(),o=ck.classList.contains('on'),k=band.getBoundingClientRect(),d=(o&&cur>1.8&&c.bottom>34)||(!o&&k.top<34&&k.bottom>34);
for(var i=0;i<darks.length&&!d;i++){var r=darks[i].getBoundingClientRect();d=r.top<34&&r.bottom>34}
if(d!==dk){dk=d;top.classList.toggle('dk',d)}}
function draw(v){var a=ez(cl(v)),p=cl(v-1),th=a*Math.PI/2,x=(80*Math.sin(th)).toFixed(2),y=(-80*Math.cos(th)).toFixed(2);
needle.setAttribute('transform','rotate('+(a*90).toFixed(2)+')');
if(a>.004){wedge.setAttribute('d','M0 0L0 -80A80 80 0 0 1 '+x+' '+y+'Z');arc.setAttribute('d','M0 -80A80 80 0 0 1 '+x+' '+y)}
wedge.style.opacity=arc.style.opacity=a>.004?1:0;
var sec=Math.round(a*900),m=Math.floor(sec/60),s2=sec%60;count.textContent=(m<10?'0':'')+m+':'+(s2<10?'0':'')+s2;
var g=cl(p/.86),e=Math.pow(g,1.5),r=R0*Math.pow(R1/R0,e),cy=(.66-.16*ez(cl(p/.5)))*vh;
if(g>=1)r=R1*1.02;
pin.style.setProperty('--r',r.toFixed(1)+'px');pin.style.setProperty('--cy',cy.toFixed(1)+'px');
txt.style.transform='translate3d(0,'+(-p*vh*.9).toFixed(1)+'px,0)';txt.style.opacity=(1-cl(p/.3)).toFixed(3);
var f=(1-cl((p-.04)/.26)).toFixed(3);hands.style.opacity=f;count.style.opacity=f;
var t=ez(cl((p-.58)/.26));title.style.opacity=t.toFixed(3);title.style.transform='translate3d(0,calc(-50% + '+((1-t)*44).toFixed(1)+'px),0)'}
function loop(){var t=target();if(cur<0||snap)cur=t;else cur+=(t-cur)*.17;if(Math.abs(t-cur)<.0004)cur=t;draw(cur);nav();requestAnimationFrame(loop)}
addEventListener('resize',measure);measure();loop();
})();
(function(){
if(document.querySelector('.ck'))return;var top=document.querySelector('.top'),darks=document.querySelectorAll('.hw,.cl,.fo,.sn,.jr,.dh,.sx.dk,.s-dk,.chp,.s3,.sg2,.yw0,.sc,.dsn.dk'),dk=false;if(!top)return;
function nav(){var d=false;for(var i=0;i<darks.length&&!d;i++){var r=darks[i].getBoundingClientRect();d=r.top<62&&r.bottom>34}if(d!==dk){dk=d;top.classList.toggle('dk',d)}}
addEventListener('scroll',nav,{passive:true});addEventListener('resize',function(){dk=top.classList.contains('dk');nav()});nav();
})();
(function(){
var root=document.querySelector('.dayp');if(!root)return;
var ch=[].slice.call(root.querySelectorAll('.dch')),top=document.querySelector('.top'),cur='',tick=false;
var still=innerWidth<861||(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search));
var items=ch.map(function(c){var it=[].slice.call(c.querySelectorAll('.tr-e,.tr-f,.qo-t,.qo-r,.inv-p,.gt-r,.gt-f,.ng-x,.ng-g>div,.mr p,.pop'));if(!still)it.forEach(function(x){x.classList.add('bi')});return it});
if(!still)root.classList.add('live');
function f(){tick=false;var vh=innerHeight,best=0,bd=1e9,total=document.documentElement.scrollHeight-vh;
ch.forEach(function(c,i){var r=c.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-vh/2);if(d<bd){bd=d;best=i}
if(!still){var p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-vh)));c.style.setProperty('--p',p.toFixed(3));var k=Math.ceil(Math.min(1,Math.max(0,(p-.12)/.45))*items[i].length);items[i].forEach(function(e,j){e.classList.toggle('in',j<k)})}});
var t=ch[best].getAttribute('data-t');if(t!==cur){cur=t;root.setAttribute('data-sky',t)}
if(top&&root.getBoundingClientRect().bottom>60)top.classList.toggle('dk',cur==='dusk'||cur==='night');
root.style.setProperty('--s',Math.max(0,Math.min(1,scrollY/Math.max(1,root.offsetHeight-vh))).toFixed(4))}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f();
})();
(function(){
var els=[].slice.call(document.querySelectorAll('[data-sp]'));if(!els.length)return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
if(innerWidth<861)els=els.filter(function(e){return e.classList.contains('pt')});if(!els.length)return;
var top=document.querySelector('.top'),mine=false,run=false,snap=/[?&]snap=1/.test(location.search);
var st=els.map(function(e){e.classList.add('sp-live');var n=e.querySelector('.pt-n');return {e:e,pt:e.classList.contains('pt'),cv:e.hasAttribute('data-cv'),c:-1,n:n,to:n?+n.getAttribute('data-to'):0,fmt:n?n.getAttribute('data-fmt'):'',last:-1}});
function cl(x){return x<0?0:x>1?1:x}function ez(x){return x*x*(3-2*x)}
function f(){var vh=innerHeight,pin=null,more=false;st.forEach(function(s){var r=s.e.getBoundingClientRect(),t=cl(-r.top/Math.max(1,r.height-vh-(s.cv?vh*.7:0)));
if(!s.pt){s.e.style.setProperty('--p',t.toFixed(4));return}
if(s.c<0||snap)s.c=t;else{s.c+=(t-s.c)*.16;if(Math.abs(t-s.c)<.0005)s.c=t;else more=true}
var p=s.c,a=ez(cl(p/.42)),g=cl((p-.46)/.36),k=g>=1?1:(Math.pow(40,g)-1)/39,y=s.e.style;
y.setProperty('--p',p.toFixed(4));y.setProperty('--a',a.toFixed(4));y.setProperty('--g',k.toFixed(4));y.setProperty('--f',(1-cl((p-.44)/.12)).toFixed(3));y.setProperty('--t',ez(cl((p-.76)/.2)).toFixed(3));
if(s.n){var v=Math.round(a*s.to);if(v!==s.last){s.last=v;s.n.textContent=s.fmt.replace('#',v.toLocaleString('en-US'))}}
if(r.top<=0&&r.bottom>60)pin=k});
if(top){if(pin!==null){mine=true;top.classList.toggle('dk',pin>.6)}else if(mine){mine=false;top.classList.remove('dk');dispatchEvent(new Event('resize'))}}
run=more;if(more)requestAnimationFrame(f)}
function q(){if(!run){run=true;requestAnimationFrame(f)}}
addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
})();
(function(){
var sc=[].slice.call(document.querySelectorAll('.sc'));if(!sc.length)return;
if(innerWidth<981||(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search)))return;
sc.forEach(function(el){el.classList.add('live');
var ss=[].slice.call(el.querySelectorAll('.sc-s')),cs=[].slice.call(el.querySelectorAll('.sc-c')),n=ss.length,bar=el.querySelector('.sc-b i'),last=-1,lastk=-1,tick=false;
var items=ss.map(function(s){var it=[].slice.call(s.querySelectorAll('.tr-e,.tr-f,.qo-t,.qo-r,.inv-p,.fl-r,.rn-f,.oq-r,.wkc-g i,.ag-g>div,.pk-f,.rvw>*,.rpt>div,.rpt>p'));it.forEach(function(x){x.classList.add('bi')});return it});
function f(){tick=false;var r=el.getBoundingClientRect(),p=Math.max(0,Math.min(.9999,-r.top/(r.height-innerHeight))),x=p*n,i=Math.floor(x),q=Math.min(1,(x-i)/.62),k=Math.ceil(q*items[i].length);
if(bar)bar.style.transform='scaleY('+p.toFixed(3)+')';
if(i!==last){last=i;lastk=-1;ss.forEach(function(s,j){s.classList.toggle('on',j===i);s.classList.toggle('past',j<i)});cs.forEach(function(c,j){c.classList.toggle('on',j===i)})}
if(k!==lastk){lastk=k;items[i].forEach(function(e,j){e.classList.toggle('in',j<k)})}}
addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(f)}},{passive:true});addEventListener('resize',f);f();
cs.forEach(function(c,j){c.addEventListener('click',function(e){if(e.target.closest('a'))return;var r=el.getBoundingClientRect();scrollTo({top:scrollY+r.top+(r.height-innerHeight)*((j+.5)/n),behavior:'smooth'})})});
});
})();
(function(){
var els=[].slice.call(document.querySelectorAll('.t-exp,.t-wipe,.t-door,[data-in]'));if(!els.length)return;
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search))return;
var tick=false;function f(){tick=false;var vh=innerHeight;els.forEach(function(e){var r=e.getBoundingClientRect(),p=Math.max(0,Math.min(1,(vh-r.top)/(vh*.72)));e.style.setProperty('--p',p.toFixed(3))})}
function q(){if(!tick){tick=true;requestAnimationFrame(f)}}addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
})();
(function(){
var bar=document.querySelector('.chb');if(!bar)return;
var secs=[].slice.call(document.querySelectorAll('[data-ch]')),cells=[].slice.call(bar.querySelectorAll('a')),cur=-2,dk=null,tick=false;
var calm=matchMedia('(prefers-reduced-motion: reduce)').matches&&!/[?&]motion=on/.test(location.search),hero=document.querySelector('.dhero');
function f(){tick=false;var mid=innerHeight/2,low=innerHeight-40,at=-1,d=false;if(hero&&!calm)hero.style.setProperty('--h',Math.max(0,Math.min(1,scrollY/(hero.offsetHeight*.7))).toFixed(4));secs.forEach(function(s){var r=s.getBoundingClientRect();if(r.top<=mid&&r.bottom>mid)at=+s.getAttribute('data-ch');
if(r.top<=low&&r.bottom>low)d=s.classList.contains('dk')||(s.classList.contains('pt')&&(!s.classList.contains('sp-live')||parseFloat(s.style.getPropertyValue('--g'))>.5))});
if(at!==cur){cur=at;bar.classList.toggle('on',at>=0);cells.forEach(function(c,i){c.classList.toggle('on',i===at)})}
if(d!==dk){dk=d;bar.classList.toggle('dk',d)}}
function q(){if(!tick){tick=true;requestAnimationFrame(f)}}addEventListener('scroll',q,{passive:true});addEventListener('resize',q);f();
cells.forEach(function(c,i){c.addEventListener('click',function(e){e.preventDefault();var s=secs.filter(function(x){return +x.getAttribute('data-ch')===i})[0];
if(s)scrollTo({top:s.getBoundingClientRect().top+scrollY+4,behavior:calm?'auto':'smooth'})})});
})();
