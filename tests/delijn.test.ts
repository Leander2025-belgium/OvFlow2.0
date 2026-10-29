import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeDeLijnBoard,
  normalizeDeLijnTrip,
  delijnBoardSchema,
} from "../src/data/delijn";
import { handleDeLijn } from "../worker/delijn";
import rawBoard from "./fixtures/delijn-board.json";
import rawTerminus from "./fixtures/delijn-terminus.json";
import trip from "./fixtures/delijn-trip.json";
// Real provider captures. Inputs are intentionally mutated only inside regression tests.
const board = delijnBoardSchema.parse(rawBoard),
  terminus = delijnBoardSchema.parse(rawTerminus);
const recorded = { ...board, serverDateTime: 1793106860983 };
describe("De Lijn provider contract", () => {
  it("preserves source departure timestamps, public line and measured delay", () => {
    const d = normalizeDeLijnBoard(recorded).departures[0];
    const p = board.trips[0].passages[0];
    expect(d.line).toBe("22");
    expect(d.time).toBe(p.plannedPassage.departureEpoch);
    expect(d.delay).toBe(
      p.realtimePassage!.departureEpoch! - p.plannedPassage.departureEpoch!,
    );
    expect(d.vehicle).toBe("delijn:" + board.trips[0].id);
  });
  it("never turns a terminus arrival or NOBOARDING into a departure", () => {
    const output = normalizeDeLijnBoard(terminus);
    const excluded = terminus.trips.flatMap((t) =>
      t.passages
        .filter((p) => p.lastStop || p.realtimeStatuses?.includes("NOBOARDING"))
        .map((p) => "delijn:" + p.id),
    );
    expect(excluded.length).toBeGreaterThan(0);
    expect(output.departures.some((d) => excluded.includes(d.id))).toBe(false);
  });
  it("keeps scheduled-only information distinct from zero delay", () => {
    const data = structuredClone(recorded);
    data.trips[0].passages[0].realtimeStatuses = [];
    expect(
      normalizeDeLijnBoard(data).departures.find(
        (d) => d.id === "delijn:" + data.trips[0].passages[0].id,
      )?.delay,
    ).toBeNull();
  });
  it("interprets actual cancellation and departed status codes", () => {
    const data = structuredClone(recorded);
    const p = data.trips[0].passages[0];
    p.merged = false;
    p.passageStatus = "CANCELLED";
    expect(
      normalizeDeLijnBoard(data).departures.find(
        (d) => d.id === "delijn:" + p.id,
      )?.canceled,
    ).toBe(true);
    p.merged = true;
    p.realtimeStatuses = ["DELETED", "DEPARTED"];
    const d = normalizeDeLijnBoard(data).departures.find(
      (d) => d.id === "delijn:" + p.id,
    );
    expect(d?.canceled).toBe(true);
    expect(d?.left).toBe(true);
  });
  it("preserves service day for after-midnight trips", () => {
    const d = normalizeDeLijnBoard(recorded).departures[0];
    expect(d.serviceDate).toBe(board.trips[0].exploitationDate);
  });
  it("exposes full ordered stop sequence without simulated GPS", () => {
    const t = normalizeDeLijnTrip(trip);
    expect(t.stops.length).toBe(trip.passages.length);
    expect(t.position.kind).toBe("unavailable");
    expect(t.stops[0].id).toBe("delijn:" + trip.passages[0].stop.id);
    expect(t.stops[0].left).toBe(trip.passages[0].isPassed);
  });
  it("shows an unserved stop as canceled", () => {
    const t = structuredClone(trip);
    t.passages[0].isNotServed = true;
    expect(normalizeDeLijnTrip(t).stops[0].canceled).toBe(true);
  });
  it("rejects changed or invalid upstream schema", () => {
    expect(() => normalizeDeLijnBoard({ trips: "broken" })).toThrow();
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("production De Lijn proxy", () => {
  it("only allows expected paths and never forwards arbitrary URLs", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await handleDeLijn(
      new Request("https://ovflow.test/api/delijn/https://evil.test"),
    );
    expect(r?.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("uses a fixed public origin and preserves no-store", async () => {
    const f = vi.fn().mockResolvedValue(Response.json(recorded));
    vi.stubGlobal("fetch", f);
    const r = await handleDeLijn(
      new Request("https://ovflow.test/api/delijn/departures/101026"),
    );
    expect(r?.status).toBe(200);
    expect(r?.headers.get("Cache-Control")).toBe("no-store");
    expect(String(f.mock.calls[0][0])).toContain(
      "https://www.delijn.be/api/networktrips/stops/101026/",
    );
  });
  it("reports upstream failure without returning empty invented departures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    const r = await handleDeLijn(
      new Request("https://ovflow.test/api/delijn/departures/101026"),
    );
    expect(r?.status).toBe(502);
    expect(await r?.json()).toHaveProperty("error");
  });
});
