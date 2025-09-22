(function () {
  if (typeof document === "undefined") return;
  const current = window.location.pathname.replace(/\/$/, "");
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const target = link.getAttribute('href');
    if (!target) return;
    const normalized = target.replace(/\/$/, "");
    if (normalized && current.endsWith(normalized)) {
      link.classList.add('active');
    }
  });
})();
