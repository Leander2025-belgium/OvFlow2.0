import { z } from 'zod';
const location = z.object({ lt: z.number().min(49).max(52), ln: z.number().min(2).max(7) });
const input = z.object({ origin: location, destination: location, originName: z.string().max(150), destinationName: z.string().max(150), at: z.string().datetime({ offset: true }).optional(), arrival: z.boolean().optional() });
export async function handlePlanner(request: Request): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/journeys') return null;
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return Response.json({ error: 'Alleen POST is toegestaan.' }, { status: 405, headers });
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({ error: 'Ongeldige zoekopdracht.' }, { status: 400, headers });
    const parsed = input.safeParse(JSON.parse(text));
    if (!parsed.success) return Response.json({ error: 'Kies geldige vertrek- en aankomsthaltes.' }, { status: 400, headers });
    const p = parsed.data;
    const result = await fetch('https://www.delijn.be/api/here/routes/', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ origin: p.origin, destination: p.destination, originName: p.originName, destinationName: p.destinationName, [p.arrival ? 'arrivalTime' : 'departureTime']: p.at || new Date().toISOString(), modes: ['bus', 'lightRail', 'subway', 'regionalTrain', 'intercityTrain', 'highSpeedTrain', 'cityTrain'], alternatives: 3, lang: 'nl', taxiEnable: [], rentedEnable: [] }),
      signal: AbortSignal.timeout(25000),
    });
    if (!result.ok || !result.headers.get('content-type')?.includes('json')) return Response.json({ error: 'De routeplanner is tijdelijk niet beschikbaar. Probeer opnieuw.' }, { status: result.status === 429 ? 429 : 502, headers });
    return new Response(result.body, { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch { return Response.json({ error: 'De routeplanner kon de reis niet berekenen. Probeer opnieuw.' }, { status: 502, headers }); }
}
