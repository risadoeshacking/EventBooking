(function () {
  const cfg = window.__eventspace_hall_calendar || null;
  if (!cfg?.hallSlug) return;

  const hintEl = document.getElementById("calendarHint");
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  function setHint(text) {
    if (!hintEl) return;
    hintEl.textContent = text;
  }

  function getDateISO(dateObj) {
    return dateObj.toISOString().slice(0, 10);
  }

  async function fetchHallIdBySlug(hallSlug) {
    const r = await fetch(`/api/halls/${encodeURIComponent(hallSlug)}`);
    if (!r.ok) throw new Error("Failed to load hall");
    const d = await r.json();
    return d.hall?.id;
  }

  async function fetchBookedDates(hallId) {
    const resp = await fetch(
      `/api/halls/${encodeURIComponent(hallId)}/booked-dates`
    );
    if (!resp.ok) return [];
    const d = await resp.json();
    return d.bookedDates || [];
  }

  function buildBookedBackgroundEvents(bookedDates) {
    return (bookedDates || []).map((dateStr) => ({
      start: dateStr,
      end: dateStr,
      allDay: true,
      display: "background",
      classNames: ["fc-eventspace-booked"],
    }));
  }

  let calendar;
  let bookedSet = new Set();

  async function render() {
    if (!calendar) return;

    const bookedDates = await fetchBookedDates(cfg.hallId);
    bookedSet = new Set(bookedDates);

    const events = buildBookedBackgroundEvents(bookedDates);

    calendar.removeAllEvents();
    calendar.addEventSource(events);

    calendar.render();
  }

  async function init() {
    try {
      setHint("Loading availability...");

      const hallId = await fetchHallIdBySlug(cfg.hallSlug);
      if (!hallId) throw new Error("Hall not found");
      cfg.hallId = hallId;

      // Ensure premium styles apply.
      // Our premium CSS targets .calendar-premium, so we add it to the calendar root.
      if (calendarEl && !calendarEl.classList.contains("calendar-premium")) {
        calendarEl.classList.add("calendar-premium");
      }

      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        height: "80vh",
        aspectRatio: 1.15,
        fixedWeekCount: false,
        expandRows: true,
        dayMaxEventRows: 0,
        aspectRatio: 1.4,
        headerToolbar: {
          left: "prev,next",
          center: "title",
          right: "today dayGridMonth",
        },
        datesSet: function () {
          // keep hint calm
        },
        events: [],
        dateClick: function (info) {
          const dateISO = getDateISO(info.date);
          if (bookedSet.has(dateISO)) {
            setHint("Booked — please choose another date.");
            return;
          }
          const qs = new URLSearchParams({
            hallId: String(hallId),
            date: dateISO,
          });
          window.location.href = `/booking.html?${qs.toString()}`;
        },
        dayCellDidMount: function (arg) {
          const dateISO = getDateISO(arg.date);
          const dayEl = arg.el;
          if (!dayEl) return;
          if (bookedSet.has(dateISO)) dayEl.classList.add("is-booked-day");
          else dayEl.classList.add("is-available-day");
        },
      });

      // Force premium styling: add a scope class that our premium CSS targets.
      // FullCalendar markup is appended inside #calendar.
      calendar.render();

      if (calendarEl && !calendarEl.classList.contains("calendar-premium")) {
        calendarEl.classList.add("calendar-premium");
      }

      // initial paint
      await render();
      setHint("Select an available date.");

      // Live refresh
      setInterval(async () => {
        try {
          await render();
        } catch {
          // ignore
        }
      }, 10000);

      window.addEventListener("pageshow", () => {
        render().catch(() => {});
      });
    } catch (e) {
      setHint("Failed to load availability. Please refresh.");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  init();
})();
