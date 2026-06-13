(function () {
  const token = localStorage.getItem("eventspace_token");
  const logoutBtn = document.getElementById("logoutBtn");
  const tbody = document.getElementById("bookingTbody");
  const empty = document.getElementById("emptyState");
  const filter = document.getElementById("statusFilter");
  const refreshBtn = document.getElementById("refreshBtn");

  function setEmpty(show) {
    if (!empty) return;
    empty.classList.toggle("hidden", !show);
  }

  function formatDate(d) {
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function formatTime(d) {
    try {
      const dt = new Date(d);
      return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function getAuthHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadBookings() {
    if (!tbody) return;
    tbody.innerHTML = "";

    const status = filter?.value || "";
    const url = `/api/bookings/me${
      status ? `?status=${encodeURIComponent(status)}` : ""
    }`;

    const r = await fetch(url, { headers: getAuthHeaders() });
    const data = await r.json();
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-[var(--muted)]">${
        data.message || "Failed to load bookings"
      }</td></tr>`;
      return;
    }

    const bookings = data.bookings || [];
    setEmpty(bookings.length === 0);

    if (!bookings.length) return;

    tbody.innerHTML = bookings
      .map((b) => {
        const statusColor =
          b.status === "approved"
            ? "text-green-300"
            : b.status === "rejected"
            ? "text-red-300"
            : b.status === "cancelled"
            ? "text-yellow-200"
            : "text-[var(--text)]";

        const actionHtml =
          b.status === "pending"
            ? `<button class="btn btn-ghost text-xs px-3 py-2" data-cancel="${b.id}" type="button">Cancel</button>`
            : `<span class="text-xs text-[var(--muted)]">—</span>`;

        return `
          <tr>
            <td class="py-4">${b.event_name}</td>
            <td class="py-4">${b.hall_name || ""}</td>
            <td class="py-4">${formatDate(b.start_datetime)}</td>
            <td class="py-4">${formatTime(b.start_datetime)}–${formatTime(
          b.end_datetime
        )}</td>
            <td class="py-4">${b.guests_count ?? 0}</td>
            <td class="py-4"><span class="font-medium ${statusColor}">${
          b.status
        }</span></td>
            <td class="py-4">${actionHtml}</td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const bookingId = btn.getAttribute("data-cancel");
        if (!bookingId) return;
        const rr = await fetch(
          `/api/bookings/cancel/${encodeURIComponent(bookingId)}`,
          {
            method: "POST",
            headers: { ...getAuthHeaders() },
          }
        );
        const dd = await rr.json();
        if (!rr.ok) return alert(dd.message || "Cancel failed");
        loadBookings().catch(() => {});
      });
    });
  }

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("eventspace_token");
    localStorage.removeItem("eventspace_role");
    window.location.href = "/";
  });

  filter?.addEventListener("change", () => loadBookings().catch(() => {}));
  refreshBtn?.addEventListener("click", () => loadBookings().catch(() => {}));

  if (!token) {
    setEmpty(false);
    tbody.innerHTML =
      '<tr><td colspan="7" class="py-4 text-[var(--muted)]">Login to view your bookings.</td></tr>';
    return;
  }

  loadBookings().catch(() => {
    tbody.innerHTML =
      '<tr><td colspan="7" class="py-4 text-[var(--muted)]">Failed to load bookings.</td></tr>';
  });
})();
