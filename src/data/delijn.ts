import { z } from "zod";
import type { Board, Departure, Stop, TransportAdapter, Trip } from "./types";
const epoch = z.number().finite().positive();
const stopSchema = z.object({
  id: z.string(),
  longDescription: z.string(),
  coordinate: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});
const passage = z.object({
  id: z.string(),
  plannedPassage: z.object({
    departureEpoch: epoch.optional(),
    arrivalEpoch: epoch.optional(),
  }),
  realtimePassage: z
    .object({
      departureEpoch: epoch.optional(),
      arrivalEpoch: epoch.optional(),
    })
    .optional(),
  realtimeStatuses: z.array(z.string()).default([]),
  lastStop: z.boolean().optional(),
  merged: z.boolean().optional(),
  passageStatus: z.string().optional(),
  scheduleType: z.string().optional(),
  isDeleted: z.boolean().optional(),
  isNotServed: z.boolean().optional(),
});
const boardTrip = z.object({
  id: z.string(),
  exploitationDate: z.string(),
  destinationShort: z.string().optional(),
  planningDestination: z.string().optional(),
  placeDestination: z.string().optional(),
  lineDirection: z.object({
    destination: z.string().optional(),
    line: z.object({
      publicLineNr: z.string(),
      transportType: z.string().optional(),
    }),
  }),
  passages: z.array(passage),
});
export const delijnBoardSchema = z.object({
  serverDateTime: epoch,
  trips: z.array(boardTrip),
});
export function normalizeDeLijnBoard(input: unknown): Board {
  const data = delijnBoardSchema.parse(input);
  const departures: Departure[] = [];
  for (const t of data.trips)
    for (const p of t.passages) {
      // Arrival at a terminus and NOBOARDING passages are not usable departures.
      if (
        p.lastStop ||
        p.realtimeStatuses.includes("NOBOARDING") ||
        p.plannedPassage.departureEpoch === undefined
      )
        continue;
      const time = p.plannedPassage.departureEpoch;
      const measured = p.realtimeStatuses.includes("REALTIME")
        ? p.realtimePassage?.departureEpoch
        : undefined;
      departures.push({
        id: `delijn:${p.id}`,
        vehicle: `delijn:${t.id}`,
        line: t.lineDirection.line.publicLineNr,
        destination:
          t.lineDirection.destination ||
          t.destinationShort ||
          t.planningDestination ||
          t.placeDestination ||
          "Bestemming onbekend",
        time,
        delay: measured === undefined ? null : measured - time,
        canceled:
          !!p.isDeleted ||
          !!p.isNotServed ||
          p.scheduleType === "NOT_SERVED" ||
          (p.merged
            ? p.realtimeStatuses.includes("DELETED")
            : p.passageStatus === "CANCELLED"),
        left: p.realtimeStatuses.includes("DEPARTED"),
        platform: "",
        serviceDate: t.exploitationDate,
        mode: t.lineDirection.line.transportType === "TRAM" ? "TRAM" : "BUS",
      });
    }
  return {
    departures: departures.sort(
      (a, b) => a.time + (a.delay ?? 0) - (b.time + (b.delay ?? 0)),
    ),
    updatedAt: data.serverDateTime,
  };
}
export const delijnTripSchema = z.object({
  id: z.string(),
  nr: z.string(),
  patternId: z.string().optional(),
  vehicleId: z.string().optional(),
  isEnded: z.boolean().optional(),
  isStarted: z.boolean().optional(),
  serverDateTime: epoch,
  isDeleted: z.boolean().optional(),
  lineDirection: z
    .object({ line: z.object({ publicLineNr: z.string().optional() }) })
    .optional(),
  passages: z.array(
    z.object({
      stop: stopSchema,
      plannedPassageTime: z.object({ epoch }),
      realtimePassageTime: z.object({ epoch }).optional(),
      isRealtime: z.boolean().optional(),
      isPassed: z.boolean().optional(),
      isDeleted: z.boolean().optional(),
      isNotServed: z.boolean().optional(),
    }),
  ),
});
export function normalizeDeLijnTrip(input: unknown): Trip {
  const d = delijnTripSchema.parse(input);
  return {
    id: `delijn:${d.id}`,
    vehicleId: d.vehicleId,
    isEnded: d.isEnded,
    isStarted: d.isStarted,
    line: d.lineDirection?.line.publicLineNr || `Rit ${d.nr}`,
    updatedAt: d.serverDateTime,
    position: { kind: "unavailable" },
    stops: d.passages.map((p) => ({
      id: `delijn:${p.stop.id}`,
      name: p.stop.longDescription,
      lat: p.stop.coordinate.latitude,
      lon: p.stop.coordinate.longitude,
      time: p.plannedPassageTime.epoch,
      arrival: p.plannedPassageTime.epoch,
      delay:
        p.isRealtime && p.realtimePassageTime
          ? p.realtimePassageTime.epoch - p.plannedPassageTime.epoch
          : null,
      platform: p.stop.id,
      canceled: !!d.isDeleted || !!p.isDeleted || !!p.isNotServed,
      left: !!p.isPassed,
    })),
  };
}
async function request(path: string, signal?: AbortSignal) {
  if (!navigator.onLine)
    throw new Error(
      "De Lijn-vertrekken hebben internet nodig. Er worden geen opgeslagen tijden als live getoond.",
    );
  const r = await fetch(`/api/delijn/${path}`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(18000)])
      : AbortSignal.timeout(18000),
    cache: "no-store",
  });
  if (!r.ok)
    throw new Error(
      r.status === 429
        ? "De Lijn is druk. Probeer later opnieuw."
        : "De Lijn-gegevens zijn tijdelijk niet beschikbaar. Probeer opnieuw.",
    );
  return r.json() as Promise<unknown>;
}
export const delijn: TransportAdapter = {
  operator: "delijn",
  async stops(signal) {
    const r = await fetch("/data/delijn-stops.json", { signal });
    if (!r.ok) throw new Error("De Lijn-haltelijst kon niet worden geladen.");
    const data = z
      .object({
        stops: z.array(
          z.tuple([z.string(), z.string(), z.number(), z.number(), z.string()]),
        ),
      })
      .parse(await r.json());
    return data.stops.map(([id, name, lat, lon, city]) => ({
      id: `delijn:${id}`,
      name,
      aliases: [id, city],
      lat,
      lon,
      operator: "delijn",
    }));
  },
  async departures(stop, signal) {
    return normalizeDeLijnBoard(
      await request(
        `departures/${encodeURIComponent(stop.id.replace(/^delijn:/, ""))}`,
        signal,
      ),
    );
  },
  async trip(id, _date, signal) {
    const raw = await request(`trip/${encodeURIComponent(id.replace(/^delijn:/, ""))}`, signal);
    const trip = normalizeDeLijnTrip(raw);
    const patternId = delijnTripSchema.parse(raw).patternId;
    if (patternId && /^\d{1,12}$/.test(patternId)) {
      try {
        const patterns = z.array(z.object({ id: z.string(), pattern: z.object({ type: z.literal("LineString"), coordinates: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])) }) })).parse(await request(`pattern/${patternId}`, signal));
        trip.routePoints = patterns.find(p => p.id === patternId)?.pattern.coordinates.map(([lat, lon]) => ({ lat, lon }));
      } catch (e) { if (signal?.aborted) throw e; /* Keep times usable; never invent a line. */ }
    }
    return trip;
  },
};
export async function searchDeLijn(
  query: string,
  signal?: AbortSignal,
): Promise<Stop[]> {
  const raw = await request(`search?q=${encodeURIComponent(query)}`, signal);
  const entry = z.object({
    id: z.string(),
    longDescription: z.string(),
    coordinate: z.string(),
    cityDescription: z.string().optional(),
    status: z.string().optional(),
  });
  const schema = z.object({
    stops: z.object({
      results: z.array(
        z.object({ stops: z.array(entry).optional() }).passthrough(),
      ),
    }),
  });
  const d = schema.parse(raw);
  const unique = new Map<string, Stop>();
  for (const group of d.stops.results)
    for (const stop of group.stops || []) {
      if (stop.status && stop.status !== "ACTIVE") continue;
      const [lat, lon] = stop.coordinate.split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      unique.set(stop.id, {
        id: `delijn:${stop.id}`,
        name: stop.longDescription,
        lat,
        lon,
        aliases: [stop.id, stop.cityDescription || ""],
        operator: "delijn",
      });
    }
  return [...unique.values()];
}
