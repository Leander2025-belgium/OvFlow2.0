import express from "express";
import cors from "cors";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
const app = express();
app.disable("x-powered-by");
app.use(
  cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }),
);
app.use(express.json({ limit: "32kb" }));
const cache = new Map<string, { until: number; value: unknown }>(),
  pending = new Map<string, Promise<unknown>>();
let queue = Promise.resolve(),
  next = 0;
async function json(
  url: URL,
  ttl: number,
  headers: Record<string, string> = {},
) {
  const key = url.href,
    hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const slot = queue.then(async () => {
      await new Promise((r) => setTimeout(r, Math.max(0, next - Date.now())));
      next = Date.now() + 400;
    });
    queue = slot.catch(() => {});
    await slot;
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Object.assign(new Error("Upstream data unavailable"), {
        status: response.status,
      });
    const value: unknown = await response.json();
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { value, until: Date.now() + ttl });
    return value;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    routing: process.env.OTP_URL ? "configured-unverified" : "not-configured",
    authentication: "local-only",
  }),
);
app.get("/api/irail/:endpoint", async (req, res, nextError) => {
  try {
    const endpoint = z
      .enum(["stations", "liveboard", "connections", "vehicle"])
      .parse(req.params.endpoint);
    const url = new URL(`https://api.irail.be/v1/${endpoint}`);
    const allowed = [
      "id",
      "from",
      "to",
      "date",
      "time",
      "timesel",
      "lang",
      "results",
      "alerts",
      "format",
    ];
    for (const [k, v] of Object.entries(req.query)) {
      if (allowed.includes(k) && typeof v === "string" && v.length < 150)
        url.searchParams.set(k, v);
    }
    url.searchParams.set("format", "json");
    res.set(
      "Cache-Control",
      `private, max-age=${endpoint === "stations" ? 86400 : 60}`,
    );
    res.json(await json(url, endpoint === "stations" ? 86400000 : 60000));
  } catch (e) {
    nextError(e);
  }
});
app.get("/api/operators/:operator/stops", async (req, res, nextError) => {
  try {
    const op = z
      .enum(["nmbs", "delijn", "stib", "tec"])
      .parse(req.params.operator);
    const result = [];
    const lines = createInterface({
      input: createReadStream(
        path.resolve(process.env.GTFS_DATA_DIR || "data", op, "stops.ndjson"),
      ),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      const r = JSON.parse(line);
      const lat = Number(r.stop_lat),
        lon = Number(r.stop_lon);
      if (Number.isFinite(lat) && Number.isFinite(lon))
        result.push({
          id: `${op}:${r.stop_id}`,
          name: r.stop_name,
          lat,
          lon,
          aliases: [r.stop_name],
          operator: op,
        });
    }
    res.json(result);
  } catch (e) {
    nextError(e);
  }
});
// Deliberately not an arbitrary URL proxy: routing endpoint is operator-controlled configuration.
app.post("/api/plan", async (req, res, nextError) => {
  try {
    if (!process.env.OTP_URL) {
      res
        .status(503)
        .json({
          error:
            "OpenTripPlanner is not configured. Rail-only mode remains available.",
        });
      return;
    }
    const coordinate = z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    });
    const input = z
      .object({
        from: coordinate,
        to: coordinate,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        arriveBy: z.boolean().default(false),
        wheelchair: z.boolean().default(false),
      })
      .parse(req.body);
    const query = `query($from:InputCoordinates!,$to:InputCoordinates!,$date:String!,$time:String!,$arriveBy:Boolean!,$wheelchair:Boolean!){plan(from:$from,to:$to,date:$date,time:$time,arriveBy:$arriveBy,wheelchair:$wheelchair,numItineraries:5,transportModes:[{mode:WALK},{mode:TRANSIT}]){itineraries{duration startTime endTime walkDistance legs{mode startTime endTime realTime departureDelay arrivalDelay from{name lat lon stop{gtfsId}} to{name lat lon stop{gtfsId}} route{gtfsId shortName longName} trip{gtfsId} legGeometry{points}}}}}`;
    const upstream = await fetch(process.env.OTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: input }),
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) throw new Error("Router unavailable");
    const body = await upstream.json();
    if (body.errors) {
      res
        .status(502)
        .json({
          error: "Router schema or routing error; check OTP compatibility.",
        });
      return;
    }
    res.json(body.data.plan);
  } catch (e) {
    nextError(e);
  }
});
app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      err instanceof z.ZodError
        ? 400
        : err.code === "ENOENT"
          ? 503
          : err.status === 429
            ? 429
            : 502;
    res
      .status(status)
      .json({
        error:
          status === 400
            ? "Invalid request"
            : status === 503
              ? "This operator feed has not been imported"
              : status === 429
                ? "Data provider rate limit reached"
                : "Transport data temporarily unavailable",
      });
  },
);
app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("OVFlow gateway: http://127.0.0.1:" + (process.env.PORT || 3001)),
);
