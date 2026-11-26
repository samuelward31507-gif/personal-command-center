// Backdrops v4: restraint. Every section backdrop is black with a few fine dark guide lines (drawn in CSS).
// The homepage hero gets one ambient light scene (assets/cinder-aurora.js) that moves on its own.
(function(){
  function mount(el,o){el.classList.add('lines');if(el.closest('#top'))el.classList.add('hero-bd');return{setVariant(){},destroy(){el.classList.remove('lines')}}}
  window.CinderField={mount};
  window.dispatchEvent(new Event('cinder-field'));
})();
