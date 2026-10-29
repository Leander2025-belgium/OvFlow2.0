import { describe, it, expect } from "vitest";
import {
  stationSchema,
  departureSchema,
  connectionSchema,
  normalizeStop,
  normalizeDeparture,
  normalizeJourney,
} from "../src/data/irail";
import {
  apiDateTime,
  distance,
  nearest,
  searchStops,
  serviceDate,
} from "../src/data/utils";
import { gtfsTime, serviceRuns } from "../server/gtfs";
import stations from "./fixtures/stations.json";
import board from "./fixtures/board.json";
import connections from "./fixtures/connections.json";
describe("iRail recorded response contract (real source snapshots, not production data)", () => {
  it("normalizes coordinates from provider strings", () => {
    const s = normalizeStop(stationSchema.parse(stations.station[0]));
    expect(typeof s.lat).toBe("number");
    expect(s.lon).toBeCloseTo(4.137662);
  });
  it("converts delay seconds and departure epoch exactly once", () => {
    const raw = board.departures.departure[0];
    const d = normalizeDeparture(departureSchema.parse(raw));
    expect(d.delay).toBe(Number(raw.delay) * 1000);
    expect(d.time).toBe(Number(raw.time) * 1000);
    expect(d.canceled).toBe(false);
  });
  it("distinguishes missing realtime from on-time reports", () => {
    const raw = { ...board.departures.departure[0], delay: undefined };
    expect(normalizeDeparture(departureSchema.parse(raw)).delay).toBeNull();
  });
  it("handles cancellation flags encoded as strings", () => {
    expect(
      normalizeDeparture(
        departureSchema.parse({
          ...board.departures.departure[0],
          canceled: "1",
        }),
      ).canceled,
    ).toBe(true);
  });
  it("retains transfer stations, intermediate stops and per-leg trains", () => {
    const c = connections.connection[0];
    const j = normalizeJourney(connectionSchema.parse(c), 0);
    expect(j.legs.length).toBe(2);
    expect(j.legs[0].from.name).toBe("Oostende");
    expect(j.legs[0].to.name).toBe(j.legs[1].from.name);
    expect(j.legs[1].to.name).toBe("Brussel-Centraal");
    expect(j.legs[0].vehicle).not.toBe(j.legs[1].vehicle);
    expect(j.legs[0].intermediate[0].name).toBe("Brugge");
  });
  it("rejects invalid coordinates instead of mapping imaginary positions", () => {
    expect(() =>
      stationSchema.parse({
        ...stations.station[0],
        locationX: "not-a-number",
      }),
    ).toThrow();
  });
});
describe("geography and search", () => {
  const stops = stations.station.map((s) =>
    normalizeStop(stationSchema.parse(s)),
  );
  it("returns exactly five stations ordered by straight-line distance", () => {
    const p = stops[0];
    const found = nearest(stops, p);
    expect(found).toHaveLength(5);
    expect(found[0].distance).toBe(0);
    expect(found[1].distance).toBeLessThanOrEqual(found[2].distance);
  });
  it("uses spherical coordinates in meters", () => {
    expect(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(
      111194.9,
      0,
    );
  });
  it("finds the French alias of a Dutch station", () => {
    expect(searchStops(stops, "Braine le Comte")[0].name).toBe(
      "'s Gravenbrakel",
    );
  });
});
describe("Belgian calendar and overnight service", () => {
  it("ignores device timezone when forming service dates", () => {
    expect(serviceDate(Date.parse("2026-10-26T23:30:00Z"))).toBe("271026");
  });
  it("rejects a nonexistent spring DST local time", () => {
    expect(() => apiDateTime("2026-03-29T02:30")).toThrow();
  });
  it("encodes winter and summer local search input", () => {
    expect(apiDateTime("2026-06-12T23:40")).toEqual({
      date: "120626",
      time: "2340",
    });
  });
  it("supports GTFS 25-hour trips across midnight", () => {
    expect(
      gtfsTime("20261026", "25:10:00") - gtfsTime("20261026", "23:10:00"),
    ).toBe(7200000);
  });
  it("uses the GTFS noon anchor during DST changes", () => {
    expect(new Date(gtfsTime("20260329", "12:00:00")).toISOString()).toBe(
      "2026-03-29T10:00:00.000Z",
    );
  });
  it("applies removal and addition calendar exceptions before weekdays", () => {
    const cal = [
      {
        service_id: "a",
        start_date: "20260101",
        end_date: "20261231",
        monday: "1",
      },
    ];
    expect(serviceRuns("a", "20261026", cal, [])).toBe(true);
    expect(
      serviceRuns("a", "20261026", cal, [
        { service_id: "a", date: "20261026", exception_type: "2" },
      ]),
    ).toBe(false);
    expect(
      serviceRuns(
        "b",
        "20261026",
        [],
        [{ service_id: "b", date: "20261026", exception_type: "1" }],
      ),
    ).toBe(true);
  });
});
