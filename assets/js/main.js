(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#primary-nav");

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const isOpen = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigation.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        navigation.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");
      }
    });
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const search = document.querySelector("#directory-query");
  const cards = Array.from(document.querySelectorAll(".directory-card"));
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const emptyState = document.querySelector("#empty-state");
  let activeFilter = "all";

  function filterDestinations() {
    if (!cards.length) return;
    const query = (search ? search.value : (new URLSearchParams(window.location.search).get("q") || "")).trim().toLowerCase();
    let visibleCount = 0;
    cards.forEach((card) => {
      const matchesText = !query || (card.dataset.search || "").toLowerCase().includes(query) ||
        card.textContent.toLowerCase().includes(query);
      const categories = (card.dataset.category || "").split(/\s+/);
      const matchesFilter = activeFilter === "all" || categories.includes(activeFilter);
      const visible = matchesText && matchesFilter;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  if (cards.length) {
    const params = new URLSearchParams(window.location.search);
    if (search && params.has("q")) search.value = params.get("q");
    search?.addEventListener("input", filterDestinations);
    filters.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "all";
        filters.forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        filterDestinations();
      });
    });
    filters.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === "all")));
    filterDestinations();
  }
})();