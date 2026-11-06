// One-job calculator: how many booked estimates a month cover the $997 monthly.
// estimates = ceil(997 / (job value × close rate)). Plain text, no animation.
(function () {
  var MONTHLY = 997;
  document.querySelectorAll("[data-onejob]").forEach(function (el) {
    var job = el.querySelector('input[name="job"]'), close = el.querySelector('input[name="close"]');
    var out = el.querySelector("[data-onejob-out]"), unit = el.querySelector("[data-onejob-unit]");
    function run() {
      var j = Number(job.value), c = Number(close.value) / 100;
      if (!(j > 0) || !(c > 0) || c > 1) { out.textContent = "—"; unit.textContent = "booked estimates"; return; }
      var n = Math.ceil(MONTHLY / (j * c));
      out.textContent = String(n);
      unit.textContent = n === 1 ? "booked estimate" : "booked estimates";
    }
    job.addEventListener("input", run); close.addEventListener("input", run); run();
  });
})();
