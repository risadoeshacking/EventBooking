export function requireFields(fields = []) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const v = req.body?.[f];
      return v === undefined || v === null || String(v).trim() === "";
    });
    if (missing.length) {
      return res
        .status(400)
        .json({ message: "Missing required fields", missing });
    }
    return next();
  };
}

export function parseBookingDateTime({
  startDate,
  startTime,
  endDate,
  endTime,
}) {
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(`${endDate}T${endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { startDatetime: start.toISOString(), endDatetime: end.toISOString() };
}
