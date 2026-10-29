import { z } from "zod";
import { get, set } from "idb-keyval";
import type {
  Board,
  Departure,
  Journey,
  Leg,
  Point,
  Snapshot,
  Stop,
  TransportAdapter,
  Trip,
} from "./types";
const numeric = z
  .union([z.string(), z.number()])
  .transform(Number)
  .refine(Number.isFinite);
const station = z.object({
  id: z.string(),
  name: z.string(),
  standardname: z.string().optional(),
  locationX: numeric,
  locationY: numeric,
});
const event = z
  .object({
    station: z.string(),
    stationinfo: station,
    time: numeric,
    delay: numeric.optional(),
    platform: z.string().optional(),
    canceled: numeric.optional(),
    vehicle: z.string().optional(),
    walking: numeric.optional(),
    vehicleinfo: z.object({ shortname: z.string() }).passthrough().optional(),
  })
  .passthrough();
const departure = event.extend({
  id: z.string(),
  left: numeric.optional(),
  departureConnection: z.string().optional(),
});
const base = import.meta.env.VITE_API_BASE as string | undefined;
let queue = Promise.resolve();
let nextSlot = 0;
export class DataError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function cachedRequest<T>(
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  signal?: AbortSignal,
): Promise<Snapshot<T>> {
  const qs = new URLSearchParams({
    ...params,
    format: "json",
    lang: params.lang || "nl",
  });
  const key = `irail:${path}:${qs}`;
  const ttl = path === "stations" ? 86400000 : 60000;
  let cache: { value: T; storedAt: number } | undefined;
  try {
    cache = await get(key);
  } catch {
    /* Storage may be denied. */
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (!navigator.onLine) {
    if (cache && path !== "connections") return { ...cache, offline: true };
    throw new DataError(
      "Je bent offline. Voor deze zoekopdracht zijn geen actuele gegevens beschikbaar.",
    );
  }
  if (cache && Date.now() - cache.storedAt < ttl && navigator.onLine)
    return { ...cache, offline: false };
  const work = queue.then(async () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((r) => setTimeout(r, Math.max(0, nextSlot - Date.now())));
    nextSlot = Date.now() + 400;
  });
  queue = work.catch(() => {});
  await work;
  try {
    const combined = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000);
    const res = await fetch(
      `${base ? `${base}/irail` : "https://api.irail.be/v1"}/${path}?${qs}`,
      { signal: combined, headers: { Accept: "application/json" } },
    );
    if (!res.ok)
      throw new DataError(
        res.status === 429
          ? "De databron is druk. Probeer het over een minuut opnieuw."
          : res.status === 404
            ? "Geen vervoersinformatie gevonden."
            : "De databron is tijdelijk niet bereikbaar.",
        res.status,
      );
    const raw = await res.json();
    const value = schema.parse(raw);
    const storedAt = Date.now();
    try {
      await set(key, { value, storedAt });
    } catch {
      /* Network data remains usable. */
    }
    return { value, storedAt, offline: false };
  } catch (e) {
    if (signal?.aborted) throw e;
    if (cache && path !== "connections") return { ...cache, offline: true };
    if (e instanceof DataError) throw e;
    throw new DataError(
      navigator.onLine
        ? "We konden de vervoersgegevens niet ophalen. Probeer opnieuw."
        : "Je bent offline. Voor deze zoekopdracht zijn geen opgeslagen gegevens.",
    );
  }
}
export function normalizeStop(s: z.infer<typeof station>): Stop {
  return {
    id: s.id,
    name: s.name,
    aliases: [s.standardname || s.name],
    lat: s.locationY,
    lon: s.locationX,
    operator: "nmbs",
  };
}
export function normalizeDeparture(d: z.infer<typeof departure>): Departure {
  return {
    id: d.departureConnection || `${d.vehicle}:${d.time}`,
    destination: d.station,
    time: d.time * 1000,
    delay: d.delay === undefined ? null : d.delay * 1000,
    canceled: d.canceled === 1,
    left: d.left === 1,
    vehicle: d.vehicle || "",
    line:
      d.vehicleinfo?.shortname || d.vehicle?.replace("BE.NMBS.", "") || "Trein",
    platform: d.platform || "?",
  };
}
function point(d: z.infer<typeof event>): Point {
  return {
    name: d.station,
    id: d.stationinfo.id,
    lat: d.stationinfo.locationY,
    lon: d.stationinfo.locationX,
    time: d.time * 1000,
    delay: d.delay === undefined ? null : d.delay * 1000,
    platform: d.platform || "?",
    canceled: d.canceled === 1,
  };
}
const intermediate = z.object({
  station: z.string(),
  stationinfo: station,
  scheduledDepartureTime: numeric.optional(),
  scheduledArrivalTime: numeric.optional(),
  departureDelay: numeric.optional(),
  departureCanceled: numeric.optional(),
  platform: z.string().optional(),
});
const journeyEvent = event.extend({
  stops: z.object({ stop: z.array(intermediate) }).optional(),
});
const connection = z.object({
  id: z.string(),
  departure: journeyEvent,
  arrival: journeyEvent,
  vias: z
    .object({
      via: z.array(
        z.object({ arrival: journeyEvent, departure: journeyEvent }),
      ),
    })
    .optional(),
  alerts: z
    .object({
      alert: z.array(
        z.object({
          header: z.string().optional(),
          description: z.string().optional(),
        }),
      ),
    })
    .optional(),
});
export function normalizeJourney(
  c: z.infer<typeof connection>,
  updatedAt: number,
): Journey {
  const vias = c.vias?.via || [];
  const from = [c.departure, ...vias.map((v) => v.departure)],
    to = [...vias.map((v) => v.arrival), c.arrival];
  const legs: Leg[] = from.map((d, i) => ({
    from: point(d),
    to: point(to[i]),
    vehicle: d.vehicle || "",
    line:
      d.vehicleinfo?.shortname ||
      d.vehicle?.replace("BE.NMBS.", "") ||
      "Wandelen",
    mode: d.walking === 1 ? "WALK" : "TRAIN",
    intermediate: (d.stops?.stop || []).map((s) =>
      point({
        station: s.station,
        stationinfo: s.stationinfo,
        time: s.scheduledDepartureTime || s.scheduledArrivalTime || d.time,
        delay: s.departureDelay,
        canceled: s.departureCanceled,
        platform: s.platform,
      }),
    ),
  }));
  return {
    id: `${c.departure.time}:${c.id}`,
    legs,
    duration: (c.arrival.time - c.departure.time) * 1000,
    transfers: vias.length,
    alerts:
      c.alerts?.alert.map((a) => a.header || a.description || "Reismelding") ||
      [],
    updatedAt,
  };
}
export const irail: TransportAdapter = {
  operator: "nmbs",
  async stops(signal) {
    const r = await cachedRequest(
      "stations",
      {},
      z.object({ station: z.array(station) }),
      signal,
    );
    return r.value.station
      .map(normalizeStop)
      .filter((s) => s.id.startsWith("BE.NMBS.0088"));
  },
  async departures(stop, signal): Promise<Board> {
    const r = await cachedRequest(
      "liveboard",
      { id: stop.id, alerts: "true" },
      z.object({
        timestamp: numeric,
        departures: z.object({ departure: z.array(departure) }).optional(),
      }),
      signal,
    );
    return {
      departures: (r.value.departures?.departure || []).map(normalizeDeparture),
      updatedAt: r.value.timestamp * 1000,
      offline: r.offline,
    };
  },
  async trip(id, date, signal): Promise<Trip> {
    const tripStop = event.extend({
      left: numeric.optional(),
      scheduledArrivalTime: numeric.optional(),
      scheduledDepartureTime: numeric.optional(),
      departureDelay: numeric.optional(),
      arrivalDelay: numeric.optional(),
      departureCanceled: numeric.optional(),
    });
    const r = await cachedRequest(
      "vehicle",
      { id, date, alerts: "true" },
      z.object({
        timestamp: numeric,
        vehicle: z.string(),
        vehicleinfo: z
          .object({ shortname: z.string() })
          .passthrough()
          .optional(),
        stops: z.object({ stop: z.array(tripStop) }),
      }),
      signal,
    );
    return {
      id: r.value.vehicle,
      line: r.value.vehicleinfo?.shortname || id.replace("BE.NMBS.", ""),
      stops: r.value.stops.stop.map((s) => ({
        ...point({
          ...s,
          time: s.scheduledDepartureTime || s.time,
          delay: s.departureDelay ?? s.delay,
          canceled: s.departureCanceled ?? s.canceled,
        }),
        left: s.left === 1,
        arrival: (s.scheduledArrivalTime || s.time) * 1000,
      })),
      updatedAt: r.value.timestamp * 1000,
      offline: r.offline,
      position: { kind: "unavailable" },
    };
  },
};
export async function railJourneys(
  from: Stop,
  to: Stop,
  when: Record<string, string>,
  signal?: AbortSignal,
) {
  const r = await cachedRequest(
    "connections",
    { from: from.id, to: to.id, ...when, results: "6", alerts: "true" },
    z.object({ timestamp: numeric, connection: z.array(connection) }),
    signal,
  );
  return r.value.connection.map((c) =>
    normalizeJourney(c, r.value.timestamp * 1000),
  );
}
export {
  station as stationSchema,
  departure as departureSchema,
  connection as connectionSchema,
};
