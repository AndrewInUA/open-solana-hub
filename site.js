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

  function markLinkNewTab(link) {
    if (!link || link.dataset.newTab === "off") return;
    var href = (link.getAttribute("href") || "").trim();
    if (!href || href === "#") return;
    if (link.hasAttribute("download")) return;

    link.setAttribute("target", "_blank");

    var rel = (link.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
    if (rel.indexOf("noopener") === -1) rel.push("noopener");
    if (rel.indexOf("noreferrer") === -1) rel.push("noreferrer");
    link.setAttribute("rel", rel.join(" "));
  }

  function initLinksInNewTab() {
    document.querySelectorAll("a[href]").forEach(markLinkNewTab);

    if (!window.MutationObserver || !document.body) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes" && mutation.target.matches) {
          if (mutation.target.matches("a[href]")) markLinkNewTab(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("a[href]")) markLinkNewTab(node);
          if (node.querySelectorAll) {
            node.querySelectorAll("a[href]").forEach(markLinkNewTab);
          }
        });
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initLinksInNewTab();

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(cur === "dark" ? "light" : "dark");
      });
    }
  });
})();
