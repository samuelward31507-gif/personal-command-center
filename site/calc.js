(function(){document.querySelectorAll("[data-calc]").forEach(function(el){
var f=el.querySelector("form"),o=function(k){return el.querySelectorAll('[data-o="'+k+'"]')},
set=function(k,v){o(k).forEach(function(n){n.textContent=v})},
usd=function(n){return "$"+Math.round(n).toLocaleString("en-US")},
per=function(n){if(n<0.05)return "none";if(n<0.75)return "about 1 every "+Math.max(2,Math.round(1/n))+" months";var r=Math.round(n);return "about "+r+" a month"},
d=el.dataset;f.leads.value=d.leads;f.job.value=d.job;f.close.value=d.close;
function run(){var L=+f.leads.value,J=+f.job.value,C=+f.close.value/100,S=+f.speed.value,F=+f.fu.value;
var lost=L*S,lostJobs=lost*C,fuJobs=F?L*(1-S)*C*0.10:0,month=(lostJobs+fuJobs)*J;
set("leads",L);set("job",usd(J));set("close",Math.round(C*100)+"%");
set("lostLeads",per(lost));set("lostJobs",per(lostJobs));set("fuJobs",per(fuJobs));
set("month",usd(month));set("year",usd(month*12));set("half",usd(month*6));
el.querySelectorAll("input[type=range]").forEach(function(r){r.style.setProperty("--p",((r.value-r.min)/(r.max-r.min)*100)+"%")})}
f.addEventListener("input",run);run();})})();
