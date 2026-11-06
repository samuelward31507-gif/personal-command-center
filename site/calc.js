// Missed-call cost calculator + one-job line.
// Lost revenue = missed calls × 1 in 4 that would have become a booked estimate × close rate × job size.
// The 1-in-4 step is a working assumption.
// The page ships with the default results already filled in (20 missed calls, $6,000 job, 25% close),
// so it never shows $0, even before this script runs. Plain text updates, no animation.
// Pays-for-itself line: estimates = ceil(997 / (job value × close rate)).
(function () {
  var MONTHLY = 997, BOOK = 0.25;
  var usd = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var per = function (n) { if (n < 0.05) return "none"; if (n < 0.75) return "about 1 every " + Math.max(2, Math.round(1 / n)) + " months"; return "about " + Math.round(n) + " a month"; };
  document.querySelectorAll("[data-calc]").forEach(function (el) {
    var f = el.querySelector("form");
    var set = function (k, v) { el.querySelectorAll('[data-o="' + k + '"]').forEach(function (n) { n.textContent = v; }); };
    function run() {
      var m = Number(f.missed.value), j = Number(f.job.value), c = Number(f.close.value) / 100;
      if (!(m > 0) || !(j > 0) || !(c > 0) || c > 1) return;
      var booked = m * BOOK, jobs = booked * c, month = jobs * j;
      var r1 = function (n) { return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); };
      set("missed", String(m)); set("missed2", String(m)); set("job", usd(j)); set("close", Math.round(c * 100) + "%");
      set("booked", r1(booked));
      set("jobs", per(jobs)); set("month", usd(month)); set("year", usd(month * 12));
      var n = Math.ceil(MONTHLY / (j * c));
      set("onejob", String(n)); set("onejobUnit", n === 1 ? "booked estimate" : "booked estimates");
      el.querySelectorAll("input[type=range]").forEach(function (r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); });
    }
    f.addEventListener("input", run); f.addEventListener("change", run); run();
  });
})();
