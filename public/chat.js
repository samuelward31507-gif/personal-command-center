/* Cinder chat bubble for a client's website.
   <script src="https://personal-command-center-ten-ruby.vercel.app/chat.js" data-key="CLIENT_KEY" async></script>
   The visitor leaves a name, cell and question; the reply comes by text within seconds. */
(function () {
  var s = document.currentScript || document.querySelector('script[data-key][src*="chat.js"]');
  if (!s) return;
  var key = s.getAttribute("data-key"), api = s.src.replace(/\/chat\.js.*$/, "") + "/api/client-chat";
  var color = s.getAttribute("data-color") || "#121417";
  var css = ".cx-b{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:13px 18px;border-radius:999px;border:0;background:" + color + ";color:#fff;font:600 15px/1 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);cursor:pointer}" +
    ".cx-p{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:min(340px,calc(100vw - 40px));background:#fff;color:#121417;border-radius:16px;box-shadow:0 24px 60px -20px rgba(0,0,0,.45);font:15px/1.45 system-ui,-apple-system,sans-serif;overflow:hidden}" +
    ".cx-h{padding:16px 18px;background:" + color + ";color:#fff}.cx-h b{display:block;font-size:16px}.cx-h span{font-size:13px;opacity:.8}" +
    ".cx-f{padding:16px 18px;display:flex;flex-direction:column;gap:10px}.cx-f input,.cx-f textarea{font:inherit;padding:10px 12px;border:1px solid #d6d6d2;border-radius:10px;width:100%;box-sizing:border-box;color:#121417;background:#fff}" +
    ".cx-f button{padding:12px;border:0;border-radius:10px;background:" + color + ";color:#fff;font:600 15px system-ui,-apple-system,sans-serif;cursor:pointer}.cx-f small{color:#6b7078;font-size:12px}.cx-e{color:#c0392b;font-size:13px}.cx-hp{position:absolute;left:-9999px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var btn = document.createElement("button"); btn.className = "cx-b"; btn.type = "button"; btn.textContent = "Text us"; btn.setAttribute("aria-expanded", "false");
  var panel = null, biz = "us";
  fetch(api + "?key=" + encodeURIComponent(key)).then(function (r) { return r.json(); }).then(function (d) { if (d && d.business) biz = d.business; if (d && d.live === false) btn.style.display = "none"; }).catch(function () {});
  function open() {
    if (panel) { panel.remove(); panel = null; btn.setAttribute("aria-expanded", "false"); return; }
    panel = document.createElement("div"); panel.className = "cx-p"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Text " + biz);
    panel.innerHTML = '<div class="cx-h"><b></b><span>We usually reply in under a minute, by text.</span></div><form class="cx-f"><input name="name" placeholder="Your name" autocomplete="name"><input name="phone" placeholder="Cell number" inputmode="tel" autocomplete="tel" required><textarea name="message" rows="3" placeholder="What can we help with?" required></textarea><input class="cx-hp" name="website" tabindex="-1" autocomplete="off"><button type="submit">Send</button><small>By sending, you agree to get texts from us about your request. Reply STOP to opt out.</small><p class="cx-e" role="alert"></p></form>';
    panel.querySelector("b").textContent = "Text " + biz;
    var f = panel.querySelector("form");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = f.querySelector("button"), err = f.querySelector(".cx-e"); b.disabled = true; b.textContent = "Sending…"; err.textContent = "";
      fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: key, name: f.name.value, phone: f.phone.value, message: f.message.value, website: f.website.value }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) { err.textContent = x.d.error || "That didn't send. Try again."; b.disabled = false; b.textContent = "Send"; return; }
          f.innerHTML = "<p><b>Thanks! Check your texts.</b></p><p>We just texted you at " + (x.d.to || "your number") + ". Reply there and we'll take it from here.</p>";
        })
        .catch(function () { err.textContent = "That didn't send. Try again."; b.disabled = false; b.textContent = "Send"; });
    });
    document.body.appendChild(panel); btn.setAttribute("aria-expanded", "true");
    f.querySelector("input").focus();
  }
  btn.addEventListener("click", open);
  (document.body ? Promise.resolve() : new Promise(function (r) { addEventListener("DOMContentLoaded", r); })).then(function () { document.body.appendChild(btn); });
})();
