import { DateTime } from "luxon";
export type Row = Record<string, string>;
/** GTFS measures service times from local noon minus twelve elapsed hours, including DST days. */
export function gtfsTime(
  serviceDay: string,
  time: string,
  zone = "Europe/Brussels",
): number {
  if (!/^\d{8}$/.test(serviceDay) || !/^\d{1,3}:\d{2}:\d{2}$/.test(time))
    throw new Error("Invalid GTFS date/time");
  const [h, m, s] = time.split(":").map(Number);
  if (m > 59 || s > 59) throw new Error("Invalid GTFS time");
  const noon = DateTime.fromFormat(serviceDay, "yyyyLLdd", { zone }).set({
    hour: 12,
  });
  if (!noon.isValid) throw new Error("Invalid service day");
  return noon
    .minus({ hours: 12 })
    .plus({ seconds: h * 3600 + m * 60 + s })
    .toMillis();
}
export function serviceRuns(
  service: string,
  day: string,
  calendars: Row[],
  exceptions: Row[],
): boolean {
  const exception = exceptions.find(
    (r) => r.service_id === service && r.date === day,
  );
  if (exception) return exception.exception_type === "1";
  const weekday = DateTime.fromFormat(day, "yyyyLLdd", {
    zone: "Europe/Brussels",
  })
    .toFormat("cccc")
    .toLowerCase();
  return calendars.some(
    (r) =>
      r.service_id === service &&
      r.start_date <= day &&
      r.end_date >= day &&
      r[weekday] === "1",
  );
}
