import { DateTime } from "luxon";
import type { Stop } from "./types";
export const ZONE = "Europe/Brussels";
export const clockTime = (ms: number) =>
  new Intl.DateTimeFormat("nl-BE", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
export const dateLabel = (ms: number) =>
  new Intl.DateTimeFormat("nl-BE", {
    timeZone: ZONE,
    day: "numeric",
    month: "long",
  }).format(ms);
export const serviceDate = (ms = Date.now()) =>
  DateTime.fromMillis(ms, { zone: ZONE }).toFormat("ddLLyy");
export const inputNow = () =>
  DateTime.now().setZone(ZONE).toFormat("yyyy-LL-dd'T'HH:mm");
export function apiDateTime(input: string) {
  const d = DateTime.fromISO(input, { zone: ZONE });
  if (!d.isValid) throw new Error("Ongeldige datum");
  if (d.toFormat("yyyy-LL-dd'T'HH:mm") !== input)
    throw new Error("Dit tijdstip bestaat niet door de zomertijd.");
  return { date: d.toFormat("ddLLyy"), time: d.toFormat("HHmm") };
}
export function distance(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const r = Math.PI / 180;
  const dlat = (b.lat - a.lat) * r,
    dlon = (b.lon - a.lon) * r;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export const distanceLabel = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-/'’]/g, " ");
export function searchStops(stops: Stop[], query: string) {
  const q = normalize(query.trim());
  if (!q) return stops.slice(0, 8);
  return stops
    .map((s) => ({ s, n: normalize([s.name, ...s.aliases].join(" ")) }))
    .map(({ s, n }) => ({
      s,
      score: normalize(s.name) === q || s.aliases.some(a => normalize(a) === q) ? -1 : n.startsWith(q)
        ? 0
        : n.includes(q)
          ? 1
          : q.split(" ").every((t) => n.includes(t))
            ? 2
            : !/^\d+$/.test(q) && subsequence(q, n)
              ? 3
              : 9,
    }))
    .filter((x) => x.score < 9)
    .sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name))
    .slice(0, 8)
    .map((x) => x.s);
}
function subsequence(a: string, b: string) {
  if (a.length < 4) return false;
  let j = 0;
  for (const c of b) if (c === a[j]) j++;
  return j === a.length;
}
export function nearest(stops: Stop[], position: { lat: number; lon: number }) {
  return stops
    .map((stop) => ({ ...stop, distance: distance(stop, position) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}
