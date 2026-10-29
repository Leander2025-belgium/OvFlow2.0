import { vehicleStream } from "./vehicle";
/** Narrow proxy for De Lijn's public website data. No arbitrary URLs or credentials. */
export async function handleDeLijn(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/delijn/")) return null;
  if (request.method !== "GET")
    return Response.json(
      { error: "Alleen GET is toegestaan." },
      { status: 405 },
    );
  const route = url.pathname.slice("/api/delijn/".length);
  if (/^vehicle\/\d{1,12}$/.test(route)) return vehicleStream(route.split("/")[1], request);
  let upstream: URL;
  if (route === "search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2 || q.length > 120)
      return Response.json(
        { error: "Gebruik 2 tot 120 tekens." },
        { status: 400 },
      );
    upstream = new URL("https://www.delijn.be/api/new-search/");
    upstream.searchParams.set("q", q);
  } else if (/^departures\/\d{1,8}$/.test(route)) {
    upstream = new URL(
      `https://www.delijn.be/api/networktrips/stops/${route.split("/")[1]}/`,
    );
    upstream.searchParams.set("type", "MERGEFLEX");
    upstream.searchParams.set("detoursPolicy", "filterDetours");
    upstream.searchParams.set("enrichmentType", "LINEDIRECTIONS");
  } else if (/^pattern\/\d{1,12}$/.test(route)) {
    upstream = new URL("https://www.delijn.be/api/patterns/");
    upstream.searchParams.set("ids", route.split("/")[1]);
  } else if (/^trip\/\d{4}-\d{2}-\d{2}_\d+_\d+$/.test(route)) {
    upstream = new URL(
      `https://www.delijn.be/api/networktrips/${route.slice(5)}/`,
    );
    upstream.searchParams.set("type", "MERGEFLEX");
  } else
    return Response.json(
      { error: "Onbekend De Lijn-verzoek." },
      { status: 400 },
    );
  try {
    const result = await fetch(upstream, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok)
      return Response.json(
        {
          error:
            result.status === 429
              ? "De Lijn ontvangt te veel aanvragen. Probeer later opnieuw."
              : "De Lijn is tijdelijk niet beschikbaar.",
        },
        {
          status: result.status === 429 ? 429 : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    const contentType = result.headers.get("Content-Type") || "";
    if (!contentType.includes("json"))
      throw new Error("Unexpected provider response");
    // Respect upstream no-store: never persist these realtime payloads in an edge cache.
    return new Response(result.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "De Lijn antwoordt niet op tijd. Probeer opnieuw." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
