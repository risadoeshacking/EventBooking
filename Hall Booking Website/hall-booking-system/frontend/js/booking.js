// Booking page logic (hall-details.html)
(function () {
  const qs = new URLSearchParams(window.location.search);
  const prefill = qs.get("bookingPrefill");

  const hallTitleEl = document.getElementById("hallTitle");
  const hallMetaEl = document.getElementById("hallMeta");
  const hallDescEl = document.getElementById("hallDesc");
  const hallHeroImg = document.getElementById("hallHero");
  const hallCapacityEl = document.getElementById("hallCapacity");
  const hallPriceEl = document.getElementById("hallPrice");
  const hallFeaturesEl = document.getElementById("hallFeatures");

  const hallIdInput = document.getElementById("hallId");

  const bookingForm = document.getElementById("bookingForm");
  const availabilityMsg = document.getElementById("availabilityMsg");

  const eventName = document.getElementById("eventName");
  const guestsCount = document.getElementById("guestsCount");
  const dateInput = document.getElementById("date");
  const specialRequirements = document.getElementById("specialRequirements");
  const startTime = document.getElementById("startTime");
  const endTime = document.getElementById("endTime");
  const fullName = document.getElementById("fullName");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");

  const submitBookingBtn = document.getElementById("submitBooking");
  const submitBookingText = document.getElementById("submitBookingText");
  const submitBookingSpinner = document.getElementById("submitBookingSpinner");

  const reviewBox = document.getElementById("reviewBox");
  const reviewText = document.getElementById("reviewText");

  const stepperSteps = Array.from(
    document.querySelectorAll(".premium-stepper .step")
  );

  function setMsg(text, type = "info") {
    if (!availabilityMsg) return;
    const cls =
      type === "error"
        ? "text-red-300"
        : type === "success"
        ? "text-green-300"
        : "text-[var(--muted)]";
    availabilityMsg.className = `text-sm mt-3 ${cls}`;
    availabilityMsg.textContent = text;
  }

  function getToken() {
    return localStorage.getItem("eventspace_token");
  }

  function setLoading(isLoading) {
    if (!submitBookingBtn) return;
    submitBookingBtn.disabled = !!isLoading;
    if (submitBookingText) {
      submitBookingText.textContent = isLoading ? "Booking..." : "Book Now";
    }
    if (submitBookingSpinner) {
      if (isLoading) submitBookingSpinner.classList.remove("hidden");
      else submitBookingSpinner.classList.add("hidden");
    }
  }

  function formatDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return "—";
    const d = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function computeStep() {
    // Step rules:
    // 1: date
    // 2: start/end valid
    // 3: required fields filled (eventName, guests, fullName/email/phone)
    // 4: submit handled implicitly
    const hallId = hallIdInput?.value;
    const date = dateInput?.value;
    const sTime = startTime?.value;
    const eTime = endTime?.value;

    const dateOk = !!hallId && !!date;

    const startOk = !!sTime;
    const endOk = !!eTime;

    const detailsOk =
      !!eventName?.value?.trim() &&
      !!guestsCount?.value &&
      !!fullName?.value?.trim() &&
      !!email?.value?.trim() &&
      !!phone?.value?.trim();

    if (dateOk) {
      if (startOk && endOk) {
        if (detailsOk) return 3;
        return 2;
      }
      return 1;
    }
    return 0;
  }

  function updateStepper() {
    const step = computeStep();
    stepperSteps.forEach((el) => {
      const n = Number(el.getAttribute("data-step"));
      el.classList.toggle("is-active", n === step + 1); // step+1 since step is 0-3
      el.classList.toggle("is-done", n <= step);
    });

    const date = dateInput?.value;
    const s = startTime?.value;
    const e = endTime?.value;
    const hasCore = !!hallIdInput?.value && !!date && !!s && !!e;
    if (hasCore) {
      reviewBox?.classList.remove("hidden");
      reviewText.textContent = `${
        hallTitleEl?.textContent || "Hall"
      } • ${formatDateTime(date, s)} → ${new Date(
        `${date}T${e}:00`
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      reviewBox?.classList.add("hidden");
    }
  }

  function applyPrefill() {
    if (!prefill) return;

    const hallId = qs.get("hallId");
    const date = qs.get("date");
    const start = qs.get("startTime");
    const end = qs.get("endTime");

    if (hallId) hallIdInput.value = hallId;
    if (date) dateInput.value = date;
    if (start) startTime.value = start;
    if (end) endTime.value = end;
  }

  async function loadHall() {
    // Primary: query param `slug`
    const slugQ = qs.get("slug") || qs.get("hall");
    if (!slugQ) {
      // Fallback: hallId prefill
      const hallId = qs.get("hallId");
      if (hallId) {
        hallIdInput.value = hallId;
        setMsg("Hall loaded by ID. Detailed info may be limited.", "info");
        return null;
      }
      setMsg("Missing hall identifier.", "error");
      return null;
    }

    const r = await fetch(`/api/halls/${encodeURIComponent(slugQ)}`);
    if (!r.ok) throw new Error("Failed to load hall");
    const data = await r.json();
    const h = data.hall;

    hallIdInput.value = h.id;

    hallTitleEl.textContent = h.name;
    hallMetaEl.textContent = `Capacity up to ${h.capacity} • Premium venue`;
    hallDescEl.textContent = h.description || "";
    hallCapacityEl.textContent = h.capacity;
    hallPriceEl.textContent = `$${Number(
      h.price_per_hour
    ).toLocaleString()}/hr`;

    const imgs = h.image_urls || [];
    hallHeroImg.src = imgs[0] || "/assets/images/placeholder.jpg";

    hallFeaturesEl.innerHTML = (h.features || [])
      .map(
        (f) =>
          `<span class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">${f}</span>`
      )
      .join("");

    return h;
  }

  async function checkAvailability() {
    const hallId = hallIdInput.value;
    const startDate = dateInput.value;
    const sTime = startTime.value;
    const eTime = endTime.value;

    if (!hallId || !startDate || !sTime || !eTime) return null;

    const start = new Date(`${startDate}T${sTime}:00`);
    const end = new Date(`${startDate}T${eTime}:00`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setMsg("End time must be after start time.", "error");
      return { available: false, invalid: true };
    }

    const payload = {
      hallId,
      startDatetime: start.toISOString(),
      endDatetime: end.toISOString(),
    };

    const r = await fetch("/api/halls/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      setMsg(data.message || "Availability check failed", "error");
      return { available: false };
    }

    if (!data.available) {
      const first = data.conflicts?.[0];
      const conflictMsg = first
        ? `Conflicts found (${new Date(
            first.start_datetime
          ).toLocaleString()} → ${new Date(
            first.end_datetime
          ).toLocaleString()}). Please choose another time.`
        : "Selected time conflicts with an existing booking. Please choose another slot.";

      setMsg(conflictMsg, "error");
      return { available: false, conflicts: data.conflicts };
    }

    setMsg("Time is available. Submit your booking request.", "success");
    return { available: true };
  }

  function applyQuickDuration(mins) {
    const s = startTime.value;
    if (!s) return;
    const [hh, mm] = s.split(":").map((x) => Number(x));
    const startMinutes = hh * 60 + mm;
    const endMinutes = startMinutes + mins;

    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;

    const pad = (n) => String(n).padStart(2, "0");
    endTime.value = `${pad(endHour)}:${pad(endMin)}`;
  }

  // Handle auth prefill for logged-in user (if backend supports /api/auth/me profile fields)
  async function tryPrefillUser() {
    const token = getToken();
    if (!token) return;

    const r = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;

    const d = await r.json();
    // Best-effort: only fill if present in response.
    if (d?.full_name) fullName.value = d.full_name;
    if (d?.email) email.value = d.email;
    if (d?.phone) phone.value = d.phone;
  }

  // Booking submit
  bookingForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const hallId = hallIdInput.value;
    if (!hallId) return setMsg("Please choose a hall.", "error");

    const date = dateInput.value;
    const sTime = startTime.value;
    const eTime = endTime.value;
    if (!date || !sTime || !eTime)
      return setMsg("Please select a valid date and time.", "error");

    // Quick front-end validation
    const start = new Date(`${date}T${sTime}:00`);
    const end = new Date(`${date}T${eTime}:00`);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return setMsg(
        "Invalid time range. End time must be after start time.",
        "error"
      );
    }

    setLoading(true);
    try {
      const avail = await checkAvailability();
      if (!avail?.available) return;

      const payload = {
        hallId,
        eventName: eventName.value.trim(),
        startDatetime: start.toISOString(),
        endDatetime: end.toISOString(),
        guestsCount: Number(guestsCount.value),
        specialRequirements: specialRequirements.value || "",
        fullName: fullName.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim(),
      };

      const token = getToken();
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          const first = data?.conflicts?.[0];
          return setMsg(
            first
              ? `Booking conflict: ${new Date(
                  first.start_datetime
                ).toLocaleString()} → ${new Date(
                  first.end_datetime
                ).toLocaleString()}.`
              : "Date/time is not available.",
            "error"
          );
        }
        return setMsg(data.message || "Booking failed", "error");
      }

      setMsg(
        "Booking submitted! Status: pending (admin approval required).",
        "success"
      );
      bookingForm.reset();
      reviewBox?.classList.add("hidden");
      updateStepper();
    } finally {
      setLoading(false);
    }
  });

  // Trigger availability checks on changes
  [
    dateInput,
    startTime,
    endTime,
    eventName,
    guestsCount,
    fullName,
    email,
    phone,
  ].forEach((el) => {
    el?.addEventListener("change", async () => {
      updateStepper();
      // Only run availability when core time inputs are filled.
      if (el === dateInput || el === startTime || el === endTime) {
        checkAvailability().catch(() => {});
      }
    });
    el?.addEventListener("input", () => {
      updateStepper();
    });
  });

  // Quick durations buttons
  document.querySelectorAll(".duration-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = Number(btn.getAttribute("data-min"));
      if (!mins) return;
      applyQuickDuration(mins);
      updateStepper();
      checkAvailability().catch(() => {});
    });
  });

  // Login hint
  const loginHintBtn = document.getElementById("loginHint");
  if (loginHintBtn) {
    loginHintBtn.addEventListener("click", () => {
      // If user wants to continue booking, remember where to go after login
      localStorage.setItem(
        "eventspace_redirect_after_login",
        window.location.href
      );
      window.location.href = "/login.html";
    });
  }

  applyPrefill();

  loadHall()
    ?.then(async (h) => {
      await tryPrefillUser();
      if (h?.id) {
        // init calendar with booking.js (FullCalendar init lives in this same file originally)
      }
    })
    .catch((err) => setMsg(err?.message || "Could not load hall", "error"));

  // Calendar init (big calendar + date-click → booking flow)
  let calendar;
  async function initCalendar(hallId) {
    const el = document.getElementById("calendar");
    if (!el) return;

    // FullCalendar might be loaded globally via CDN
    if (!window.FullCalendar) {
      setMsg("Calendar library not loaded. Please refresh.", "error");
      return;
    }

    const bookedDatesResp = await fetch(
      `/api/halls/${encodeURIComponent(hallId)}/booked-dates`
    );
    let bookedDates = [];
    try {
      if (bookedDatesResp.ok) {
        const d = await bookedDatesResp.json();
        bookedDates = d.bookedDates || [];
      }
    } catch {}

    const events = bookedDates.map((dateStr) => ({
      start: dateStr,
      end: dateStr,
      display: "background",
      backgroundColor: "rgba(239,68,68,0.25)",
      borderColor: "rgba(239,68,68,0.0)",
    }));

    calendar = new FullCalendar.Calendar(el, {
      initialView: "dayGridMonth",
      height: "auto",
      aspectRatio: 1.25,
      selectable: true,
      headerToolbar: {
        left: "prev,next",
        center: "title",
        right: "dayGridMonth",
      },
      events,
      dateClick: function (info) {
        const dateISO = info.date.toISOString().slice(0, 10);
        if (bookedDates.includes(dateISO)) {
          setMsg(
            "That date is already booked. Please select an available date.",
            "error"
          );
          return;
        }
        dateInput.value = dateISO;
        setMsg("Date selected. Next: choose start and end times.", "info");
        updateStepper();
        // UX: move user to Time step fields
        startTime?.focus?.();
        startTime?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        checkAvailability().catch(() => {});
      },
      windowResize: function () {
        calendar?.render();
      },
    });

    calendar.render();

    // If prefilled date exists, update stepper
    updateStepper();
  }

  // Try init calendar once hallId is loaded
  (async () => {
    // If hallId already present via prefill, init immediately.
    const hallId = hallIdInput.value || qs.get("hallId");
    if (hallId) {
      try {
        await initCalendar(hallId);
      } catch {
        // ignore
      }
    } else {
      // Wait until hall loads to get hallId
      const interval = setInterval(() => {
        const id = hallIdInput.value;
        if (id) {
          clearInterval(interval);
          initCalendar(id).catch(() => {});
        }
      }, 150);
    }
  })();

  updateStepper();
})();
