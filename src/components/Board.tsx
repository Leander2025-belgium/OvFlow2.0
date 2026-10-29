import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  TrainFront,
  BusFront,
  RefreshCw,
  Star,
  WifiOff,
} from "lucide-react";
import { adapterFor } from "../data/adapters";
import { operators } from "../data/types";
import { clockTime, distanceLabel, serviceDate } from "../data/utils";
import { useStore } from "../store";
import type { Stop } from "../data/types";
export default function Board({
  stop,
  compact = false,
  distance,
  onOpen,
}: {
  stop: Stop;
  compact?: boolean;
  distance?: number;
  onOpen?: (s: Stop) => void;
}) {
  const state = useStore();
  const [line, setLine] = useState("");
  useEffect(() => setLine(""), [stop.id]);
  const q = useQuery({
    queryKey: ["board", stop.id],
    queryFn: ({ signal }) => adapterFor(stop.operator).departures(stop, signal),
    refetchInterval: 60000,
  });
  const now = Date.now(),
    stale = !!q.data && (q.data.offline || now - q.data.updatedAt > 180000);
  const rows = (q.data?.departures || [])
    .filter(
      (d) =>
        (!line || d.line === line) &&
        !d.left &&
        (stale || d.time + (d.delay || 0) > now - 60000),
    )
    .slice(0, compact ? 2 : 60);
  return (
    <article className={"stop-card " + (compact ? "" : "full-board")}>
      <header>
        <div className="station-icon">
          {stop.operator === "delijn" ? (
            <BusFront size={21} />
          ) : (
            <TrainFront size={21} />
          )}
        </div>
        <div className="grow">
          <button
            className="text-button station-name"
            onClick={() => onOpen?.(stop)}
            disabled={!onOpen}
          >
            {stop.name}
          </button>
          <p>
            {operators[stop.operator].name}
            {distance !== undefined && (
              <> · {distanceLabel(distance)} hemelsbreed</>
            )}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label={
            state.favorites.some((s) => s.id === stop.id)
              ? "Verwijder favoriet"
              : "Bewaar favoriet"
          }
          onClick={() => state.toggleFavorite(stop)}
        >
          <Star
            size={18}
            fill={
              state.favorites.some((s) => s.id === stop.id)
                ? "currentColor"
                : "none"
            }
          />
        </button>
      </header>
      {q.isPending && <div className="loading">Vertrekken ophalen…</div>}
      {q.error && (
        <div className="notice error">
          {q.error.message} <button onClick={() => q.refetch()}>Opnieuw</button>
        </div>
      )}
      {stale && (
        <p className="notice">
          <WifiOff size={15} /> Opgeslagen gegevens · mogelijk verouderd (
          {clockTime(q.data!.updatedAt)})
        </p>
      )}
      {!compact && stop.operator === "delijn" && q.data && (
        <label className="line-filter">
          Kies je lijn
          <select
            aria-label="Filter op lijn"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            <option value="">Alle lijnen</option>
            {[...new Set(q.data.departures.map((d) => d.line))]
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((n) => (
                <option key={n} value={n}>
                  Lijn {n}
                </option>
              ))}
          </select>
        </label>
      )}
      {rows.map((d) => (
        <button
          className="departure"
          key={d.id}
          onClick={() => {
            state.set({
              activeTrip: {
                id: d.vehicle,
                date: d.serviceDate || serviceDate(d.time),
                line: d.line,
                boardingStopId: stop.id,
              },
            });
            state.setPage("live");
          }}
        >
          <span
            className={
              "line-badge " + (stop.operator === "delijn" ? "delijn-badge" : "")
            }
          >
            {d.line}
          </span>
          <span className="destination">
            {d.destination}
            <small>
              {d.canceled
                ? "Afgeschaft"
                : stop.operator === "delijn"
                  ? `Halte ${stop.id.replace("delijn:", "")}`
                  : `Spoor ${d.platform}`}
            </small>
          </span>
          <span className={"departure-time " + (d.canceled ? "canceled" : "")}>
            {clockTime(d.time)}
            <small className={d.delay && d.delay > 0 ? "delay" : ""}>
              {d.canceled
                ? "Rijdt niet"
                : d.delay === null
                  ? "Gepland"
                  : d.delay < 0
                    ? `${Math.floor(d.delay / 60000)} min`
                    : d.delay > 0
                      ? `+${Math.ceil(d.delay / 60000)} min`
                      : "Volgens bron op tijd"}
            </small>
          </span>
        </button>
      ))}
      {q.data && !rows.length && (
        <p className="empty-small">Geen volgende vertrekken gemeld.</p>
      )}
      <footer>
        <span className="muted">
          {q.data
            ? `Bronupdate ${clockTime(q.data.updatedAt)}`
            : `Bron: ${stop.operator === "delijn" ? "De Lijn" : "iRail"}`}
        </span>
        {compact ? (
          <button className="link-button" onClick={() => onOpen?.(stop)}>
            Alle vertrekken <ArrowUpRight size={15} />
          </button>
        ) : (
          <button
            className="link-button"
            disabled={q.isFetching}
            onClick={() => q.refetch()}
          >
            <RefreshCw size={15} /> Verversen
          </button>
        )}
      </footer>
    </article>
  );
}
