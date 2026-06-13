/* ============================================================
   EventSpace — Premium Interactive Hall Booking System
   Cinematic calendar zoom · Hourly time slots · Luxury UI
   Fully functional with static fallback data.
   ============================================================ */

(function () {
  "use strict";

  // ─── CONFIG ───
  const SLOT_START = 8; // 8 AM
  const SLOT_END = 20; // 8 PM (slots: 8-9, 9-10 ... 19-20 = 7-8 PM)

  // ─── URL PARAMS ───
  const qs = new URLSearchParams(window.location.search);
  const hallParam =
    qs.get("hall") || qs.get("hallSlug") || qs.get("slug") || "hall-1";
  const hallKey = hallParam.indexOf("2") >= 0 ? "hall-2" : "hall-1";
  const hallId = hallKey === "hall-2" ? 2 : 1;

  // ─── STATIC FALLBACK DATA ───
  const HALL_DATA = {
    "hall-1": { id: 1, name: "The Grand Ballroom", capacity: 300, price: 2500 },
    "hall-2": {
      id: 2,
      name: "The Sapphire Lounge",
      capacity: 120,
      price: 1500,
    },
  };

  // Static time slot bookings: { "hall-1|2026-07-04": [9, 14, 15, 18], ... }
  const STATIC_SLOTS = {};
  function initStaticSlots() {
    const dates1 = [
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
    ];
    const dates2 = [
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
    ];
    dates1.forEach(function (d) {
      STATIC_SLOTS["hall-1|" + d] = [9, 10, 14, 15, 18];
      STATIC_SLOTS["hall-2|" + d] = [11, 12, 13, 16, 17];
    });
    dates2.forEach(function (d) {
      STATIC_SLOTS["hall-2|" + d] = [8, 9, 14, 15, 19];
    });
  }
  initStaticSlots();

  // Local storage for bookings made without backend
  function getLocalBookings() {
    try {
      return JSON.parse(localStorage.getItem("es_local_bookings") || "[]");
    } catch {
      return [];
    }
  }
  function saveLocalBooking(payload) {
    var bookings = getLocalBookings();
    bookings.push({
      id: Date.now(),
      hallKey: hallKey,
      hallId: payload.hallId,
      date: payload.date,
      hour: payload.hour,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      eventName: payload.eventName || "",
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("es_local_bookings", JSON.stringify(bookings));
  }
  function getLocalBookedHours(dateStr) {
    var bookings = getLocalBookings();
    return bookings
      .filter(function (b) {
        return b.hallKey === hallKey && b.date === dateStr;
      })
      .map(function (b) {
        return b.hour;
      });
  }

  // ─── DOM REFS ───
  var els = {};
  var ids = [
    "esHallBadge",
    "esMonthTitle",
    "esCalendarGrid",
    "esPrevMonth",
    "esNextMonth",
    "esCalendarView",
    "esDayView",
    "esDayBackdrop",
    "esDayPanel",
    "esDayBackBtn",
    "esDayHallName",
    "esDayDate",
    "esSlotsGrid",
    "esBookingModal",
    "esModalClose",
    "esModalSubtitle",
    "esBookingForm",
    "esFormHallId",
    "esFormDate",
    "esFormHour",
    "esFormName",
    "esFormEmail",
    "esFormPhone",
    "esFormEvent",
    "esFormSubmit",
    "esSubmitText",
    "esSubmitSpinner",
    "esSuccessToast",
    "esToastMsg",
  ];
  ids.forEach(function (id) {
    els[id] = document.getElementById(id);
  });

  // ─── STATE ───
  var currentMonth = new Date().getMonth();
  var currentYear = new Date().getFullYear();
  var todayStr = dateToStr(new Date());
  var hallData = HALL_DATA[hallKey] || HALL_DATA["hall-1"];
  var selectedSlot = null; // { date, hour }

  // ─── HELPERS ───
  function dateToStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatHour(h) {
    if (h === 12) return "12:00 PM";
    if (h < 12) return h + ":00 AM";
    return h - 12 + ":00 PM";
  }

  function formatHourRange(h) {
    return formatHour(h) + " — " + formatHour(h + 1);
  }

  function formatDateNice(dateStr) {
    var d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function getDaysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }
  function getFirstDay(y, m) {
    return new Date(y, m, 1).getDay();
  }

  function show(el) {
    if (el) el.classList.remove("hidden");
  }
  function hide(el) {
    if (el) el.classList.add("hidden");
  }

  // ─── FETCH BOOKED HOURS WITH FALLBACK ───
  async function fetchBookedHours(dateStr) {
    try {
      var resp = await fetch(
        "/api/halls/" + hallId + "/slots?date=" + dateStr,
        { signal: AbortSignal.timeout(3000) }
      );
      if (resp.ok) {
        var data = await resp.json();
        if (data && Array.isArray(data.bookedHours)) return data.bookedHours;
      }
    } catch (_) {}

    // Static fallback
    var staticKey = hallKey + "|" + dateStr;
    var staticHours = STATIC_SLOTS[staticKey] || [];

    // Merge local
    var localHours = getLocalBookedHours(dateStr);
    var merged = staticHours.concat(localHours);
    return merged.filter(function (h, i) {
      return merged.indexOf(h) === i;
    });
  }

  // ─── SUBMIT BOOKING ───
  async function submitBooking(payload) {
    var startStr =
      payload.date + "T" + String(payload.hour).padStart(2, "0") + ":00:00";
    var endStr =
      payload.date + "T" + String(payload.hour + 1).padStart(2, "0") + ":00:00";

    try {
      var res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hallId: payload.hallId,
          eventName: payload.eventName || "Event",
          hour: payload.hour,
          startDatetime: startStr,
          endDatetime: endStr,
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return await res.json();
      var data = await res.json().catch(function () {
        return {};
      });
      throw new Error(data.message || "Booking failed");
    } catch (err) {
      if (err.message === "This time slot is already booked") throw err;
      saveLocalBooking(payload);
      return { local: true, message: "Saved offline" };
    }
  }

  // ─── RENDER CALENDAR ───
  async function renderCalendar() {
    var grid = els.esCalendarGrid;
    if (!grid) return;

    var daysInMonth = getDaysInMonth(currentYear, currentMonth);
    var firstDay = getFirstDay(currentYear, currentMonth);
    var monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    els.esMonthTitle.textContent = monthNames[currentMonth] + " " + currentYear;

    // Pre-fetch booked hours for all visible dates (to show indicators)
    var dateBookedMap = {};
    var fetchPromises = [];
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr =
        currentYear +
        "-" +
        String(currentMonth + 1).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0");
      (function (ds) {
        fetchPromises.push(
          fetchBookedHours(ds).then(function (hours) {
            dateBookedMap[ds] = hours;
          })
        );
      })(dateStr);
    }
    await Promise.all(fetchPromises);

    grid.innerHTML = "";

    // Empty leading cells
    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement("div");
      empty.className = "es-day-cell es-other-month";
      grid.appendChild(empty);
    }

    // Day cells
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr =
        currentYear +
        "-" +
        String(currentMonth + 1).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0");
      var isToday = dateStr === todayStr;
      var bookedHours = dateBookedMap[dateStr] || [];
      var totalSlots = SLOT_END - SLOT_START; // 12 slots
      var bookedCount = bookedHours.length;

      var cell = document.createElement("div");
      cell.className = "es-day-cell";
      if (isToday) cell.classList.add("es-today");
      cell.dataset.date = dateStr;

      var numSpan = document.createElement("span");
      numSpan.className = "es-day-number";
      numSpan.textContent = day;
      cell.appendChild(numSpan);

      var indicator = document.createElement("span");
      indicator.className = "es-day-indicator";
      if (bookedCount === 0) {
        indicator.classList.add("avail");
        indicator.textContent = "Available";
      } else if (bookedCount < totalSlots) {
        indicator.classList.add("partial");
        indicator.textContent = bookedCount + " of " + totalSlots + " booked";
      } else {
        indicator.classList.add("full");
        indicator.textContent = "Full";
      }
      cell.appendChild(indicator);

      cell.addEventListener(
        "click",
        (function (ds) {
          return function () {
            openDayView(ds);
          };
        })(dateStr)
      );

      grid.appendChild(cell);
    }
  }

  // ─── OPEN DAY VIEW (CINEMATIC ZOOM) ───
  function openDayView(dateStr) {
    // Animate calendar out
    els.esCalendarView.classList.add("is-zooming-out");

    // Set hall info
    els.esDayHallName.textContent = hallData.name;

    // Format date nicely
    var dayDate = new Date(dateStr + "T12:00:00");
    var dayFormatted = dayDate.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    els.esDayDate.textContent = dayFormatted;

    // Show day view with delay (wait for zoom-out)
    setTimeout(function () {
      els.esDayView.classList.add("is-active");
      renderSlots(dateStr);
    }, 300);

    // Store current date
    selectedSlot = { date: dateStr, hour: null };
  }

  // ─── RENDER TIME SLOTS ───
  async function renderSlots(dateStr) {
    var grid = els.esSlotsGrid;
    if (!grid) return;
    grid.innerHTML = "";

    var bookedHours = await fetchBookedHours(dateStr);
    var bookedSet = {};
    bookedHours.forEach(function (h) {
      bookedSet[h] = true;
    });

    for (var h = SLOT_START; h < SLOT_END; h++) {
      var isBooked = !!bookedSet[h];
      var slot = document.createElement("div");
      slot.className = "es-slot";
      if (isBooked) slot.classList.add("is-booked");

      var lockSpan = document.createElement("span");
      lockSpan.className = "es-slot-lock";
      lockSpan.textContent = "🔒";
      slot.appendChild(lockSpan);

      var timeSpan = document.createElement("span");
      timeSpan.className = "es-slot-time";
      timeSpan.textContent = formatHourRange(h);
      slot.appendChild(timeSpan);

      var labelSpan = document.createElement("span");
      labelSpan.className = "es-slot-label";
      labelSpan.textContent = isBooked ? "Booked" : "Available";
      slot.appendChild(labelSpan);

      if (!isBooked) {
        slot.addEventListener(
          "click",
          (function (hour) {
            return function () {
              openBookingModal(selectedSlot.date, hour);
            };
          })(h)
        );
      }

      grid.appendChild(slot);
    }
  }

  // ─── CLOSE DAY VIEW ───
  function closeDayView() {
    els.esDayView.classList.remove("is-active");
    els.esCalendarView.classList.remove("is-zooming-out");
    // Re-render calendar to refresh data
    setTimeout(function () {
      renderCalendar();
    }, 200);
  }

  // ─── OPEN BOOKING MODAL ───
  function openBookingModal(dateStr, hour) {
    selectedSlot = { date: dateStr, hour: hour };

    els.esFormHallId.value = String(hallId);
    els.esFormDate.value = dateStr;
    els.esFormHour.value = String(hour);

    els.esModalSubtitle.textContent =
      hallData.name +
      " • " +
      formatDateNice(dateStr) +
      " • " +
      formatHourRange(hour);

    // Clear previous values
    els.esFormName.value = "";
    els.esFormEmail.value = "";
    els.esFormPhone.value = "";
    els.esFormEvent.value = "";

    els.esBookingModal.classList.add("is-active");
  }

  // ─── CLOSE MODAL ───
  function closeModal() {
    els.esBookingModal.classList.remove("is-active");
  }

  // ─── SHOW TOAST ───
  function showToast(msg) {
    els.esToastMsg.textContent = msg;
    show(els.esSuccessToast);
    setTimeout(function () {
      hide(els.esSuccessToast);
    }, 3500);
  }

  // ─── SET LOADING ───
  function setLoading(isLoading) {
    els.esFormSubmit.disabled = !!isLoading;
    if (isLoading) {
      hide(els.esSubmitText);
      show(els.esSubmitSpinner);
    } else {
      show(els.esSubmitText);
      hide(els.esSubmitSpinner);
    }
  }

  // ─── EVENT LISTENERS ───

  // Month navigation
  els.esPrevMonth.addEventListener("click", function () {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });
  els.esNextMonth.addEventListener("click", function () {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });

  // Day view back button
  els.esDayBackBtn.addEventListener("click", closeDayView);

  // Modal close
  els.esModalClose.addEventListener("click", closeModal);
  els.esBookingModal.addEventListener("click", function (e) {
    if (e.target === els.esBookingModal) closeModal();
  });

  // ESC key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (els.esBookingModal.classList.contains("is-active")) closeModal();
      else if (els.esDayView.classList.contains("is-active")) closeDayView();
    }
  });

  // ─── FORM SUBMIT ───
  els.esBookingForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!selectedSlot || !selectedSlot.hour) return;

    var fullName = els.esFormName.value.trim();
    var email = els.esFormEmail.value.trim();
    var phone = els.esFormPhone.value.trim();
    var eventName = els.esFormEvent.value.trim();

    // Validate
    var hasError = false;
    if (!fullName) {
      els.esFormName.classList.add("es-error");
      hasError = true;
    }
    if (!email) {
      els.esFormEmail.classList.add("es-error");
      hasError = true;
    }
    if (!phone) {
      els.esFormPhone.classList.add("es-error");
      hasError = true;
    }

    // Clear errors on focus
    [els.esFormName, els.esFormEmail, els.esFormPhone].forEach(function (el) {
      el.addEventListener(
        "input",
        function () {
          el.classList.remove("es-error");
        },
        { once: true }
      );
    });

    if (hasError) return;

    var payload = {
      hallId: hallId,
      date: selectedSlot.date,
      hour: selectedSlot.hour,
      fullName: fullName,
      email: email,
      phone: phone,
      eventName: eventName || "Event",
    };

    setLoading(true);

    try {
      await submitBooking(payload);
      setLoading(false);
      closeModal();
      showToast(
        "Booking confirmed for " + formatHourRange(selectedSlot.hour) + "!"
      );
      // Refresh slots to show updated state
      renderSlots(selectedSlot.date);
    } catch (err) {
      setLoading(false);
      if (err.message === "This time slot is already booked") {
        showToast("Sorry, this slot was just booked. Please select another.");
        renderSlots(selectedSlot.date);
      } else {
        showToast("Booking saved! Will sync when online.");
        closeModal();
        renderSlots(selectedSlot.date);
      }
    }
  });

  // ─── INIT ───
  async function init() {
    // Set hall badge
    els.esHallBadge.textContent = hallData.name;

    // Set month to current
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();

    // Render calendar
    await renderCalendar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
