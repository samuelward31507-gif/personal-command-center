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
    const texture=own(new T.TextureLoader().load('/assets/screens/today-1200.webp',invalidate));
    texture.colorSpace=T.SRGBColorSpace;
    // Preserve the source aspect ratio: the display window crops the lower dashboard.
    texture.repeat.set(1,.79);texture.offset.y=.21;
    const screen=own(new T.MeshBasicMaterial({map:texture}));
    screen.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));');
    };
    add(new T.PlaneGeometry(462,228),screen,0,126,2.2,display);
    return (p,arrival)=>{
      const shut=1-arrival;
      chassis.rotation.set(-.10+.20*p,-.17+.32*p,.018-.036*p);
      base.position.set(0,-125-26*shut,-5);
      foot.position.set(0,-156-31*shut,-14-36*shut);
      lid.rotation.x=-.91*shut-.12-.20*p;
      gasket.position.z=11+38*shut;
      display.position.z=14+73*shut;
    };
  }
});
window.dispatchEvent(new Event('cinder-visual'));
