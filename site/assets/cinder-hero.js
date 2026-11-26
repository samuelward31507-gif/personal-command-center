import {instrument} from './instrument-studio.js';

window.CinderHero=instrument({
  label:'A hinged desktop terminal assembles around the Cinder app. Example business, sample data.',
  span:[580,370],assemble:true,
  model({T,group,box,ring,disc,add,own,labelPlate,deck,side,steel,seal,glass,ink,invalidate}){
    const chassis=group(),lid=group(chassis),base=group(chassis),foot=group(chassis);
    const gasket=group(lid),display=group(lid);
    lid.position.y=-93;
    box(0,0,0,524,61,39,side,7,base);
    box(0,0,20,518,56,4,deck,2,base);
    // Machined pedestal, visible hinge and recessed cable race behind the panel.
    box(0,58,-13,52,104,27,side,5,chassis);
    box(0,27,-20,92,18,46,deck,3,chassis);
    box(0,57,-28,17,63,3,seal,1,chassis);
    box(0,57,-30,10,54,1,steel,.5,chassis);
    box(0,0,0,420,19,74,side,6,foot);
    for(const x of [-206,206]){
      const bearing=group(base);bearing.position.set(x,25,5);bearing.rotation.y=Math.PI/2;
      disc(0,0,0,14,58,steel,bearing);ring(0,0,30,9,1.4,seal,bearing);
    }
    for(let j=0;j<19;j++)box(-220+j*5,-6,22.4,2,9,1,seal,.45,base);
    box(211,0,23,18,2,1,ink(0xd4142a),.5,base);
    labelPlate('EXAMPLE BUSINESS · SAMPLE DATA',0,0,22.5,200,10,base);
    box(0,126,0,505,261,15,side,6,lid);
    box(0,126,8,501,257,4,deck,2,lid);
    box(0,126,0,484,242,3,seal,1.4,gasket);
    box(0,126,0,476,237,4,glass,1.8,display);
    // Draw the product UI at 2x backing resolution: no raster screenshot and
    // crisp typography on high-DPI displays.
    const screenCanvas=document.createElement('canvas');
    screenCanvas.width=2400;screenCanvas.height=1200;
    const ctx=screenCanvas.getContext('2d');ctx.scale(2,2);
    const W=1200,H=600;
    ctx.fillStyle='#09090b';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#111113';ctx.fillRect(0,0,190,H);
    ctx.strokeStyle='rgba(242,241,238,.09)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(190,0);ctx.lineTo(190,H);ctx.stroke();
    ctx.fillStyle='#f2f1ee';ctx.font='600 23px Inter, sans-serif';ctx.fillText('CINDER',28,43);
    ctx.fillStyle='#77767c';ctx.font='500 13px "Geist Mono", monospace';ctx.fillText('REVENUE',28,64);
    ['Today','Leads','Schedule','Quotes','Money'].forEach((s,i)=>{
      ctx.fillStyle=i===0?'#242428':'#111113';ctx.fillRect(18,94+i*47,154,36);
      ctx.fillStyle=i===0?'#f2f1ee':'#a3a19d';ctx.font='500 16px Inter, sans-serif';ctx.fillText(s,34,117+i*47);
    });
    ctx.fillStyle='#f2f1ee';ctx.font='600 29px Inter, sans-serif';ctx.fillText('Today',230,61);
    ctx.fillStyle='#a3a19d';ctx.font='16px Inter, sans-serif';ctx.fillText('Brightline Co',230,91);
    ctx.fillStyle='#1c1c1f';ctx.fillRect(230,119,940,132);
    ctx.fillStyle='#a3a19d';ctx.font='14px "Geist Mono", monospace';ctx.fillText('WON THIS MONTH',258,153);
    ctx.fillStyle='#f2f1ee';ctx.font='600 48px Inter, sans-serif';ctx.fillText('$28,450',258,211);
    ctx.fillStyle='#77767c';ctx.font='14px Inter, sans-serif';ctx.fillText('Example business · sample data',875,153);
    ctx.fillStyle='#1c1c1f';ctx.fillRect(230,272,940,270);
    ctx.fillStyle='#a3a19d';ctx.font='14px "Geist Mono", monospace';ctx.fillText('RECENT ACTIVITY',258,307);
    const rows=[
      ['New lead','Replied in seconds','07:42 PM'],
      ['Estimate booked','Thu · 9:00 AM','Today'],
      ['Quote followed up','Awaiting response','Today'],
      ['Invoice paid','Brightline · $4,800','Today']
    ];
    rows.forEach((r,i)=>{
      const y=350+i*48;
      ctx.strokeStyle='rgba(242,241,238,.08)';ctx.beginPath();ctx.moveTo(258,y+13);ctx.lineTo(1142,y+13);ctx.stroke();
      ctx.fillStyle='#f2f1ee';ctx.font='500 17px Inter, sans-serif';ctx.fillText(r[0],258,y);
      ctx.fillStyle='#a3a19d';ctx.font='15px Inter, sans-serif';ctx.fillText(r[1],530,y);
      ctx.fillStyle='#77767c';ctx.font='13px "Geist Mono", monospace';ctx.fillText(r[2],1040,y);
    });
    const texture=own(new T.CanvasTexture(screenCanvas));
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const screen=own(new T.MeshBasicMaterial({map:texture}));
    screen.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));');
    };
    add(new T.PlaneGeometry(462,228),screen,0,126,2.2,display);
    return (p,arrival)=>{
      const shut=1-arrival;
      chassis.rotation.set(-.10+.20*p,-.17+.32*p+.14*ease(p,0,.42),.018-.036*p);
      base.position.set(0,-125-26*shut,-5);
      foot.position.set(0,-156-31*shut,-14-36*shut);
      lid.rotation.x=-.91*shut-.12-.20*p+.26*ease(p,0,.28);
      gasket.position.z=11+38*shut;
      display.position.z=14+73*shut;
      // A tiny live indicator arrives with the first scroll beat.
      base.position.x=2.5*ease(p,.18,.34);
    };
  }
});
window.dispatchEvent(new Event('cinder-visual'));
