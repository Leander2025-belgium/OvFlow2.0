import { appUpdate } from "./app-update";
import { handlePlanner } from "./planner";
import { handleDeLijn } from "./delijn";
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}
export default {
  async fetch(request: Request, env: Env) {
    const response = appUpdate(request) || await handlePlanner(request) || await handleDeLijn(request);
    if (response) return response;
    if (new URL(request.url).pathname.startsWith("/api/"))
      return Response.json({ error: "Onbekend endpoint" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
