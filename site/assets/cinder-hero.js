import {instrument} from './instrument-studio.js';

window.CinderHero=instrument({
  label:'Brightline Co Today dashboard on a machined studio monitor. Example business, sample data.',
  span:[580,370],assemble:true,
  model({T,group,box,ring,disc,add,own,labelPlate,deck,side,steel,seal,glass,ink,invalidate,ease}){
    const chassis=group(),lid=group(chassis),base=group(chassis),foot=group(chassis);
    const mobile=matchMedia('(max-width:700px)').matches;
    chassis.scale.setScalar(mobile?1.15:.9);
    const gasket=group(lid),display=group(lid);
    lid.position.y=-93;

    // Low, broad stand with a visible hinge and an inset cable channel.
    box(0,0,0,524,61,39,side,7,base);
    box(0,0,20,518,56,4,deck,2,base);
    box(0,0,0,420,19,74,side,6,foot);
    box(0,-2,0,248,5,30,seal,2,foot);
    for(const x of [-206,206]){
      const bearing=group(base);bearing.position.set(x,25,5);bearing.rotation.y=Math.PI/2;
      disc(0,0,0,14,58,steel,bearing);ring(0,0,30,9,1.4,seal,bearing);
    }
    for(let j=0;j<19;j++)box(-220+j*5,-6,22.4,2,9,1,seal,.45,base);
    box(211,0,23,18,2,1,ink(0xff2a3a),.5,base);
    labelPlate('EXAMPLE BUSINESS · SAMPLE DATA',0,0,22.5,200,10,base);

    // Thin graphite display, brushed bezel, recessed gasket and smoked glass.
    box(0,126,0,505,261,15,side,6,lid);
    box(0,126,8,501,257,4,deck,2,lid);
    box(0,126,0,484,242,3,seal,1.4,gasket);
    box(0,126,0,476,237,4,glass,1.8,display);

    // A 4x canvas texture is rendered as actual text, never a screenshot.
    const canvas=document.createElement('canvas');
    const scale=4;canvas.width=1904;canvas.height=948;
    const ctx=canvas.getContext('2d');
    const texture=own(new T.CanvasTexture(canvas));
    texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=8;
    texture.minFilter=T.LinearMipmapLinearFilter;
    texture.magFilter=T.LinearFilter;
    const screen=own(new T.MeshBasicMaterial({map:texture, toneMapped:false}));
    add(new T.PlaneGeometry(462,228),screen,0,126,2.2,display);
    const liveDot=add(new T.CircleGeometry(4.2,24),ink(0xff2a3a),-122,107,3.2,display);
    const powerRows=[107,89,71,53].map(y=>box(0,y,3.5,454,18,1,ink(0x09090b),.2,display));

    function drawDashboard(progress,arrival){
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.clearRect(0,0,476,237);
      ctx.fillStyle='#09090b';ctx.fillRect(0,0,476,237);
      ctx.fillStyle='#111113';ctx.fillRect(0,0,476,33);
      ctx.fillStyle='#f2f1ee';ctx.font='600 10px Inter, sans-serif';ctx.fillText('BRIGHTLINE CO',16,20);
      ctx.fillStyle='#a3a19d';ctx.font='500 9px "Geist Mono", monospace';ctx.fillText('TODAY',126,20);
      ctx.fillStyle='#ff2a3a';ctx.beginPath();ctx.arc(448,16,2.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#a3a19d';ctx.font='9px "Geist Mono", monospace';ctx.fillText('LIVE',456,19);
      ctx.fillStyle='#6f6d69';ctx.fillText('WON THIS MONTH',16,54);
      ctx.fillStyle='#f2f1ee';ctx.font='600 27px Inter, sans-serif';ctx.fillText('$84,250',16,85);
      ctx.fillStyle='#6f6d69';ctx.font='9px "Geist Mono", monospace';ctx.fillText('4 RECENT EVENTS',16,108);
      const rows=[
        ['NEW LEAD','Replied in seconds','JUST NOW'],
        ['ESTIMATE','Booked · Thu 9:00 AM','TODAY'],
        ['QUOTE','Followed up','TODAY'],
        ['INVOICE','Paid','TODAY']
      ];
      rows.forEach((row,i)=>{
        const y=119+i*25,shown=Math.min(1,Math.max(0,(arrival-.12-i*.12)/.22));
        ctx.globalAlpha=shown;
        ctx.strokeStyle='#29292d';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(16,y);ctx.lineTo(460,y);ctx.stroke();
        ctx.fillStyle='#a3a19d';ctx.font='8px "Geist Mono", monospace';ctx.fillText(row[0],16,y+10);
        ctx.fillStyle='#f2f1ee';ctx.font='500 10px Inter, sans-serif';ctx.fillText(row[1],112,y+10);
        ctx.fillStyle='#6f6d69';ctx.font='8px "Geist Mono", monospace';ctx.textAlign='right';ctx.fillText(row[2],459,y+10);ctx.textAlign='left';
        // Scroll-scrubbed landing signal on the first event row.
        if(i===0&&progress>.48){
          ctx.globalAlpha=Math.min(1,(progress-.48)/.18);
          ctx.fillStyle='#ff2a3a';ctx.beginPath();ctx.arc(7,y+5,2.3,0,Math.PI*2);ctx.fill();
        }
      });
      ctx.globalAlpha=1;
      ctx.fillStyle='#6f6d69';ctx.font='8px "Geist Mono", monospace';ctx.fillText('Example business · sample data',16,230);
      texture.needsUpdate=true;
    }
    drawDashboard(0,0);

    return (p,arrival)=>{
      powerRows.forEach((row,i)=>{row.visible=arrival<.20+i*.18});
      camera.zoom=1+.08*ease(p,0,.55);
      camera.position.z=810-70*ease(p,0,.55);
      camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
      const shut=1-arrival;
      // Stand rises and locks; display swings from a 15-degree back tilt.
      chassis.rotation.set(-.10+.20*p,-.07+.14*p,.018-.036*p);
      chassis.scale.setScalar(mobile?1.15:.9);
      base.position.set(0,-125-26*shut,-5);
      foot.position.set(0,-156-31*shut,-14-36*shut);
      lid.rotation.x=-.262*shut-.12;
      gasket.position.z=11+38*shut;
      display.position.z=14+73*shut;
      drawDashboard(p,arrival);
    };
  }
});
window.dispatchEvent(new Event('cinder-visual'));
