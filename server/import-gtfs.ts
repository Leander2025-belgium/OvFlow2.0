import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { finished as streamFinished } from "node:stream/promises";
import { parse } from "csv-parse";
import { spawn } from "node:child_process";
import path from "node:path";
// Import trusted operator GTFS archives only. unzip streams each table to bound RAM usage.
const [operator, zip] = process.argv.slice(2);
if (!["nmbs", "delijn", "stib", "tec"].includes(operator) || !zip) {
  console.error(
    "Usage: npm run import:gtfs -- <nmbs|delijn|stib|tec> /absolute/feed.zip",
  );
  process.exit(1);
}
const root = path.resolve(process.env.GTFS_DATA_DIR || "data"),
  temp = path.join(root, operator + ".importing");
await mkdir(temp, { recursive: true });
for (const name of [
  "agency",
  "stops",
  "routes",
  "trips",
  "stop_times",
  "calendar",
  "calendar_dates",
  "shapes",
]) {
  const child = spawn("unzip", ["-p", path.resolve(zip), name + ".txt"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostic = "";
  child.stderr.on("data", (b) => {
    diagnostic = (diagnostic + String(b)).slice(0, 300);
  });
  const finished = new Promise<number | null>((resolve, reject) => {
    child.on("exit", resolve);
    child.on("error", reject);
  });
  const output = createWriteStream(path.join(temp, name + ".ndjson"));
  const records = child.stdout.pipe(
    parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_quotes: false,
    }),
  );
  let count = 0;
  try {
    for await (const row of records) {
      if (!output.write(JSON.stringify(row) + "\n"))
        await new Promise<void>((r) => output.once("drain", r));
      count++;
    }
    output.end();
    await streamFinished(output);
    const code = await finished;
    if (code !== 0 && !["calendar", "calendar_dates", "shapes"].includes(name))
      throw new Error(diagnostic);
    console.log(`${name}: ${count} rows`);
  } catch (error) {
    child.kill();
    output.destroy();
    throw error;
  }
}
// An import uses an isolated directory; never overwrite the active data on a failed extraction.
const target = path.join(root, operator),
  old = target + ".previous";
await rm(old, { recursive: true, force: true });
try {
  await rename(target, old);
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
await rename(temp, target);
console.log(
  `Imported ${operator} to ${target}. Keep the original ZIP for OpenTripPlanner.`,
);
