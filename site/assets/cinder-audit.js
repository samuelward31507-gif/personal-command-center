import {instrument} from './instrument-studio.js';

// Five pressure chambers share a cast manifold. The lid hinge, gauge needle
// and indicator for each channel all read the same inspection stroke.
window.CinderAudit=instrument({
  label:'Five inspection gauges opening to show pass or leak. Example business, sample data.',
  span:[432,337],
  model({T,group,box,disc,ring,screw,labelPlate,deck,side,steel,seal,glass,ink,ease}){
    const ivory=ink(0xf2f1ee),crimson=ink(0xff2a3a);
    box(0,0,-7,420,294,32,side,8); // graphite cast instrument body
    box(0,0,7,416,290,5,seal,2); // recessed black reveal
    box(0,0,12,418,292,9,deck,4); // brushed aluminum perimeter bezel
    box(0,0,18,402,276,5,side,3); // deep graphite instrument plate
    // Brushed alloy bezel: four rails sit around the graphite instrument plate.
    box(0,149,16,430,7,5,deck,2);
    box(0,-149,16,430,7,5,deck,2);
    box(-211,0,16,7,294,5,deck,2);
    box(211,0,16,7,294,5,deck,2);
    for(const x of [-193,193])for(const y of [-128,128])screw(x,y,20);
    const chambers=[];
    for(const [i,title] of ['INTAKE','REPLY','BOOKING','QUOTES','REVIEWS'].entries()){
      const x=i<3?(i-1)*125:(i-3.5)*125,y=i<3?66:-47;
      disc(x,y,19,48,5,side);ring(x,y,23,45,2.1,steel);
      disc(x,y,24,42,2,seal);ring(x,y,26,37,.65,deck);
      for(let k=0;k<17;k++){
        const a=(k-8)*.22,big=k%4===0;
        const mark=group();mark.position.set(x,y,26);mark.rotation.z=a;
        box(0,31,0,big?1.7:1,big?6:3,1,ivory,.4,mark);
      }
      const leak=[1,3,4].includes(i),needle=group();
      needle.position.set(x,y,28);
      box(0,13,0,2.3,31,2,leak?crimson:ivory,.8,needle);
      disc(x,y,30,4.1,3,steel);
      labelPlate(leak?'LEAK':'PASS',x,y-17,28,38,10,undefined,leak?'#ff2a3a':'#f2f1ee');
      const hinge=group();hinge.position.set(x,y+40,32);
      disc(0,-40,0,42,3.5,side,hinge);
      ring(0,-40,2.1,38.5,.85,steel,hinge);
      // The raised cover exposes the gasket and machined concentric seats underneath.
      disc(0,-40,-2.2,34,2,deck,hinge); // illuminated lid interior
      ring(0,-40,-1,34,1.1,steel,hinge);
      ring(0,-40,-2.5,36,1.35,steel,hinge);
      ring(0,-40,-2.4,30,1.1,seal,hinge);
      disc(0,-40,-2.3,11,2,deck,hinge);
      for(const sign of [-1,1]){
        box(x+sign*16,y+40,31,7,10,9,side,2);
        disc(x+sign*16,y+40,36,1.7,1,steel);
      }
      labelPlate(title,0,-39,2.6,72,12,hinge);
      box(x,y+40,33,26,5,5,steel,2);
      chambers.push({hinge,needle,leak});
    }
    const receipt=group();receipt.position.set(0,-116,22);
    box(0,-116,18,219,28,4,seal,1);
    box(0,0,0,210,23,5,glass,2,receipt);
    const result=labelPlate('3 LEAKS  /  5 CHECKS',0,0,3,172,14,receipt,'#ff2a3a');
    result.material.color.set(0xff2a3a);
    labelPlate('EXAMPLE BUSINESS · SAMPLE DATA',0,-137,18,180,9);
    return p=>{
      chambers.forEach(({hinge,needle,leak},i)=>{
        const start=i*.157;
        hinge.rotation.x=-1.94*ease(p,start,start+.20);
        needle.rotation.z=1.55-(leak?2.83:1.18)*ease(p,start+.044,start+.215);
      });
      result.material.opacity=ease(p,.82,.97);
      receipt.position.x=-64*(1-ease(p,.82,1));
      receipt.position.z=20+5*ease(p,.82,1);
    };
  }
});
window.dispatchEvent(new Event('cinder-audit'));
window.dispatchEvent(new Event('cinder-visual'));
