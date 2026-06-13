/* ============================================================
   EventSpace — Halls Gallery
   Premium cards with smooth animations
   ============================================================ */

(function () {
  "use strict";

  const grid = document.getElementById("hallsGrid");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  let halls = [];

  function hallCard(h) {
    const img =
      h.image_urls && h.image_urls[0]
        ? h.image_urls[0]
        : "/assets/images/placeholder.jpg";
    const feats = (h.features || []).slice(0, 4);
    const price = Number(h.price_per_hour || 0).toLocaleString();
    const cap = h.capacity || 0;

    return `
      <a href="/hall-calendar.html?hallSlug=${encodeURIComponent(
        h.slug
      )}" class="hall-card group block no-underline">
        <div class="hall-card-image">
          <img src="${img}" alt="${h.name}" loading="lazy" />
          <div class="hall-card-overlay"></div>
          <div class="absolute left-4 bottom-4 flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs text-white font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Available
            </span>
            <span class="inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs text-white font-medium">
              Cap. ${cap}
            </span>
          </div>
        </div>
        <div class="hall-card-body">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="text-lg font-bold text-gray-900 group-hover:text-[var(--accent)] transition-colors">${
                h.name
              }</h3>
              <p class="text-sm text-[var(--muted)] mt-1">From $${price}/hr</p>
            </div>
            <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-light)] text-[var(--accent)] font-semibold group-hover:bg-[var(--accent)] group-hover:text-white transition-all shrink-0">
              →
            </span>
          </div>
          ${
            feats.length
              ? `
            <div class="mt-4 flex flex-wrap gap-2">
              ${feats
                .map((f) => `<span class="hall-feature-tag">${f}</span>`)
                .join("")}
            </div>
          `
              : ""
          }
          <div class="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
            <span class="text-[var(--muted)]">View availability</span>
            <span class="text-[var(--accent)] font-semibold group-hover:translate-x-1 transition-transform">Check dates →</span>
          </div>
        </div>
      </a>
    `;
  }

  function render(list) {
    if (!grid) return;
    if (!list || !list.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-20">
          <div class="text-4xl mb-4" style="font-size:2rem;color:var(--es-maroon);">&#9670;</div>
          <div class="text-lg font-semibold text-gray-900">No halls found</div>
          <div class="text-sm text-[var(--muted)] mt-1">Try adjusting your search.</div>
        </div>
      `;
      return;
    }
    grid.innerHTML = list.map(hallCard).join("");
  }

  function applyFilter() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    if (!q) return render(halls);
    const filtered = halls.filter(
      (h) =>
        (h.name || "").toLowerCase().includes(q) ||
        (h.description || "").toLowerCase().includes(q) ||
        (h.features || []).some((f) => f.toLowerCase().includes(q))
    );
    render(filtered);
  }

  // Event listeners
  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", applyFilter);
  }

  // Load halls from API
  async function load() {
    try {
      const r = await fetch("/api/halls");
      const data = await r.json();
      halls = data.halls || [];
      render(halls);
    } catch {
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-20">
            <div class="text-4xl mb-4" style="font-size:2rem;color:var(--es-maroon);">&#9888;</div>
            <div class="text-lg font-semibold text-gray-900">Failed to load halls</div>
            <div class="text-sm text-[var(--muted)] mt-1">Please refresh the page to try again.</div>
          </div>
        `;
      }
    }
  }

  load();
})();
