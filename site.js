(function () {
  var KEY = "osg-theme";
  var SITE_HOSTS = [
    "opensolanahub.com",
    "www.opensolanahub.com",
    "open-solana-hub.vercel.app",
  ];

  function isHubThemePage() {
    var btn = document.getElementById("theme-toggle");
    return !!(btn && btn.classList.contains("theme-btn"));
  }

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
    if (!isHubThemePage()) return;
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = t === "dark" ? "☀" : "☾";
  }

  function initTheme() {
    if (!isHubThemePage()) return;
    var t = "dark";
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") t = saved;
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) t = "light";
    } catch (e) {}
    applyTheme(t);
  }

  function isInsideDashboard() {
    try {
      return /\/compare(\/|$)/i.test(window.location.pathname.toLowerCase());
    } catch (e) {
      return false;
    }
  }

  function isDashboardLink(href) {
    if (!href || href === "#") return false;
    if (/compare-validators\.html/i.test(href)) return false;
    if (/^\.\.?\/compare(\/|\.|$|\?|#)/i.test(href) || /^\/compare(\/|\.|$|\?|#)/i.test(href)) {
      return true;
    }
    try {
      var pathname = new URL(href, window.location.href).pathname.toLowerCase();
      if (/\/compare-validators\.html$/i.test(pathname)) return false;
      return /\/compare(\/|$)/i.test(pathname);
    } catch (e) {
      return false;
    }
  }

  function isInternalLink(href) {
    if (!href || href === "#" || href.charAt(0) === "#") return true;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return true;
    if (href.indexOf("//") === 0) return false;
    if (!/^https?:/i.test(href)) return true;

    try {
      var host = new URL(href, window.location.href).hostname.toLowerCase();
      if (host === window.location.hostname.toLowerCase()) return true;
      return SITE_HOSTS.indexOf(host) !== -1;
    } catch (e) {
      return true;
    }
  }

  function setExternalRel(link) {
    var rel = (link.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
    if (rel.indexOf("noopener") === -1) rel.push("noopener");
    if (rel.indexOf("noreferrer") === -1) rel.push("noreferrer");
    link.setAttribute("rel", rel.join(" "));
  }

  function applyLinkTarget(link) {
    if (!link || link.dataset.newTab === "off") return;
    var href = (link.getAttribute("href") || "").trim();
    if (!href || href === "#") return;
    if (link.hasAttribute("download")) return;

    if (isDashboardLink(href)) {
      if (isInsideDashboard()) {
        if (link.getAttribute("target") === "_blank") link.removeAttribute("target");
        return;
      }
      link.setAttribute("target", "_blank");
      setExternalRel(link);
      return;
    }

    if (isInternalLink(href)) {
      if (link.getAttribute("target") === "_blank") link.removeAttribute("target");
      return;
    }

    link.setAttribute("target", "_blank");
    setExternalRel(link);
  }

  function initLinkTargets() {
    document.querySelectorAll("a[href]").forEach(applyLinkTarget);

    if (!window.MutationObserver || !document.body) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes" && mutation.target.matches) {
          if (mutation.target.matches("a[href]")) applyLinkTarget(mutation.target);
          return;
        }
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("a[href]")) applyLinkTarget(node);
          if (node.querySelectorAll) {
            node.querySelectorAll("a[href]").forEach(applyLinkTarget);
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

  document.addEventListener(
    "click",
    function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var link = e.target.closest("a[href]");
      if (!link || link.dataset.newTab === "off") return;

      var href = (link.getAttribute("href") || "").trim();
      if (!href || href === "#" || href.charAt(0) === "#") return;
      if (link.hasAttribute("download")) return;

      if (isDashboardLink(href)) {
        if (isInsideDashboard()) {
          if (link.getAttribute("target") === "_blank") {
            e.preventDefault();
            window.location.assign(link.href);
          }
          return;
        }
        if (link.getAttribute("target") !== "_blank") {
          e.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        }
        return;
      }

      if (isInternalLink(href)) {
        if (link.getAttribute("target") === "_blank") {
          e.preventDefault();
          window.location.assign(link.href);
        }
        return;
      }

      if (link.getAttribute("target") !== "_blank") {
        e.preventDefault();
        window.open(link.href, "_blank", "noopener,noreferrer");
      }
    },
    true
  );

  document.addEventListener("DOMContentLoaded", function () {
    if (isHubThemePage()) {
      initTheme();
      var btn = document.getElementById("theme-toggle");
      if (btn) {
        btn.addEventListener("click", function () {
          var cur = document.documentElement.getAttribute("data-theme") || "dark";
          applyTheme(cur === "dark" ? "light" : "dark");
        });
      }
    }
    initLinkTargets();
  });
})();
