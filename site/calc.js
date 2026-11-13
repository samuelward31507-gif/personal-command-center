// Missed-call cost calculator + one-job line.
// Lost revenue = missed calls × share that are new customers (owner sets, out of 10)
// × 45% who book when answered (Invoca 2026 home-services benchmark), plus form/Facebook leads that wait
// over an hour × 45% × 50% lost to a faster company (working assumption); then × close rate × job size.
// The page ships with the default results already filled in (40 missed calls, $6,000 job, 5 of 10 new, 10 slow form leads, 25% close),
// so it never shows $0, even before this script runs. Plain text updates, no animation.
// Pays-for-itself line: estimates = ceil(697 / (job value × close rate)).
(function () {
  var MONTHLY = 697, BOOK = 0.45, SLOW_LOST = 0.5;
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var per = function (n) { if (n < 0.05) return "none"; if (n < 0.75) return "about 1 every " + Math.max(2, Math.round(1 / n)) + " months"; return "about " + Math.round(n) + " a month"; };
  document.querySelectorAll("[data-calc]").forEach(function (el) {
    var f = el.querySelector("form");
    var set = function (k, v) { el.querySelectorAll('[data-o="' + k + '"]').forEach(function (n) { n.textContent = v; }); };
    function run() {
      var m = Number(f.missed.value), j = Number(f.job.value), c = Number(f.close.value) / 100, nw = f.new10 ? Number(f.new10.value) / 10 : 0.5;
      var fm = f.forms ? Number(f.forms.value) : 0;
      if (!(m >= 0) || !(fm >= 0) || (m + fm) <= 0 || !(j > 0) || !(c > 0) || c > 1) return;
      var bookedCalls = m * nw * BOOK, bookedForms = fm * BOOK * SLOW_LOST, booked = bookedCalls + bookedForms, jobs = booked * c, month = jobs * j;
      var r1 = function (n) { return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); };
      set("missed", String(m)); set("missed2", String(m)); set("job", usd(j)); set("close", Math.round(c * 100) + "%");
      set("new10", String(Math.round(nw * 10))); set("forms", String(fm)); set("bookedCalls", r1(bookedCalls)); set("bookedForms", r1(bookedForms));
      set("jobs", per(jobs)); set("month", usd(month)); set("year", usd(month * 12));
      var x = month / MONTHLY; set("multiple", x >= 10 ? Math.round(x) + "×" : (Math.round(x * 10) / 10) + "×");
      var n = Math.ceil(MONTHLY / (j * c));
      set("onejob", String(n)); set("onejobUnit", n === 1 ? "booked estimate" : "booked estimates");
      el.querySelectorAll("input[type=range]").forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
    }
    f.addEventListener("input", run); f.addEventListener("change", run); run();
  });
})();
