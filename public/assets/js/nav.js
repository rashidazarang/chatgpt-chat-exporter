(function () {
  if (typeof document === "undefined") return;
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;

  const setExpanded = (isOpen) => {
    menu.classList.toggle("is-open", isOpen);
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.contains("is-open");
    setExpanded(!isOpen);
  });

  menu.querySelectorAll("a").forEach((link) => {
    const normalize = (path) => path.replace(/\/$/, "");
    if (normalize(link.pathname) === normalize(window.location.pathname)) {
      link.classList.add("is-active");
    }

    link.addEventListener("click", () => {
      if (window.innerWidth < 768) {
        setExpanded(false);
      }
    });
  });
})();
