import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { VehiclePosition } from "../data/vehicle";
import type { FeatureCollection } from "geojson";
import type { RouteSegment } from "../data/geometry";
import type { Stop } from "../data/types";
export default function TransitMap({
  stops,
  center,
  onSelect,
  points = [],
  segments = [],
  vehicle,
}: {
  stops: Stop[];
  center?: { lat: number; lon: number };
  onSelect: (s: Stop) => void;
  points?: { lat: number; lon: number }[];
  segments?: RouteSegment[];
  vehicle?: VehiclePosition | null;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    select = useRef(onSelect),
    items = useRef(stops);
  const fitted = useRef("");
  const [error, setError] = useState(false);
  select.current = onSelect;
  items.current = stops;
  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [
            {
              id: "map",
              type: "raster",
              source: "osm",
              paint: { "raster-saturation": -0.7, "raster-opacity": 0.8 },
            },
          ],
        },
        center: center ? [center.lon, center.lat] : [4.36, 50.85],
        zoom: center ? 12 : 7,
      });
      map.current = m;
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      m.on("load", () => {
        m.addSource("stops", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterRadius: 40,
          clusterMaxZoom: 11,
        });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "stops",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#176b58",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              11,
              20,
              14,
              100,
              17,
            ],
            "circle-stroke-color": "white",
            "circle-stroke-width": 3,
          },
        });
        m.addLayer({
          id: "stations",
          type: "circle",
          source: "stops",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["match", ["get", "operator"], "delijn", "#d69216", "#3471cb"],
            "circle-radius": 6,
            "circle-stroke-color": "white",
            "circle-stroke-width": 3,
          },
        });
        m.on("click", "stations", (e) => {
          const id = e.features?.[0].properties?.id;
          const s = items.current.find((s) => s.id === id);
          if (s) select.current(s);
        });
        m.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f || f.geometry.type !== "Point") return;
          const zoom = await (
            m.getSource("stops") as GeoJSONSource
          ).getClusterExpansionZoom(f.properties?.cluster_id);
          m.easeTo({
            center: f.geometry.coordinates as [number, number],
            zoom,
          });
        });
        m.on(
          "mouseenter",
          "stations",
          () => (m.getCanvas().style.cursor = "pointer"),
        );
        m.on("mouseleave", "stations", () => (m.getCanvas().style.cursor = ""));
        update();
      });
      const update = () => {
        const source = m.getSource("stops") as GeoJSONSource | undefined;
        source?.setData({
          type: "FeatureCollection",
          features: items.current.map((s) => ({
            type: "Feature",
            properties: { id: s.id, operator: s.operator },
            geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          })),
        });
      };
      return () => {
        m.remove();
        map.current = null;
      };
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const update = () => {
      (m.getSource("stops") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: stops.map((s) => ({
          type: "Feature",
          properties: { id: s.id, operator: s.operator },
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        })),
      });
    };
    if (m.getSource("stops")) update();
    else m.once("load", update);
    return () => {
      m.off("load", update);
    };
  }, [stops]);
  useEffect(() => {
    const m = map.current;
    if (m && center)
      m.flyTo({ center: [center.lon, center.lat], zoom: 12, duration: 600 });
  }, [center?.lat, center?.lon]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const usable = segments.filter(s => s.points.length >= 2);
      const data: FeatureCollection = { type: "FeatureCollection", features: usable.map(s => ({
        type: "Feature", properties: { mode: s.mode, color: s.mode === "WALK" ? "#667085" : s.mode === "TRAIN" ? "#3471cb" : "#d69216" },
        geometry: { type: "LineString", coordinates: s.points.map(p => [p.lon, p.lat]) },
      })) };
      if (m.getSource("route")) (m.getSource("route") as GeoJSONSource).setData(data);
      else {
        m.addSource("route", { type: "geojson", data });
        m.addLayer({ id: "route-outline", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.95 } }, "clusters");
        m.addLayer({ id: "route", type: "line", source: "route", filter: ["!=", ["get", "mode"], "WALK"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 5 } }, "clusters");
        m.addLayer({ id: "route-walk", type: "line", source: "route", filter: ["==", ["get", "mode"], "WALK"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#667085", "line-width": 4, "line-dasharray": [1, 1.8] } }, "clusters");
      }
      const all = usable.length ? usable.flatMap(s => s.points) : points;
      const signature = JSON.stringify([all.length, all[0], all.at(-1)]);
      if (all.length && fitted.current !== signature) {
        const bounds = new maplibregl.LngLatBounds();
        all.forEach(p => bounds.extend([p.lon, p.lat]));
        m.fitBounds(bounds, { padding: 45, maxZoom: 14, duration: 600 });
        fitted.current = signature;
      }
    };
    if (m.getSource("stops")) draw(); else m.once("load", draw);
    return () => { m.off("load", draw); };
  }, [points, segments]);
  useEffect(() => {
    const m = map.current;
    if (!m || !vehicle) return;
    const element = document.createElement("div");
    element.className = "bus-position " + (vehicle.live ? "is-live" : "is-old");
    element.textContent = "BUS";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", vehicle.live ? "Live buspositie" : "Laatst bekende buspositie");
    element.title = `${vehicle.live ? "Live" : "Laatst bekend"} · ${new Date(vehicle.timestamp).toLocaleTimeString("nl-BE")}`;
    const marker = new maplibregl.Marker({ element }).setLngLat([vehicle.lon, vehicle.lat]).addTo(m);
    return () => { marker.remove(); };
  }, [vehicle?.lat, vehicle?.lon, vehicle?.timestamp, vehicle?.live]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="map"
        aria-label="Interactieve stationskaart"
      />
      {error && (
        <div className="map-error">
          De kaart kan niet geladen worden. Je kunt stations zoeken via de
          lijst.
        </div>
      )}
      {vehicle && <button className="secondary" style={{position:"absolute",top:12,left:12,zIndex:2}} onClick={() => map.current?.flyTo({center:[vehicle.lon,vehicle.lat],zoom:15,duration:600})}>Toon bus op kaart</button>}
      <span className="map-caption">
        {points.length
          ? segments.some(s => s.points.length >= 2) ? "Route van de bron · blauw: trein · goud: bus/tram · gestippeld: lopen" : "Haltes · routegeometrie niet beschikbaar"
          : "Haltes & stations · OpenStreetMap"}
      </span>
    </div>
  );
}
