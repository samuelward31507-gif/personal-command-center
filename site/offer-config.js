// Founding offer settings. Edit this number by hand when a founding client signs.
// Founding offer = half-price setup for the first 3 clients. Shown under the plans as "Spots left: N". There is no automatic countdown.
window.CINDER_OFFER = { spotsLeft: 3 };
(function () {
  var n = Math.max(0, Math.floor(Number(window.CINDER_OFFER.spotsLeft) || 0));
  var apply = function () {
    document.querySelectorAll("[data-spots]").forEach(function (el) { el.textContent = String(n); });
    if (n === 0) document.querySelectorAll("[data-spots-label]").forEach(function (el) { el.textContent = "Founding spots are full"; });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
