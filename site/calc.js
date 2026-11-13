// Missed-call cost calculator. Two inputs from the owner's own shop, one number out.
// Lost per month = calls missed a week × 4.33 × 50% new customers × 45% who book when answered
// (Invoca 2026 home-services benchmark) × a typical 30% close rate × average job.
// The page ships with the default result already filled in (6 a week, $6,000), so it never shows $0
// before this script runs.
(function () {
  var WEEKS = 4.33, NEW = 0.5, BOOK = 0.45, CLOSE = 0.3;
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var jobsText = function (n) { if (n < 0.75) return "about 1 job every " + Math.max(2, Math.round(1 / Math.max(n, 0.01))) + " months"; var r = Math.round(n); return "about " + r + (r === 1 ? " job" : " jobs"); };
  document.querySelectorAll("[data-calc]").forEach(function (el) {
    var f = el.querySelector("form");
    var set = function (k, v) { el.querySelectorAll('[data-o="' + k + '"]').forEach(function (n) { n.textContent = v; }); };
    function run() {
      var w = Number(f.missed.value), j = Number(f.job.value);
      if (!(w > 0) || !(j > 0)) return;
      var jobs = w * WEEKS * NEW * BOOK * CLOSE, month = jobs * j;
      set("missed", String(w)); set("job", usd(j));
      set("month", usd(month)); set("jobs", jobsText(jobs));
      el.querySelectorAll("input[type=range]").forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
    }
    f.addEventListener("input", run); f.addEventListener("change", run); run();
  });
})();
