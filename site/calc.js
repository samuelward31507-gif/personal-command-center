// Missed-call cost calculator. Three inputs from the owner's own shop.
// Lost per month = calls missed a week × 4.33 × 50% new customers × 45% who book when answered
// (Invoca 2026 home-services benchmark) × close rate × average job.
// The page ships with the default result already filled in (6 a week, $6,000, 30%), so it never shows $0
// before this script runs. Cover line: one saved job ÷ the Never Miss a Lead monthly.
(function () {
  var MONTHLY = 697, WEEKS = 4.33, NEW = 0.5, BOOK = 0.45;
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var about = function (n) { if (n < 0.75) return "about 1 every " + Math.max(2, Math.round(1 / Math.max(n, 0.01))) + " months"; return "about " + Math.round(n); };
  document.querySelectorAll("[data-calc]").forEach(function (el) {
    var f = el.querySelector("form");
    var set = function (k, v) { el.querySelectorAll('[data-o="' + k + '"]').forEach(function (n) { n.textContent = v; }); };
    function run() {
      var w = Number(f.missed.value), j = Number(f.job.value), c = Number(f.close.value) / 100;
      if (!(w > 0) || !(j > 0) || !(c > 0) || c > 1) return;
      var calls = w * WEEKS, est = calls * NEW * BOOK, jobs = est * c, month = jobs * j, cover = Math.floor(j / MONTHLY);
      set("missed", String(w)); set("job", usd(j)); set("job2", usd(j)); set("close", Math.round(c * 100) + "%");
      set("mcalls", String(Math.round(calls))); set("est", about(est)); set("jobs", about(jobs));
      set("month", usd(month)); set("year", usd(month * 12));
      set("cover", cover >= 2 ? cover + " times" : cover === 1 ? "on its own" : "most of the way");
      el.querySelectorAll("input[type=range]").forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
    }
    f.addEventListener("input", run); f.addEventListener("change", run); run();
  });
})();
