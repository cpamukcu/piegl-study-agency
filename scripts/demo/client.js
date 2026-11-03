// Injected into every page of the static demo. GitHub Pages cannot run the app's server, so:
// links become plain page loads of the saved pages, and forms that would save something show a note instead.
(function () {
  var BASE = window.__DEMO__.base;
  var PAGES = window.__DEMO__.pages; // app URL ("/path?sorted=query") -> saved page URL
  var FILES = window.__DEMO__.files; // "/materials/<id>/file" -> saved file URL

  function toast(msg) {
    var t = document.getElementById("demo-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "demo-toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () {
      t.classList.remove("show");
    }, 2800);
  }

  // The app-relative key for a URL: path without the base or trailing slash, plus its query sorted.
  function keyOf(u) {
    var path = u.pathname.indexOf(BASE) === 0 ? u.pathname.slice(BASE.length) : u.pathname;
    path = path.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/today";
    var params = [];
    u.searchParams.forEach(function (v, k) {
      params.push([k, v]);
    });
    params.sort(function (a, b) {
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });
    var q = params
      .map(function (p) {
        return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]);
      })
      .join("&");
    return { path: path, key: q ? path + "?" + q : path };
  }

  function target(u) {
    var k = keyOf(u);
    var file = /^\/materials\/[^/]+\/file$/.test(k.path) ? FILES[k.path] : null;
    if (file) return file + u.hash;
    if (PAGES[k.key]) return PAGES[k.key] + u.hash;
    if (PAGES[k.path]) return PAGES[k.path] + u.hash;
    return null;
  }

  document.addEventListener(
    "click",
    function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var u = new URL(a.getAttribute("href"), location.href);
      if (u.origin !== location.origin) return;
      var here = new URL(location.href);
      if (u.hash && u.pathname.replace(/\/$/, "") === here.pathname.replace(/\/$/, "") && u.search === here.search) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var to = target(u);
      if (to) {
        if (a.target === "_blank") window.open(to, "_blank", "noopener");
        else location.href = to;
      } else toast("That page is not part of the demo.");
    },
    true,
  );

  document.addEventListener(
    "submit",
    function (e) {
      var f = e.target;
      var method = (f.getAttribute("method") || "").toLowerCase();
      if (method === "dialog") return;
      // The Focus dial keeps its state in this browser, so it works in the demo.
      if (f.closest("#focus-for-now") && !f.querySelector('input[name="id"]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (method === "get") {
        var u = new URL(f.getAttribute("action") || location.href, location.href);
        new FormData(f).forEach(function (v, k) {
          if (typeof v === "string") u.searchParams.append(k, v);
        });
        // Choosing files: the demo saved the preview with every file of the course ticked.
        var all = f.querySelector('input[name="m"]') && PAGES["/prepare?course=" + encodeURIComponent(u.searchParams.get("course") || "") + "&all=1"];
        var to = all || target(u);
        if (to) {
          location.href = to;
          return;
        }
      }
      toast("This is a read-only demo with fake data, so nothing is saved or sent. The Focus dial works fully.");
    },
    true,
  );
})();
