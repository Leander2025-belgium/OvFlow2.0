import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BusFront,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Home,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  Route,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  TrainFront,
  User,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { delijn } from "./data/delijn";
import { adapterFor, operatorForTrip } from "./data/adapters";
import { DateTime } from "luxon";
import { planJourney } from "./data/planner";
import { irail } from "./data/irail";
import {
  clockTime,
  dateLabel,
  inputNow,
  nearest,
  serviceDate,
} from "./data/utils";
import type { Journey, Stop } from "./data/types";
import { operators } from "./data/types";
import Search from "./components/Search";
import Board from "./components/Board";
import RideControls from "./components/RideControls";
import { savedPlan } from "./data/rides";
import { useVehiclePosition } from "./data/vehicle";
const TransitMap = lazy(() => import("./components/TransitMap"));
const nav = [
  { key: "home", label: "Home", icon: Home },
  { key: "routes", label: "Routes", icon: Route },
  { key: "discover", label: "Ontdekken", icon: Compass },
  { key: "live", label: "Live", icon: Radio },
  { key: "profile", label: "Profiel", icon: User },
] as const;
function MapView(props: React.ComponentProps<typeof TransitMap>) {
  return (
    <Suspense fallback={<div className="map-placeholder">Kaart laden…</div>}>
      <TransitMap {...props} />
    </Suspense>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-top">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Sluiten" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const off = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return off;
  }, []);
  const s = useStore(),
    [board, setBoard] = useState<Stop | null>(null),
    [locationDialog, setLocationDialog] = useState(false),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [from, setFrom] = useState<Stop | null>(null),
    [to, setTo] = useState<Stop | null>(null),
    [discoverStop, setDiscoverStop] = useState<Stop | null>(null);
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: ({ signal }) => irail.stops(signal),
    staleTime: 86400000,
  });
  const busStops = useQuery({
    queryKey: ["delijn-stops"],
    queryFn: ({ signal }) => delijn.stops(signal),
    staleTime: 86400000,
  });
  const stops = useMemo(
    () => [...(stations.data || []), ...(busStops.data || [])],
    [stations.data, busStops.data],
  );

  const [operator, setOperator] = useState<"all" | "nmbs" | "delijn">("all");
  const visibleStops = useMemo(
    () =>
      operator === "all" ? stops : stops.filter((s) => s.operator === operator),
    [stops, operator],
  );
  const closeStops = useMemo(
    () => (s.location ? nearest(stops, s.location) : []),
    [stops, s.location],
  );
  useEffect(() => {
    setBoard(null);
  }, [s.page]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () =>
      (document.documentElement.dataset.theme =
        s.theme === "system" ? (media.matches ? "dark" : "light") : s.theme);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [s.theme]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!from && closeStops.length)
      setFrom(closeStops.find((s) => s.operator === "nmbs") || null);
  }, [closeStops]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (stops.length && q.has("from") && q.has("to")) {
      setFrom(stops.find((s) => s.id === q.get("from")) || null);
      setTo(stops.find((s) => s.id === q.get("to")) || null);
      s.setPage("routes");
    }
  }, [stops]);
  function locate() {
    if (!navigator.geolocation) {
      setMessage(
        "Deze browser ondersteunt geen locatie. Kies handmatig een station.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        s.set({
          location: {
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            label: "Mijn locatie",
          },
        });
        setLocationDialog(false);
      },
      () => {
        setMessage(
          "Locatie niet beschikbaar. Je kunt hieronder handmatig een station als vertrekgebied kiezen.",
        );
        setLocationDialog(true);
      },
      { timeout: 12000, maximumAge: 60000 },
    );
  }
  const openBoard = (stop: Stop) => setBoard(stop);
  if (!hydrated)
    return <div className="loading">Je lokale voorkeuren laden…</div>;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            s.setPage("home");
          }}
        >
          <img src="/icon.svg" alt="" />
          OVFlow<span>BE</span>
        </a>
        <p className="sidebar-caption">JOUW DAG. JOUW RICHTING.</p>
        <nav aria-label="Hoofdnavigatie">
          {nav.map((n) => (
            <button
              key={n.key}
              className={s.page === n.key ? "active" : ""}
              onClick={() => s.setPage(n.key)}
              aria-current={s.page === n.key ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {s.page === n.key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={19} />
            <div>
              Helemaal jouw reis
              <small>Je voorkeuren blijven op dit apparaat.</small>
            </div>
          </div>
          <button
            className="profile-button"
            onClick={() => s.setPage("profile")}
          >
            <span className="avatar">
              {s.name ? s.name[0].toUpperCase() : <User size={19} />}
            </span>
            <span>
              {s.name || "Mijn profiel"}
              <small>Lokaal profiel</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="location-button"
            onClick={() => setLocationDialog(true)}
          >
            <MapPin size={16} />
            {s.location?.label || "Kies je vertrekgebied"}
            <ChevronRight size={14} />
          </button>
          <div className="topbar-right">
            <span className={"connection " + (!online ? "offline" : "")}>
              {online ? <span className="status-dot" /> : <WifiOff size={13} />}{" "}
              {online ? "Online" : "Offline"}
            </span>
            <button
              className="icon-button"
              aria-label="Meldingen"
              onClick={() =>
                setMessage(
                  "Reismeldingen verschijnen bij je gekozen route wanneer de bron ze levert. Achtergrondnotificaties zijn nog niet aangesloten.",
                )
              }
            >
              <Bell size={19} />
            </button>
            <button
              className="avatar small"
              aria-label="Mijn profiel"
              onClick={() => s.setPage("profile")}
            >
              {s.name ? s.name[0].toUpperCase() : <User size={17} />}
            </button>
          </div>
        </header>
        <main>
          {!online && (
            <div className="notice">
              <WifiOff size={16} />
              Je bent offline. Opgeslagen vertrekken kunnen verouderd zijn.
            </div>
          )}
          {busStops.error && (
            <div className="notice error">
              De Lijn-haltes konden niet geladen worden.{" "}
              <button onClick={() => busStops.refetch()}>Opnieuw</button>
            </div>
          )}
          {stations.error && (
            <div className="notice error">
              {stations.error.message}
              <button onClick={() => stations.refetch()}>
                Opnieuw proberen
              </button>
            </div>
          )}
          {s.page === "home" && (
            <>
              <div className="greeting">
                <div>
                  <p className="eyebrow">
                    <Sun size={15} />{" "}
                    {new Intl.DateTimeFormat("nl-BE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "Europe/Brussels",
                    }).format(new Date())}
                  </p>
                  <h1>
                    Goed op weg{s.name ? `, ${s.name}` : ""}
                    <span className="green">.</span>
                  </h1>
                  <p>Waar brengt vandaag je naartoe?</p>
                </div>
                <div className="edition">
                  <span>MADE FOR</span>België <i>● ● ●</i>
                </div>
              </div>
              <div className="dashboard-grid">
                <div className="main-column">
                  <section className="planner-card">
                    <div className="section-head">
                      <h2>Plan je volgende reis</h2>
                      <span className="subtle-badge">
                        <TrainFront size={14} /> Trein + bus
                      </span>
                    </div>
                    <div className="compact-fields">
                      <Search
                        stops={stops}
                        value={from}
                        onChange={setFrom}
                        label="Van"
                        placeholder="Je vertrekstation"
                      />
                      <button
                        className="swap"
                        aria-label="Vertrek en bestemming omwisselen"
                        onClick={() => {
                          setFrom(to);
                          setTo(from);
                        }}
                      >
                        <ArrowDownUp size={18} />
                      </button>
                      <Search
                        stops={stops}
                        value={to}
                        onChange={setTo}
                        label="Naar"
                        placeholder="Waar wil je naartoe?"
                      />
                    </div>
                    <div className="planner-bottom">
                      <span>
                        <Clock size={16} /> Vertrek nu
                      </span>
                      <button
                        className="primary"
                        onClick={() => s.setPage("routes")}
                      >
                        Vind mijn route <ArrowRight size={17} />
                      </button>
                    </div>
                  </section>
                  <div className="section-head spaced">
                    <h2>Jouw vaste plekken</h2>
                    <button
                      className="link-button"
                      onClick={() => s.setPage("profile")}
                    >
                      Beheren <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="favorites">
                    {s.favorites.length ? (
                      s.favorites.slice(0, 4).map((stop) => (
                        <button
                          className="favorite"
                          key={stop.id}
                          onClick={() => openBoard(stop)}
                        >
                          <span className="favorite-icon">
                            <Star size={20} />
                          </span>
                          <strong>{stop.name}</strong>
                          <small>Bekijk vertrekken</small>
                        </button>
                      ))
                    ) : (
                      <>
                        <button
                          className="favorite"
                          onClick={() => s.setPage("discover")}
                        >
                          <span className="favorite-icon">
                            <Star size={20} />
                          </span>
                          <strong>Bewaar een halte</strong>
                          <small>Altijd binnen handbereik</small>
                        </button>
                        <button
                          className="favorite"
                          onClick={() => setLocationDialog(true)}
                        >
                          <span className="favorite-icon blue">
                            <Home size={20} />
                          </span>
                          <strong>Jouw vertrekgebied</strong>
                          <small>
                            {s.location?.label || "Stel een locatie in"}
                          </small>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="section-head spaced">
                    <div>
                      <h2>Haltes in de buurt</h2>
                      <p>
                        De vijf dichtstbijzijnde haltes · NMBS & De Lijn ·
                        hemelsbreed
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Gebruik mijn locatie"
                      onClick={locate}
                    >
                      <LocateFixed size={19} />
                    </button>
                  </div>
                  {!s.location ? (
                    <div className="location-empty">
                      <span className="large-icon">
                        <LocateFixed />
                      </span>
                      <h3>Je volgende vertrek is dichtbij</h3>
                      <p>
                        Deel je locatie of kies een station om echte vertrekken
                        in jouw omgeving te bekijken.
                      </p>
                      <button className="primary" onClick={locate}>
                        Gebruik mijn locatie <ArrowRight size={16} />
                      </button>
                      <button
                        className="link-button"
                        onClick={() => setLocationDialog(true)}
                      >
                        Liever zelf een gebied kiezen
                      </button>
                    </div>
                  ) : (
                    <div className="stop-list">
                      {closeStops.map((stop) => (
                        <Board
                          key={stop.id}
                          stop={stop}
                          distance={stop.distance}
                          compact
                          onOpen={openBoard}
                        />
                      ))}
                      {stations.isPending && (
                        <div className="loading">Stations laden…</div>
                      )}
                    </div>
                  )}
                </div>
                <aside className="right-column">
                  <section className="map-card">
                    <div className="section-head">
                      <h2>Even om je heen kijken</h2>
                      <Compass size={19} />
                    </div>
                    <MapView
                      stops={stops}
                      center={s.location || undefined}
                      onSelect={openBoard}
                    />
                    <button
                      className="map-link"
                      onClick={() => s.setPage("discover")}
                    >
                      Ontdek de kaart <ArrowUpRight size={17} />
                    </button>
                  </section>
                  <section className="assistant-card">
                    <div className="assistant-symbol">
                      <Navigation size={22} />
                    </div>
                    <span className="eyebrow">OVFLOW JOURNEY ASSISTANT</span>
                    <h2>
                      Meer rust.
                      <br />
                      Ook onderweg.
                    </h2>
                    <p>
                      Verbind met een trein-, bus- of tramrit en houd de
                      volgende haltes en beschikbare vertragingen bij.
                    </p>
                    <button onClick={() => s.setPage("live")}>
                      Ontdek Mijn lijn <ArrowRight size={17} />
                    </button>
                    <div className="decorative-route" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                  </section>
                  <section className="source-card">
                    <ShieldCheck size={21} />
                    <div>
                      <h3>Echte informatie. Helder verteld.</h3>
                      <p>
                        NMBS via iRail en bus- en tramvertrekken van De Lijn.
                        Actuele tijden worden onderscheiden van de
                        dienstregeling. Geen verzonnen GPS-posities.
                      </p>
                      <button
                        className="link-button"
                        onClick={() => s.setPage("profile")}
                      >
                        Bekijk databronnen <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}
          {s.page === "routes" && (
            <Routes
              stops={stops}
              from={from}
              to={to}
              setFrom={setFrom}
              setTo={setTo}
              onBoard={openBoard}
              notify={setMessage}
            />
          )}
          {s.page === "discover" && (
            <>
              <PageTitle
                eyebrow="BELGIË, BINNEN HANDBEREIK"
                title="Ontdekken"
                description="Zoek haltes van De Lijn en NMBS-stations met echte vertrekken."
              />
              <div className="discover-toolbar">
                <Search
                  stops={visibleStops}
                  value={discoverStop}
                  onChange={setDiscoverStop}
                  label="Zoek een halte of station"
                />
                <button className="secondary" onClick={locate}>
                  <LocateFixed size={17} /> Mijn locatie
                </button>
              </div>
              <div className="filter-row" aria-label="Vervoerder filteren">
                {(
                  [
                    ["all", "Alle vervoerders"],
                    ["nmbs", "NMBS"],
                    ["delijn", "De Lijn"],
                  ] as const
                ).map(([id, name]) => (
                  <button
                    className={"chip " + (operator === id ? "selected" : "")}
                    key={id}
                    aria-pressed={operator === id}
                    onClick={() => {
                      setOperator(id);
                      setDiscoverStop(null);
                    }}
                  >
                    {id === "delijn" ? (
                      <BusFront size={15} />
                    ) : (
                      <TrainFront size={15} />
                    )}{" "}
                    {name}
                  </button>
                ))}
                <span className="muted">
                  {visibleStops.length.toLocaleString("nl-BE")} haltes en
                  stations
                </span>
              </div>
              <div className="discover-map">
                <MapView
                  stops={visibleStops}
                  center={discoverStop || s.location || undefined}
                  onSelect={setDiscoverStop}
                />
              </div>
              {discoverStop && (
                <div className="discover-board">
                  <Board stop={discoverStop} onOpen={openBoard} />
                  
                    <button
                      className="primary"
                      onClick={() => {
                        setTo(discoverStop);
                        s.setPage("routes");
                      }}
                    >
                      Route naar deze halte <ArrowRight size={17} />
                    </button>
                  
                </div>
              )}
            </>
          )}
          {s.page === "live" && <Live stops={stops} onBoard={openBoard} />}
          {s.page === "profile" && (
            <Profile stops={stops} onBoard={openBoard} notify={setMessage} />
          )}
          <footer className="page-footer">
            <span>
              OVFlow <span className="green">↗</span> Samen onderweg.
            </span>
            <span>
              Bronnen:{" "}
              <a href="https://irail.be" target="_blank" rel="noreferrer">
                iRail
              </a>{" "}
              · De Lijn · Digitaal Vlaanderen · Europe/Brussels
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobiele navigatie">
        {nav.map((n) => (
          <button
            key={n.key}
            className={s.page === n.key ? "active" : ""}
            onClick={() => s.setPage(n.key)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {board && (
        <Dialog title="Vertrekbord" close={() => setBoard(null)}>
          <Board stop={board} />
          
            <button
              className="primary wide"
              onClick={() => {
                setTo(board);
                setBoard(null);
                s.setPage("routes");
              }}
            >
              Plan een route naar deze halte <ArrowRight size={16} />
            </button>
          
        </Dialog>
      )}
      {locationDialog && (
        <Dialog
          title="Jouw vertrekgebied"
          close={() => setLocationDialog(false)}
        >
          <p className="muted">
            Gebruik je locatie of kies een halte of station als middelpunt. We
            tonen afstanden hemelsbreed; dit zijn geen berekende wandelroutes.
          </p>
          <button className="secondary wide" onClick={locate}>
            <LocateFixed size={17} /> Gebruik mijn locatie
          </button>
          <Search
            stops={stops}
            value={null}
            label="Of kies een station"
            onChange={(v) => {
              if (v) {
                s.set({ location: { lat: v.lat, lon: v.lon, label: v.name } });
                setFrom(v);
                setLocationDialog(false);
              }
            }}
          />
        </Dialog>
      )}
      {message && (
        <Dialog title="Goed om te weten" close={() => setMessage("")}>
          <p>{message}</p>
          <button className="primary" onClick={() => setMessage("")}>
            Begrepen <Check size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        {title}
        <span className="green">.</span>
      </h1>
      <p>{description}</p>
    </div>
  );
}
function Routes({
  stops,
  from,
  to,
  setFrom,
  setTo,
  onBoard,
  notify,
}: {
  stops: Stop[];
  from: Stop | null;
  to: Stop | null;
  setFrom: (s: Stop | null) => void;
  setTo: (s: Stop | null) => void;
  onBoard: (s: Stop) => void;
  notify: (s: string) => void;
}) {
  const s = useStore(),
    [when, setWhen] = useState("now"),
    [time, setTime] = useState(inputNow()),
    [request, setRequest] = useState<{
      from: Stop;
      to: Stop;
      params: Record<string, string>;
    } | null>(null),
    [sort, setSort] = useState("departure"),
    [selected, setSelected] = useState<Journey | null>(null),
    [mapLeg, setMapLeg] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["journeys", request],
    queryFn: ({ signal }) =>
      planJourney(request!.from, request!.to, request!.params, signal),
    enabled: !!request,
    retry: 0,
  });
  const results = useMemo(
    () =>
      [...(q.data || [])].sort((a, b) =>
        sort === "duration"
          ? a.duration - b.duration
          : sort === "transfers"
            ? a.transfers - b.transfers
            : a.legs[0].from.time - b.legs[0].from.time,
      ),
    [q.data, sort],
  );
  function search() {
    if (!from || !to) return;
    if (from.id === to.id) {
      notify("Kies twee verschillende haltes of stations.");
      return;
    }
    try {
      setSelected(null);
      setRequest({
        from,
        to,
        params:
          when === "now"
            ? {}
            : {
                at: DateTime.fromISO(time, { zone: "Europe/Brussels" }).toISO() || "",
                timesel: when === "arrival" ? "arrival" : "departure",
              },
      });
      if (s.historyEnabled)
        s.set({
          history: [`${from.name} → ${to.name}`, ...s.history].slice(0, 30),
        });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="EEN GOEDE REIS BEGINT HIER"
        title="Jouw route"
        description="Plan je reis met trein, bus, tram en de wandelstukken ertussen."
      />
      <section className="planner-card route-form">
        <div className="route-inputs">
          <Search
            stops={stops}
            value={from}
            onChange={setFrom}
            label="Vertrekhalte of station"
          />
          <button
            className="swap"
            aria-label="Haltes omwisselen"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowDownUp size={18} />
          </button>
          <Search
            stops={stops}
            value={to}
            onChange={setTo}
            label="Bestemming"
          />
        </div>
        <div className="route-options">
          <label>
            <Clock size={16} />
            <select
              aria-label="Reistijd"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            >
              <option value="now">Vertrek nu</option>
              <option value="departure">Vertrek om</option>
              <option value="arrival">Aankomen vóór</option>
            </select>
          </label>
          {when !== "now" && (
            <input
              aria-label="Datum en tijd in België"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
          <span className="subtle-badge">
            <TrainFront size={15} /> Trein + bus
          </span>
          <button
            className="primary"
            disabled={!from || !to || q.isFetching}
            onClick={search}
          >
            {q.isFetching ? "Routes ophalen…" : "Zoek routes"}
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="fineprint">
          Trein, bus en tram in één reisadvies, inclusief lopen en overstappen. Bron: De Lijn / HERE.
        </p>
      </section>
      {q.error && (
        <div className="notice error">
          {q.error.message}
          <button onClick={() => q.refetch()}>Opnieuw</button>
        </div>
      )}
      {q.isFetching && (
        <div className="loading">We zoeken de beschikbare verbindingen…</div>
      )}
      {q.data && (
        <div className="section-head spaced">
          <h2>{results.length} verbindingen</h2>
          <select
            aria-label="Sorteer routes"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="departure">Eerstvolgend vertrek</option>
            <option value="duration">Kortste reistijd</option>
            <option value="transfers">Minste overstappen</option>
          </select>
        </div>
      )}
      <div className="route-results">
        {results.map((j, i) => {
          const first = j.legs[0].from,
            last = j.legs.at(-1)!.to;
          return (
            <button
              className={
                "journey-card " + (selected?.id === j.id ? "selected" : "")
              }
              key={j.id}
              onClick={() => { setSelected(j); setMapLeg(null); }}
            >
              <div className="journey-top">
                <span>{i === 0 ? "EERSTE OPTIE" : "ALTERNATIEF"}</span>
                <span>
                  {j.transfers === 0
                    ? "Rechtstreeks"
                    : `${j.transfers} overstap${j.transfers === 1 ? "" : "pen"}`}
                </span>
              </div>
              <div className="journey-times">
                <strong>{clockTime(first.time + (first.delay || 0))}</strong>
                <span className="journey-line">
                  <i />
                  <span>{Math.round(j.duration / 60000)} min</span>
                  <i />
                </span>
                <strong>{clockTime(last.time + (last.delay || 0))}</strong>
                <ChevronRight size={20} />
              </div>
              <div className="journey-stations">
                <span>{first.name}</span>
                <span>{last.name}</span>
              </div>
              <div className="journey-tags">
                {j.legs.map((l, k) => (
                  <span className={"line-badge mode-" + l.mode.toLowerCase()} key={k}>
                    {l.line}
                  </span>
                ))}
                {j.legs.some((l) => l.from.canceled || l.to.canceled) && (
                  <span className="delay">Bevat afgeschafte rit</span>
                )}
                {last.delay !== null && last.delay > 0 && (
                  <span className="delay">
                    Aankomst +{Math.ceil(last.delay / 60000)} min
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {q.data && !results.length && (
        <div className="notice">
          Geen verbinding gevonden voor dit tijdstip.
        </div>
      )}
      {selected && (
        <section className="route-detail">
          <div className="section-head">
            <h2>Je reis, stap voor stap</h2>
            <button
              className="link-button"
              onClick={async () => {
                const u = new URL(location.href);
                u.search = new URLSearchParams({
                  from: request!.from.id,
                  to: request!.to.id,
                }).toString();
                try {
                  await navigator.clipboard.writeText(u.href);
                  notify(
                    "Zoeklink gekopieerd. De ontvanger krijgt actuele routeopties, niet een vastgelegde rit.",
                  );
                } catch {
                  notify(u.href);
                }
              }}
            >
              Deel zoekopdracht <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="route-map-filters" aria-label="Traject op kaart">
            <button className={"chip " + (mapLeg === null ? "selected" : "")} onClick={() => setMapLeg(null)}>Volledige reis</button>
            {selected.legs.map((l, i) => l.mode !== "WALK" && <button key={i} className={"chip " + (mapLeg === i ? "selected" : "")} onClick={() => setMapLeg(i)}>{l.mode === "TRAIN" ? "Trein" : l.mode === "TRAM" ? "Tram" : "Bus"} {l.line}</button>)}
          </div>
          <MapView key={selected.id + ":" + (mapLeg ?? "all")}
            stops={stops.filter(s => selected.legs.some(l => l.from.id === s.id || l.to.id === s.id))}
            segments={selected.legs.filter((_, i) => mapLeg === null || i === mapLeg).map(l => ({ points: l.routePoints || [], mode: l.mode, label: l.line }))}
            points={selected.legs.filter((_, i) => mapLeg === null || i === mapLeg).flatMap(l => [l.from, l.to])}
            onSelect={onBoard}
          />
          <div className="timeline">
            {selected.legs.map((leg, i) => (
              <div className="leg" key={i}>
                <div>
                  <span className={"line-badge mode-" + leg.mode.toLowerCase()}>{leg.line}</span>
                  <span className="muted">{leg.agency}</span>
                  <strong>
                    {leg.from.name} → {leg.to.name}
                  </strong>
                </div>
                <p>
                  {clockTime(leg.from.time + (leg.from.delay || 0))}
                  {leg.from.platform && ` · ${leg.mode === "TRAIN" ? "Spoor" : "Halte"} ${leg.from.platform}`} {" "}
                  <ArrowRight size={14} /> {clockTime(leg.to.time + (leg.to.delay || 0))}
                  {leg.to.platform && ` · ${leg.mode === "TRAIN" ? "Spoor" : "Halte"} ${leg.to.platform}`}
                </p>
                {leg.from.delay !== null && leg.from.delay > 0 && (
                  <p className="delay">
                    Vertrek +{Math.ceil(leg.from.delay / 60000)} minuten
                  </p>
                )}
                {leg.intermediate.length > 0 && (
                  <details>
                    <summary>{leg.intermediate.length} tussenhaltes</summary>
                    {leg.intermediate.map((p) => (
                      <p key={p.id}>
                        {clockTime(p.time)} · {p.name}
                      </p>
                    ))}
                  </details>
                )}
                {i < selected.legs.length - 1 && selected.legs[i + 1].from.time + (selected.legs[i + 1].from.delay || 0) > leg.to.time + (leg.to.delay || 0) && (
                  <p className="transfer">
                    Wachttijd tot volgend vertrek:{" "}
                    {Math.floor(
                      (selected.legs[i + 1].from.time +
                        (selected.legs[i + 1].from.delay || 0) -
                        leg.to.time -
                        (leg.to.delay || 0)) /
                        60000,
                    )}{" "}
                    min volgens beschikbare tijden
                  </p>
                )}
                {leg.vehicle && <button
                  className="link-button"
                  disabled={leg.from.canceled || !leg.vehicle}
                  onClick={() => {
                    s.set({
                      activeTrip: {
                        id: leg.vehicle,
                        date: serviceDate(leg.from.time),
                      },
                    });
                    s.setPage("live");
                  }}
                >
                  Volg deze rit <Radio size={15} />
                </button>}
              </div>
            ))}
          </div>
          {selected.alerts.map((a, i) => (
            <p className="notice" key={i}>
              {a}
            </p>
          ))}
          <p className="fineprint">
            Bronupdate {clockTime(selected.updatedAt)}. Controleer de
            halte- en stationsborden. De kaart gebruikt routegeometrie van de bron; ontbrekende trajecten worden niet verzonnen.
          </p>
        </section>
      )}
      {!request && (
        <div className="route-empty">
          <Route size={40} />
          <h2>Een bestemming. Alle mogelijkheden.</h2>
          <p>Kies haltes of stations om je reis met trein en bus te plannen.</p>
        </div>
      )}
    </>
  );
}
function Live({
  stops,
  onBoard,
}: {
  stops: Stop[];
  onBoard: (s: Stop) => void;
}) {
  const s = useStore(),
    [station, setStation] = useState<Stop | null>(null);
  const q = useQuery({
    queryKey: ["trip", s.activeTrip?.id, s.activeTrip?.date],
    queryFn: ({ signal }) =>
      adapterFor(operatorForTrip(s.activeTrip!.id)).trip(
        s.activeTrip!.id,
        s.activeTrip!.date,
        signal,
      ),
    enabled: !!s.activeTrip,
    refetchInterval: 60000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const trip = q.data || s.activeTrip?.plan;
  const vehicle = useVehiclePosition(q.data?.id, q.data?.isEnded ? undefined : q.data?.vehicleId);
  const [locationMessage, setLocationMessage] = useState("");
  useEffect(() => {
    const current = useStore.getState().activeTrip;
    if (q.data && current?.id === q.data.id) s.set({ activeTrip: { ...current, plan: savedPlan(q.data) } });
  }, [q.data]);
  useEffect(() => {
    const resume = () => { if (!document.hidden && navigator.onLine && useStore.getState().activeTrip) void q.refetch(); };
    document.addEventListener("visibilitychange", resume); window.addEventListener("pageshow", resume);
    return () => { document.removeEventListener("visibilitychange", resume); window.removeEventListener("pageshow", resume); };
  }, [s.activeTrip?.id, q.refetch]);
  function findNearby() {
    if (!navigator.geolocation) { setLocationMessage("Locatie niet beschikbaar. Kies je instaphalte zelf."); return; }
    setLocationMessage("Locatie zoeken…");
    navigator.geolocation.getCurrentPosition(p => {
      const found = nearest(stops, { lat: p.coords.latitude, lon: p.coords.longitude })[0];
      if (found && found.distance <= 1500 && p.coords.accuracy <= 500) { setStation(found); setLocationMessage("Dichtstbijzijnde halte geselecteerd. Controleer halte en rijrichting."); }
      else setLocationMessage("Geen halte dichtbij of locatie te onnauwkeurig. Kies je instaphalte zelf.");
    }, () => setLocationMessage("Locatie niet beschikbaar. Kies je instaphalte zelf."), { timeout: 12000, maximumAge: 30000 });
  }
  return (
    <>
      <PageTitle
        eyebrow="VOLG JE REIS"
        title="Mijn lijn"
        description="Volg een echte trein-, bus- of tramrit en bekijk de volgende haltes."
      />
      {!s.activeTrip ? (
        <>
          <section className="planner-card">
            <h2>Met welke lijn reis je mee?</h2>
            <p className="muted">
              Kies eerst je halte of station. Filter eventueel op lijn en
              selecteer een concrete rit op het vertrekbord.
            </p>
            <button className="secondary" onClick={findNearby}>Kies instaphalte via mijn locatie</button>
            {locationMessage && <p role="status">{locationMessage}</p>}
            <Search
              stops={stops}
              value={station}
              onChange={setStation}
              label="Instaphalte of station"
            />
          </section>
          {station && <Board stop={station} />}
          <div className="notice">
            <ShieldCheck size={20} />
            Er worden geen voertuigposities gesimuleerd. Deze versie toont
            haltes en tijden van NMBS en De Lijn. Busposities verschijnen als De Lijn ze voor jouw rit doorgeeft.
          </div>
        </>
      ) : (
        <>
          <div className="section-head">
            <span className="subtle-badge">
              <Radio size={15} /> Verbonden met{" "}
              {s.activeTrip.line || s.activeTrip.id.replace("BE.NMBS.", "")}
            </span>
            <button
              className="secondary"
              onClick={() => s.set({ activeTrip: null })}
            >
              Verbinding verbreken
            </button>
          </div>
          {q.isPending && <div className="loading">Ritinformatie ophalen…</div>}
          {q.error && (
            <div className="notice error">
              {q.error.message}
              <button onClick={() => q.refetch()}>Opnieuw</button>
            </div>
          )}
          {trip && (
            <>
              <RideControls trip={trip} />
              <section className="trip-hero">
                <div>
                  <span className="eyebrow">
                    {operators[operatorForTrip(trip.id)].name} ·{" "}
                    {dateLabel(trip.stops[0]?.time || trip.updatedAt)}
                  </span>
                  <h2>{s.activeTrip.line || trip.line}</h2>
                  <p>Richting {trip.stops.at(-1)?.name}</p>
                </div>
                <div>
                  <span className="subtle-badge">
                    {trip.offline ? "Opgeslagen gegevens" : "Brongegevens"}
                  </span>
                  <p>Update {clockTime(trip.updatedAt)}</p>
                </div>
              </section>
              <div className="notice">
                <MapPin size={19} />
                {vehicle ? `${vehicle.live ? "Live buspositie" : "Laatst bekende buspositie"} · bronmeting ${clockTime(vehicle.timestamp)}` : trip.isEnded ? "Deze rit is afgelopen. Kies een huidige rit via je vertrekhalte om de bus live te volgen." : !trip.id.startsWith("delijn:") ? "Voor deze trein is geen GPS-positie beschikbaar." : !trip.vehicleId ? "De Lijn geeft voor deze rit nog geen voertuig door. We controleren dit automatisch opnieuw." : "Wachten op een actuele GPS-meting van De Lijn. De positie verschijnt automatisch zodra die binnenkomt."}
              </div>
              <p className="fineprint">Je rit en haltekeuze worden op dit apparaat bewaard. Bij heropenen halen we actuele gegevens op. Met een uitgeschakelde iPhone of geschorste webapp zijn er geen live updates.</p>
              {(trip.offline || Date.now() - trip.updatedAt > 180000) && (
                <div className="notice error">
                  Opgeslagen reisplan of verouderde gegevens. Dit is geen actuele voertuiglocatie.
                </div>
              )}
              <MapView vehicle={vehicle} stops={stops.filter(s => trip.stops.some(p => p.id === s.id))} points={trip.stops} segments={trip.routePoints ? [{ points: trip.routePoints, mode: "BUS", label: trip.line }] : []} onSelect={onBoard} />
              <section className="trip-stops">
                <h2>Alle haltes</h2>
                {trip.stops.map((p, i) => (
                  <div
                    className={"trip-stop " + (p.left ? "passed" : "")}
                    key={p.id + ":" + i}
                  >
                    <span className="stop-node">
                      {p.left ? <Check size={12} /> : ""}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {operatorForTrip(trip.id) === "delijn"
                          ? "Halte"
                          : "Spoor"}{" "}
                        {p.platform}
                        {p.left ? " · Vertrokken volgens bron" : ""}
                      </small>
                    </div>
                    <div className="departure-time">
                      {clockTime(p.time)}
                      <small className="delay">
                        {p.canceled
                          ? "Afgeschaft"
                          : p.delay && p.delay > 0
                            ? `+${Math.ceil(p.delay / 60000)} min`
                            : p.delay !== null && p.delay < 0
                              ? `${Math.floor(p.delay / 60000)} min`
                              : p.delay === null
                                ? "Gepland"
                                : "Volgens bron op tijd"}
                      </small>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
function Profile({
  stops,
  onBoard,
  notify,
}: {
  stops: Stop[];
  onBoard: (s: Stop) => void;
  notify: (s: string) => void;
}) {
  const s = useStore();
  return (
    <>
      <PageTitle
        eyebrow="HELEMAAL OP JOUW MANIER"
        title="Mijn profiel"
        description="Jouw voorkeuren en favoriete haltes, op dit apparaat bewaard."
      />
      <section className="settings-card ride-history">
        <h2>Mijn gereisde kilometers</h2>
        <p className="km-total">{(s.rides.reduce((sum, r) => sum + r.meters, 0) / 1000).toFixed(2)} km</p>
        <p>{s.rides.length} bevestigde ritten · lokaal opgeslagen op dit apparaat</p>
        <p className="fineprint">Afstanden zijn berekend langs de route. Waar geometrie ontbreekt, is een schatting via de haltes inbegrepen. Geen GPS-afstandsmeting. Wis je websitegegevens, dan verdwijnen ook deze ritten.</p>
        {s.rides.slice().reverse().map(r => <div className="history-row" key={r.id}><div><strong>{r.line} · {r.from} → {r.to}</strong><small>{dateLabel(r.completedAt)} · {r.basis === "route" ? "Routeafstand" : "Geschatte afstand"}</small></div><strong>{(r.meters/1000).toFixed(2)} km</strong></div>)}
        {!s.rides.length && <p className="muted">Kies je instap- en uitstaphalte bij Mijn lijn en bevestig na je rit dat je bent uitgestapt.</p>}
      </section>
      <div className="profile-grid">
        <section className="settings-card">
          <h2>Persoonlijk</h2>
          <label className="setting">
            Weergavenaam
            <input
              value={s.name}
              placeholder="Hoe mogen we je noemen?"
              maxLength={40}
              onChange={(e) => s.set({ name: e.target.value })}
            />
          </label>
          <label className="setting">
            Weergave
            <select
              value={s.theme}
              onChange={(e) =>
                s.set({ theme: e.target.value as typeof s.theme })
              }
            >
              <option value="system">Automatisch</option>
              <option value="light">Licht</option>
              <option value="dark">Donker</option>
            </select>
          </label>
          <p className="fineprint">
            De interface is momenteel Nederlandstalig. Volledige Franse, Duitse
            en Engelse vertalingen volgen.
          </p>
          <h2>Privacy & opslag</h2>
          <label className="toggle-row">
            <span>
              Recente zoekopdrachten bewaren
              <small>Optioneel, uitsluitend op dit apparaat</small>
            </span>
            <input
              type="checkbox"
              checked={s.historyEnabled}
              onChange={(e) =>
                s.set({
                  historyEnabled: e.target.checked,
                  history: e.target.checked ? s.history : [],
                })
              }
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              s.set({ history: [] });
              notify("Je lokale zoekgeschiedenis is gewist.");
            }}
          >
            Zoekgeschiedenis wissen
          </button>
          {s.historyEnabled &&
            s.history.map((h, i) => (
              <p className="history-row" key={i}>
                <Clock size={15} />
                {h}
              </p>
            ))}
          <h2>Installeren</h2>
          <p>
            Op iPhone: open deze app in Safari en kies Delen → Zet op
            beginscherm. Op Android: kies App installeren in het browsermenu.
          </p>
          <p className="fineprint">
            De interface en recent geladen gegevens kunnen offline beschikbaar
            blijven. Kaarten en nieuwe routes hebben internet nodig.
          </p>
        </section>
        <div>
          <section className="settings-card">
            <h2>Favoriete haltes en stations</h2>
            <Search
              stops={stops}
              value={null}
              label="Voeg een favoriet toe"
              onChange={(v) => {
                if (v && !s.favorites.some((f) => f.id === v.id))
                  s.toggleFavorite(v);
              }}
            />
            {s.favorites.map((f) => (
              <div className="favorite-row" key={f.id}>
                <button className="text-button" onClick={() => onBoard(f)}>
                  <TrainFront size={17} />
                  {f.name}
                </button>
                <button
                  className="icon-button"
                  aria-label={`${f.name} verwijderen`}
                  onClick={() => s.toggleFavorite(f)}
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            {!s.favorites.length && (
              <p className="muted">
                Nog geen favorieten. Zoek hierboven een halte of station.
              </p>
            )}
          </section>
          <section className="settings-card">
            <h2>Databronnen</h2>
            {Object.entries(operators).map(([id, o]) => (
              <div className="provider-row" key={id}>
                <span
                  className="provider-dot"
                  style={{ background: o.color }}
                />
                <strong>{o.name}</strong>
                <span>
                  {id === "nmbs"
                    ? "Aangesloten via iRail"
                    : id === "delijn"
                      ? "Haltes, vertrekken & ritten"
                      : "Nog niet aangesloten"}
                </span>
              </div>
            ))}
            <p className="fineprint">
              Vertragingen en afschaffingen komen uit de bron. Een geplande tijd
              is geen GPS-meting. De status hierboven beschrijft de integratie,
              niet de actuele beschikbaarheid.
            </p>
            <a
              className="link-button"
              href="https://docs.irail.be"
              target="_blank"
              rel="noreferrer"
            >
              iRail-documentatie <ArrowUpRight size={15} />
            </a>
            <h2>Account & synchronisatie</h2>
            <p>
              Je gebruikt OVFlow zonder account. Inloggen, cloudsynchronisatie
              en achtergrondmeldingen zijn nog niet beschikbaar.
            </p>
            <span className="subtle-badge">
              <ShieldCheck size={14} /> Lokaal opgeslagen
            </span>
          </section>
        </div>
      </div>
    </>
  );
}
