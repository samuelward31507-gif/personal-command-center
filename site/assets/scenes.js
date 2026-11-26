// Scroll scenes: any [data-scene] section drives a Cinder visual from its own scroll position.
// data-scene = global component name (CinderUnit, CinderSlab, ...). data-active = part to highlight.
// Components that expose setStep get the index of the step in view; others get setProgress(0..1).
// [data-backdrop] sections get the red field (window.CinderField) once it exists.
(function () {
  var scenes = [].slice.call(document.querySelectorAll('[data-scene]')).map(function (sec) {
    return { sec: sec, name: sec.dataset.scene, host: sec.querySelector('.sx-host'), steps: [].slice.call(sec.querySelectorAll('.sx-step')), active: sec.dataset.active, api: null, last: -1 };
  });
  function attach() {
    scenes.forEach(function (s) {
      var api = window[s.name];
      if (s.api || !api || !s.host) return;
      s.api = api; s.sec.classList.add('is-live');
      if (api.setStep) api.setStep(0);
      api.mount(s.host);
      if (s.active != null && api.setActive) api.setActive(+s.active);
      tick();
    });
    var F = window.CinderField;
    if (F) [].slice.call(document.querySelectorAll('[data-backdrop] .backdrop:not(.on)')).forEach(function (el) { el.classList.add('on'); F.mount(el); });
  }
  ['cinder-unit', 'cinder-slab', 'cinder-field', 'cinder-visual'].forEach(function (e) { addEventListener(e, attach); });
  var ticking = false;
  function tick() {
    ticking = false;
    var vh = innerHeight;
    scenes.forEach(function (s) {
      if (!s.api) return;
      var r = s.sec.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) return;
      if (s.api.setStep) {
        var best = 0, bd = 1e9;
        s.steps.forEach(function (el, i) { var b = el.getBoundingClientRect(), c = Math.abs(b.top + b.height / 2 - vh / 2); if (c < bd) { bd = c; best = i; } });
        if (best !== s.last) { s.last = best; s.api.setStep(best); s.steps.forEach(function (el, i) { el.classList.toggle('on', i === best); }); }
      } else {
        var p = Math.min(1, Math.max(0, (vh * .5 - r.top) / Math.max(1, r.height - vh * .5)));
        if (Math.abs(p - s.last) > .0005) { s.last = p; s.api.setProgress(p); }
        var k = Math.min(s.steps.length - 1, Math.floor(p * s.steps.length));
        s.steps.forEach(function (el, i) { el.classList.toggle('on', i === k); });
      }
    });
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener('resize', tick);
  attach(); tick();
})();
