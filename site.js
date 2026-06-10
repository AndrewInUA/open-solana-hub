(function () {
  var KEY = "osg-theme";

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = t === "dark" ? "☀" : "☾";
  }

  function initTheme() {
    var t = "dark";
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") t = saved;
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) t = "light";
    } catch (e) {}
    applyTheme(t);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(cur === "dark" ? "light" : "dark");
      });
    }
  });
})();
