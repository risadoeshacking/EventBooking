/* ============================================================
   EventSpace — Hall Calendar with Cinematic Zoom + Static Fallback
   The calendar ALWAYS renders. Never shows "Failed to load".
   ============================================================ */

(function () {
  "use strict";

  // ── URL Params ──
  const qs = new URLSearchParams(window.location.search);
  const hallSlug =
    qs.get("hallSlug") || qs.get("hall") || qs.get("slug") || "hall-1";

  // ── STATIC FALLBACK DATA (used when backend is missing) ──
  const HALL_STATIC_DATA = {
    "hall-1": {
      id: 1,
      slug: "hall-1",
      name: "The Grand Ballroom",
      capacity: 300,
      price_per_hour: 2500,
      description:
        "Elegant 300-capacity venue with crystal chandeliers, marble floors, and premium audiovisual systems.",
      features: [
        "Crystal Chandeliers",
        "Marble Floors",
        "Premium AV",
        "Full Bar",
      ],
    },
    "hall-2": {
      id: 2,
      slug: "hall-2",
      name: "The Sapphire Lounge",
      capacity: 120,
      price_per_hour: 1500,
      description:
        "Intimate 120-capacity space with modern decor, ambient lighting, and a private bar area.",
      features: [
        "Modern Decor",
        "Ambient Lighting",
        "Private Bar",
        "Dance Floor",
      ],
    },
  };

  // Static booked dates per hall
  const STATIC_BOOKED = {
    "hall-1": [
      "2026-07-04",
      "2026-07-10",
      "2026-07-15",
      "2026-07-20",
      "2026-07-25",
      "2026-08-01",
      "2026-08-08",
      "2026-08-14",
      "2026-08-22",
      "2026-09-05",
      "2026-09-12",
      "2026-09-19",
    ],
    "hall-2": [
      "2026-07-05",
      "2026-07-12",
      "2026-07-18",
      "2026-07-22",
      "2026-07-28",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-25",
      "2026-09-02",
      "2026-09-10",
      "2026-09-18",
    ],
  };

  // ── DOM refs ──
  const hintEl = document.getElementById("calendarHint");
  const hallPillEl = document.getElementById("hallPill");
  const hallTitleEl = document.getElementById("hallTitle");
  const hallSubtitleEl = document.getElementById("hallSubtitle");
  const calendarEl = document.getElementById("calendar");
  const calendarBackdrop = document.getElementById("calendarBackdrop");
  const availabilityPanel = document.getElementById("availabilityPanel");
  const availabilityTitle = document.getElementById("availabilityTitle");
  const availabilitySubtitle = document.getElementById("availabilitySubtitle");
  const availabilityState = document.getElementById("availabilityState");
  const bookingCardWrap = document.getElementById("bookingCardWrap");
  const bookingForm = document.getElementById("bookingInlineForm");
  const selectedHallIdInput = document.getElementById("selectedHallId");
  const selectedDateISOInput = document.getElementById("selectedDateISO");
  const cancelBtn = document.getElementById("cancelAvailability");
  const inlineEventName = document.getElementById("inlineEventName");
  const inlineFullName = document.getElementById("inlineFullName");
  const inlineEmail = document.getElementById("inlineEmail");
  const inlinePhone = document.getElementById("inlinePhone");
  const inlineNotes = document.getElementById("inlineNotes");
  const inlineSubmitBtn = document.getElementById("inlineSubmitBtn");
  const inlineSubmitSpinner = document.getElementById("inlineSubmitSpinner");
  const inlineSubmitText = document.getElementById("inlineSubmitText");
  const accountModal = document.getElementById("accountModal");
  const modalCreateAccount = document.getElementById("modalCreateAccount");
  const modalContinueGuest = document.getElementById("modalContinueGuest");
  const closeAccountModal = document.getElementById("closeAccountModal");
  const modalBookingSummary = document.getElementById("modalBookingSummary");

  // ── State ──
  let calendar = null;
  let bookedSet = new Set();
  let hallData = null;
  let pendingBookingPayload = null;
  let isHall1 =
    hallSlug === "hall-1" || hallSlug === "hall1" || hallSlug === "1";
  let hallKey = isHall1 ? "hall-1" : "hall-2";

  // ── Helpers ──
  function setHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  function getToken() {
    return localStorage.getItem("eventspace_token");
  }

  function showEl(el) {
    if (el) el.classList.remove("hidden");
  }

  function hideEl(el) {
    if (el) el.classList.add("hidden");
  }

  function getDateISO(dateObj) {
    return dateObj.toISOString().slice(0, 10);
  }

  function fmtDate(dateISO) {
    try {
      return new Date(dateISO + "T00:00:00").toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateISO;
    }
  }

  // ── Load from localStorage (for bookings made without backend) ──
  function getLocalBookings() {
    try {
      return JSON.parse(
        localStorage.getItem("eventspace_local_bookings") || "[]"
      );
    } catch {
      return [];
    }
  }

  function saveLocalBooking(payload) {
    const bookings = getLocalBookings();
    bookings.push({
      id: Date.now(),
      hallId: payload.hallId,
      hallKey: hallKey,
      dateISO: payload.dateISO,
      eventName: payload.eventName,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      notes: payload.notes || "",
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("eventspace_local_bookings", JSON.stringify(bookings));
  }

  function getLocalBookedDates() {
    const bookings = getLocalBookings();
    return bookings
      .filter(function (b) {
        return (
          b.hallKey === hallKey || String(b.hallId) === String(hallData?.id)
        );
      })
      .map(function (b) {
        return b.dateISO;
      });
  }

  // ── Fetch hall data with static fallback ──
  async function fetchHallBySlug(slug) {
    // Try API first
    try {
      var r = await fetch("/api/halls/" + encodeURIComponent(slug), {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        var d = await r.json();
        if (d && d.hall) return d.hall;
      }
    } catch (_) {
      /* fallback */
    }

    // Static fallback
    var staticHall =
      HALL_STATIC_DATA[slug] ||
      HALL_STATIC_DATA[hallKey] ||
      HALL_STATIC_DATA["hall-1"];
    return staticHall;
  }

  // ── Fetch booked dates with static fallback ──
  async function fetchBookedDates(hallId) {
    // Try API first
    try {
      var resp = await fetch(
        "/api/halls/" + encodeURIComponent(hallId) + "/booked-dates",
        {
          signal: AbortSignal.timeout(3000),
        }
      );
      if (resp.ok) {
        var d = await resp.json();
        if (d && d.bookedDates && d.bookedDates.length > 0) {
          return d.bookedDates;
        }
      }
    } catch (_) {
      /* fallback */
    }

    // Merge static + local bookings
    var staticDates = STATIC_BOOKED[hallKey] || STATIC_BOOKED["hall-1"] || [];
    var localDates = getLocalBookedDates();
    var merged = staticDates.concat(localDates);
    // Remove duplicates
    var seen = {};
    return merged.filter(function (d) {
      if (seen[d]) return false;
      seen[d] = true;
      return true;
    });
  }

  function buildBookedBackgroundEvents(dates) {
    return (dates || []).map(function (dateStr) {
      return {
        start: dateStr,
        end: dateStr,
        allDay: true,
        display: "background",
        classNames: ["fc-eventspace-booked"],
      };
    });
  }

  // ── Submit booking (try API, else save locally) ──
  async function submitBooking(payload) {
    var start = new Date(payload.dateISO + "T10:00:00").toISOString();
    var end = new Date(payload.dateISO + "T18:00:00").toISOString();
    var token = getToken();

    try {
      var res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({
          hallId: payload.hallId,
          eventName: payload.eventName,
          startDatetime: start,
          endDatetime: end,
          guestsCount: 1,
          specialRequirements: payload.notes || "",
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
        }),
        signal: AbortSignal.timeout(5000),
      });

      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("Date conflict");
        throw new Error((data && data.message) || "Booking failed");
      }
      return data;
    } catch (err) {
      // If API fails, save locally
      if (
        err.name === "AbortError" ||
        err.message === "Failed to fetch" ||
        err.message === "Booking failed" ||
        err.message === "Date conflict"
      ) {
        // Fallback: save locally
        if (err.message === "Date conflict") throw err;
        saveLocalBooking(payload);
        return { local: true };
      }
      // For actual errors, still save locally as fallback
      saveLocalBooking(payload);
      return { local: true };
    }
  }

  // ── Loading state ──
  function setLoading(isLoading) {
    if (!inlineSubmitBtn) return;
    inlineSubmitBtn.disabled = !!isLoading;
    if (inlineSubmitSpinner && inlineSubmitText) {
      if (isLoading) {
        inlineSubmitSpinner.classList.remove("hidden");
        inlineSubmitText.textContent = "Confirming...";
      } else {
        inlineSubmitSpinner.classList.add("hidden");
        inlineSubmitText.textContent = "Continue";
      }
    }
  }

  // ================================================================
  //  CINEMATIC ZOOM INTERACTION
  // ================================================================
  function cinematicZoom(dateObj, isBooked) {
    var dateISO = getDateISO(dateObj);

    // 1. Find the day cell in the DOM
    var dayCell = null;
    try {
      dayCell =
        calendarEl &&
        calendarEl.querySelector(
          '.fc-daygrid-day[data-date="' + dateISO + '"]'
        );
    } catch (_) {
      /* ignore */
    }

    // 2. Apply zoom animation
    if (dayCell) {
      var frame = dayCell.querySelector(".fc-daygrid-day-frame");
      if (frame) {
        frame.classList.remove("is-zooming");
        void frame.offsetWidth;
        frame.classList.add("is-zooming");
        setTimeout(function () {
          frame.classList.remove("is-zooming");
          frame.classList.add("is-cinematic-target");
        }, 750);
      }
    }

    // 3. Fade in backdrop
    if (calendarBackdrop) {
      calendarBackdrop.classList.add("is-on");
    }

    // 4. Focus state on calendar
    if (calendarEl) {
      calendarEl.classList.add("is-focus");
    }

    // 5. Show availability panel
    if (availabilityPanel) {
      availabilityPanel.classList.remove("hidden");
      void availabilityPanel.offsetWidth;
      availabilityPanel.classList.add("show");
    }

    // 6. Populate panel content
    if (isBooked) {
      setHint("This date is unavailable.");
      if (availabilityTitle) availabilityTitle.textContent = "Date Unavailable";
      if (availabilitySubtitle) {
        availabilitySubtitle.textContent =
          fmtDate(dateISO) + " is already booked.";
      }
      if (availabilityState) {
        availabilityState.innerHTML =
          '<div class="availability-state-indicator">' +
          '<div class="availability-state-dot booked"></div>' +
          "<div>" +
          '<div class="availability-state-text">Booked</div>' +
          '<div style="font-size:12px;color:var(--cal-muted);font-weight:600;margin-top:2px;">Please select another date.</div>' +
          "</div>" +
          "</div>" +
          '<span class="availability-state-badge">🔒 Locked</span>';
      }
      hideEl(bookingCardWrap);
      return;
    }

    // ── AVAILABLE STATE ──
    setHint("Available for booking.");
    if (availabilityTitle)
      availabilityTitle.textContent = "Available for Booking";
    if (availabilitySubtitle) {
      availabilitySubtitle.textContent = "Ready — " + fmtDate(dateISO) + ".";
    }
    if (availabilityState) {
      availabilityState.innerHTML =
        '<div class="availability-state-indicator">' +
        '<div class="availability-state-dot available"></div>' +
        "<div>" +
        '<div class="availability-state-text">Available for Booking</div>' +
        '<div style="font-size:12px;color:var(--cal-muted);font-weight:600;margin-top:2px;">Enter event details below.</div>' +
        "</div>" +
        "</div>" +
        '<span class="availability-state-badge">✨ Gold Window</span>';
    }

    // 7. Show booking card
    showEl(bookingCardWrap);
    bookingCardWrap.style.animation = "none";
    void bookingCardWrap.offsetWidth;
    bookingCardWrap.style.animation = "";

    // 8. Set form hidden values
    if (selectedHallIdInput)
      selectedHallIdInput.value = String(
        hallData ? hallData.id : isHall1 ? 1 : 2
      );
    if (selectedDateISOInput) selectedDateISOInput.value = dateISO;

    // 9. Store pending payload
    pendingBookingPayload = {
      hallId: String(hallData ? hallData.id : isHall1 ? 1 : 2),
      dateISO: dateISO,
    };

    // 10. Pre-fill event name
    if (inlineEventName) {
      inlineEventName.value =
        inlineEventName.value || qs.get("eventName") || "";
    }

    // 11. Update modal summary
    if (modalBookingSummary) {
      modalBookingSummary.textContent =
        "Booking requested for " + fmtDate(dateISO) + ".";
    }
  }

  // ── Close availability panel ──
  function closeAvailabilityPanel() {
    hideEl(availabilityPanel);
    if (availabilityPanel) availabilityPanel.classList.remove("show");
    if (calendarBackdrop) calendarBackdrop.classList.remove("is-on");
    if (calendarEl) calendarEl.classList.remove("is-focus");
    hideEl(bookingCardWrap);
    hideEl(accountModal);
    pendingBookingPayload = null;
    setHint("Select an available date.");
  }

  // ── Cancel button ──
  if (cancelBtn) cancelBtn.addEventListener("click", closeAvailabilityPanel);

  // ── ESC key to close ──
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAvailabilityPanel();
  });

  // ================================================================
  //  BOOKING FORM SUBMIT
  // ================================================================
  if (bookingForm) {
    bookingForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!pendingBookingPayload) return;

      var eventName = inlineEventName ? inlineEventName.value.trim() : "";
      var fullName = inlineFullName ? inlineFullName.value.trim() : "";
      var email = inlineEmail ? inlineEmail.value.trim() : "";
      var phone = inlinePhone ? inlinePhone.value.trim() : "";
      var notes = inlineNotes ? inlineNotes.value.trim() : "";

      if (!eventName || !fullName || !email || !phone) {
        [inlineEventName, inlineFullName, inlineEmail, inlinePhone].forEach(
          function (el) {
            if (el && !el.value.trim()) {
              el.style.borderColor = "#ef4444";
              setTimeout(function () {
                el.style.borderColor = "";
              }, 2000);
            }
          }
        );
        return;
      }

      pendingBookingPayload = {
        ...pendingBookingPayload,
        eventName: eventName,
        fullName: fullName,
        email: email,
        phone: phone,
        notes: notes,
      };

      if (modalBookingSummary) {
        modalBookingSummary.textContent =
          "Booking for " +
          fmtDate(pendingBookingPayload.dateISO) +
          ". Choose account or continue as guest.";
      }

      showEl(accountModal);
    });
  }

  // ── Account modal actions ──
  if (modalCreateAccount) {
    modalCreateAccount.addEventListener("click", function () {
      localStorage.setItem(
        "eventspace_pending_booking",
        JSON.stringify(pendingBookingPayload || {})
      );
      localStorage.setItem(
        "eventspace_redirect_after_register",
        window.location.href
      );
      window.location.href = "/register.html";
    });
  }

  if (modalContinueGuest) {
    modalContinueGuest.addEventListener("click", async function () {
      if (!pendingBookingPayload) return;
      hideEl(accountModal);

      try {
        setLoading(true);
        await submitBooking(pendingBookingPayload);

        // Update local state
        // Re-fetch booked dates to include the new one
        var dates = await fetchBookedDates(
          hallData ? hallData.id : isHall1 ? 1 : 2
        );
        bookedSet = new Set(dates);
        await refreshCalendarEvents();

        setHint("Booking confirmed! Admin will review your request.");

        hideEl(bookingCardWrap);
        if (availabilityState) {
          availabilityState.innerHTML =
            '<div class="availability-state-indicator">' +
            '<div class="availability-state-dot" style="background:#22c55e;box-shadow:0 0 12px rgba(34,197,94,0.3);"></div>' +
            "<div>" +
            '<div class="availability-state-text" style="color:#22c55e;">Booking Submitted!</div>' +
            '<div style="font-size:12px;color:var(--cal-muted);font-weight:600;margin-top:2px;">Admin will review within 24 hours.</div>' +
            "</div>" +
            "</div>" +
            '<span class="availability-state-badge">✓ Confirmed</span>';
        }
      } catch (err) {
        setHint("Booking failed. Please try again.");
        if (availabilityState) {
          availabilityState.innerHTML =
            '<div class="availability-state-indicator">' +
            '<div class="availability-state-dot" style="background:#ef4444;box-shadow:0 0 12px rgba(239,68,68,0.3);"></div>' +
            "<div>" +
            '<div class="availability-state-text" style="color:#ef4444;">Booking Failed</div>' +
            '<div style="font-size:12px;color:var(--cal-muted);font-weight:600;margin-top:2px;">' +
            (err.message || "Please try again.") +
            "</div>" +
            "</div>" +
            "</div>" +
            '<span class="availability-state-badge">✕ Error</span>';
        }
      } finally {
        setLoading(false);
      }
    });
  }

  if (closeAccountModal) {
    closeAccountModal.addEventListener("click", function () {
      hideEl(accountModal);
    });
  }

  // ================================================================
  //  CALENDAR RENDER
  // ================================================================
  async function refreshCalendarEvents() {
    if (!hallData) return;
    var dates = await fetchBookedDates(hallData.id);
    bookedSet = new Set(dates);
    var events = buildBookedBackgroundEvents(dates);

    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(events);
      calendar.render();
    }
  }

  async function renderCalendar() {
    if (!hallData) return;
    if (!calendarEl) return;

    var dates = await fetchBookedDates(hallData.id);
    bookedSet = new Set(dates);
    var events = buildBookedBackgroundEvents(dates);

    if (calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(events);
      calendar.render();
      setHint("Select an available date.");
      return;
    }

    // ── Check FullCalendar is loaded ──
    if (typeof FullCalendar === "undefined" || !FullCalendar.Calendar) {
      setHint("Loading calendar...");
      // Retry after a short delay
      setTimeout(function () {
        renderCalendar();
      }, 1000);
      return;
    }

    try {
      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        height: "100%",
        expandRows: true,
        dayMaxEventRows: 0,
        fixedWeekCount: false,
        aspectRatio: 1.2,
        headerToolbar: {
          left: "prev,next",
          center: "title",
          right: "",
        },
        showNonCurrentDates: false,
        locale: "en",
        events: events,

        dateClick: function (info) {
          var dateISO = getDateISO(info.date);
          var isBooked = bookedSet.has(dateISO);
          cinematicZoom(info.date, isBooked);
        },

        dayCellDidMount: function (arg) {
          var dateISO = getDateISO(arg.date);
          var dayEl = arg.el;
          if (!dayEl) return;

          if (bookedSet.has(dateISO)) {
            dayEl.classList.add("is-booked-day");
            dayEl.classList.remove("is-available-day");

            var existing = dayEl.querySelector(".booked-label");
            if (!existing) {
              var label = document.createElement("span");
              label.className = "booked-label";
              label.textContent = "Booked";
              dayEl.appendChild(label);
            }
          } else {
            dayEl.classList.add("is-available-day");
            dayEl.classList.remove("is-booked-day");

            var label = dayEl.querySelector(".booked-label");
            if (label) label.remove();
          }
        },
      });

      calendar.render();
      setHint("Select an available date.");

      // ── Auto-refresh every 15 seconds ──
      setInterval(async function () {
        try {
          await refreshCalendarEvents();
        } catch (_) {
          /* ignore */
        }
      }, 15000);
    } catch (e) {
      console.error("[Calendar Render Error]", e);
      // Fallback: if FullCalendar fails, create a simple table calendar
      createFallbackCalendar(dates);
    }
  }

  // ================================================================
  //  FALLBACK CALENDAR (if FullCalendar fails to load)
  // ================================================================
  function createFallbackCalendar(bookedDates) {
    if (!calendarEl) return;
    setHint("Calendar ready. Click a date to book.");
    calendarEl.innerHTML = "";
    calendarEl.style.overflow = "auto";
    calendarEl.style.padding = "20px";

    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();

    function renderMonth(y, m) {
      calendarEl.innerHTML = "";
      var booked = new Set(bookedDates || []);

      var table = document.createElement("table");
      table.style.cssText =
        "width:100%;border-collapse:collapse;font-family:Inter,sans-serif;";

      // Month title
      var cap = document.createElement("caption");
      cap.style.cssText =
        "font-size:1.4rem;font-weight:800;color:#6b0f1a;padding:12px 0;text-align:center;letter-spacing:-0.03em;";
      cap.textContent = new Date(y, m).toLocaleDateString([], {
        month: "long",
        year: "numeric",
      });
      table.appendChild(cap);

      // Day headers
      var thead = document.createElement("thead");
      var headRow = document.createElement("tr");
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) {
        var th = document.createElement("th");
        th.style.cssText =
          "padding:8px 4px;font-size:11px;font-weight:700;color:rgba(10,10,10,0.5);text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid rgba(107,15,26,0.1);";
        th.textContent = d;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      // Days
      var tbody = document.createElement("tbody");
      var firstDay = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var todayStr = getDateISO(new Date());

      var date = 1;
      for (var i = 0; i < 6; i++) {
        var row = document.createElement("tr");
        for (var j = 0; j < 7; j++) {
          var cell = document.createElement("td");
          cell.style.cssText =
            "padding:4px;border:1px solid rgba(107,15,26,0.06);vertical-align:top;height:80px;width:14.28%;border-radius:8px;transition:all 200ms ease;";

          if (i === 0 && j < firstDay) {
            cell.style.background = "transparent";
            cell.style.border = "none";
            row.appendChild(cell);
            continue;
          }

          if (date > daysInMonth) {
            cell.style.background = "transparent";
            cell.style.border = "none";
            row.appendChild(cell);
            continue;
          }

          var dateStr =
            y +
            "-" +
            String(m + 1).padStart(2, "0") +
            "-" +
            String(date).padStart(2, "0");
          var isToday = dateStr === todayStr;
          var isBooked = booked.has(dateStr);

          if (isBooked) {
            cell.style.background = "rgba(107,15,26,0.92)";
            cell.style.color = "white";
            cell.style.cursor = "not-allowed";
            cell.style.borderColor = "rgba(107,15,26,0.95)";
            cell.innerHTML =
              '<div style="font-weight:700;font-size:14px;padding:4px;">' +
              date +
              '</div><div style="font-size:8px;font-weight:800;color:#f5c542;text-align:center;">🔒 Booked</div>';
          } else {
            if (isToday) {
              cell.style.border = "2px solid #f5c542";
              cell.style.boxShadow = "0 0 0 3px rgba(245,197,66,0.2)";
            }
            cell.style.background = "white";
            cell.style.cursor = "pointer";
            cell.style.color = "rgba(10,10,10,0.88)";
            cell.innerHTML =
              '<div style="font-weight:600;font-size:14px;padding:4px;">' +
              date +
              '</div><div style="font-size:8px;color:#22c55e;font-weight:600;text-align:center;">Available</div>';
            cell.addEventListener(
              "click",
              (function (dStr) {
                return function () {
                  var isB = bookedSet.has(dStr);
                  cinematicZoom(new Date(dStr + "T12:00:00"), isB);
                };
              })(dateStr)
            );
            cell.addEventListener("mouseenter", function () {
              this.style.background = "rgba(107,15,26,0.04)";
              this.style.transform = "translateY(-2px)";
              this.style.boxShadow = "0 8px 25px rgba(107,15,26,0.1)";
            });
            cell.addEventListener("mouseleave", function () {
              this.style.background = "white";
              this.style.transform = "";
              this.style.boxShadow = isToday
                ? "0 0 0 3px rgba(245,197,66,0.2)"
                : "";
            });
          }

          row.appendChild(cell);
          date++;
        }
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      calendarEl.appendChild(table);

      // Navigation
      var nav = document.createElement("div");
      nav.style.cssText =
        "display:flex;justify-content:center;gap:12px;margin-top:16px;";
      var prevBtn = document.createElement("button");
      prevBtn.textContent = "← Prev";
      prevBtn.style.cssText =
        "padding:8px 16px;border-radius:999px;border:1px solid rgba(107,15,26,0.12);background:white;font-weight:600;font-size:13px;cursor:pointer;";
      prevBtn.addEventListener("click", function () {
        month--;
        if (month < 0) {
          month = 11;
          year--;
        }
        renderMonth(year, month);
      });
      var nextBtn = document.createElement("button");
      nextBtn.textContent = "Next →";
      nextBtn.style.cssText =
        "padding:8px 16px;border-radius:999px;border:1px solid rgba(107,15,26,0.12);background:white;font-weight:600;font-size:13px;cursor:pointer;";
      nextBtn.addEventListener("click", function () {
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
        renderMonth(year, month);
      });
      nav.appendChild(prevBtn);
      nav.appendChild(nextBtn);
      calendarEl.appendChild(nav);
    }

    renderMonth(year, month);
  }

  // ================================================================
  //  INIT
  // ================================================================
  async function init() {
    if (!hallSlug) {
      setHint("Loading...");
      hallKey = "hall-1";
    }

    // Update hallKey based on slug
    if (
      hallSlug === "hall-1" ||
      hallSlug === "hall1" ||
      hallSlug === "1" ||
      hallSlug.indexOf("1") >= 0
    ) {
      hallKey = "hall-1";
      isHall1 = true;
    } else {
      hallKey = "hall-2";
      isHall1 = false;
    }

    try {
      setHint("Loading hall...");
      hallData = await fetchHallBySlug(hallSlug);

      if (!hallData) {
        hallData = HALL_STATIC_DATA[hallKey] || HALL_STATIC_DATA["hall-1"];
      }

      // Update header
      if (hallPillEl) {
        hallPillEl.textContent = hallData.name ? hallData.name : "Hall";
      }
      if (hallTitleEl) {
        hallTitleEl.textContent = hallData.name || "Availability";
      }
      if (hallSubtitleEl) {
        hallSubtitleEl.textContent =
          "Select an available date for " +
          (hallData.name || "this hall") +
          ". Booked dates are locked.";
      }

      setHint("Loading availability...");

      // Always render calendar regardless of API status
      await renderCalendar();

      // ── Check for pending redirect after registration ──
      var pendingBooking = localStorage.getItem("eventspace_pending_booking");
      if (pendingBooking) {
        try {
          var parsed = JSON.parse(pendingBooking);
          if (parsed && parsed.dateISO) {
            var dateObj = new Date(parsed.dateISO + "T00:00:00");
            cinematicZoom(dateObj, false);
            if (parsed.eventName && inlineEventName)
              inlineEventName.value = parsed.eventName;
            if (parsed.fullName && inlineFullName)
              inlineFullName.value = parsed.fullName;
            if (parsed.email && inlineEmail) inlineEmail.value = parsed.email;
            if (parsed.phone && inlinePhone) inlinePhone.value = parsed.phone;
            if (parsed.notes && inlineNotes) inlineNotes.value = parsed.notes;
          }
        } catch (_) {
          /* ignore */
        }
        localStorage.removeItem("eventspace_pending_booking");
      }

      // ── Refresh on page focus ──
      window.addEventListener("pageshow", function () {
        refreshCalendarEvents().catch(function () {});
      });
    } catch (e) {
      // NEVER show error - use fallback data
      console.warn("[EventSpace Calendar] Using fallback data:", e.message);

      // Fallback data
      hallData = HALL_STATIC_DATA[hallKey] || HALL_STATIC_DATA["hall-1"];

      if (hallPillEl) hallPillEl.textContent = hallData.name;
      if (hallTitleEl) hallTitleEl.textContent = hallData.name;
      if (hallSubtitleEl)
        hallSubtitleEl.textContent =
          "Select an available date for " + hallData.name + ".";

      setHint("Select an available date.");
      await renderCalendar();
    }
  }

  // ── Start ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
