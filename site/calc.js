(function(){document.querySelectorAll("[data-calc]").forEach(function(el){
var f=el.querySelector("form"),o=function(k){return el.querySelectorAll('[data-o="'+k+'"]')},
set=function(k,v){o(k).forEach(function(n){n.textContent=v})},
usd=function(n){return "$"+Math.round(n).toLocaleString("en-US")},
per=function(n){if(n<0.05)return "none";if(n<0.75)return "about 1 every "+Math.max(2,Math.round(1/n))+" months";var r=Math.round(n);return "about "+r+" a month"},
tw=function(k,v){var M=document.documentElement.classList.contains("motion");o(k).forEach(function(n){if(!M||n._v===undefined){n._v=v;n.textContent=usd(v);return}var a=n._v,t0=performance.now(),id=(n._id||0)+1;n._id=id;(function s(now){if(n._id!==id)return;var p=Math.min(1,(now-t0)/450),e=1-Math.pow(1-p,3);n._v=a+(v-a)*e;n.textContent=usd(n._v);if(p<1)requestAnimationFrame(s);else n._v=v})(t0)})},
d=el.dataset;f.leads.value=d.leads;f.job.value=d.job;f.close.value=d.close;
function run(){var L=+f.leads.value,J=+f.job.value,C=+f.close.value/100,S=+f.speed.value,F=+f.fu.value;
var lost=L*S,lostJobs=lost*C,fuJobs=F?L*(1-S)*C*0.10:0,month=(lostJobs+fuJobs)*J;
set("leads",L);set("job",usd(J));set("close",Math.round(C*100)+"%");
set("lostLeads",per(lost));set("lostJobs",per(lostJobs));set("fuJobs",per(fuJobs));
tw("month",month);tw("year",month*12);tw("half",month*6);
el.querySelectorAll("input[type=range]").forEach(function(r){r.style.setProperty("--p",((r.value-r.min)/(r.max-r.min)*100)+"%")})}
f.addEventListener("input",run);run();})})();
