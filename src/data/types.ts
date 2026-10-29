export type Operator = "nmbs" | "delijn" | "stib" | "tec";
export type Mode = "TRAIN" | "BUS" | "TRAM" | "SUBWAY" | "WALK";
export interface Stop {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  operator: Operator;
}
export interface Departure {
  serviceDate?: string;
  mode?: Mode;
  id: string;
  destination: string;
  time: number;
  delay: number | null;
  canceled: boolean;
  left: boolean;
  vehicle: string;
  line: string;
  platform: string;
}
export interface Board {
  departures: Departure[];
  updatedAt: number;
  offline?: boolean;
}
export interface Point {
  name: string;
  id: string;
  lat: number;
  lon: number;
  time: number;
  delay: number | null;
  platform: string;
  canceled: boolean;
}
export interface Leg {
  from: Point;
  to: Point;
  vehicle: string;
  line: string;
  mode: Mode;
  intermediate: Point[];
  geometry?: string;
  routePoints?: import("./geometry").Coordinate[];
  agency?: string;
}
export interface Journey {
  id: string;
  legs: Leg[];
  duration: number;
  transfers: number;
  alerts: string[];
  updatedAt: number;
  offline?: boolean;
}
export interface TripStop extends Point {
  left: boolean;
  arrival: number;
}
export interface Trip {
  isEnded?: boolean;
  isStarted?: boolean;
  vehicleId?: string;
  routePoints?: import("./geometry").Coordinate[];
  id: string;
  line: string;
  stops: TripStop[];
  updatedAt: number;
  offline?: boolean;
  position:
    | { kind: "unavailable" }
    | {
        kind: "gps" | "last-known";
        lat: number;
        lon: number;
        timestamp: number;
      };
}
export interface Snapshot<T> {
  value: T;
  storedAt: number;
  offline: boolean;
}
export interface TransportAdapter {
  operator: Operator;
  stops: (signal?: AbortSignal) => Promise<Stop[]>;
  departures: (stop: Stop, signal?: AbortSignal) => Promise<Board>;
  trip: (id: string, date: string, signal?: AbortSignal) => Promise<Trip>;
}
export const operators: Record<
  Operator,
  { name: string; color: string; website: string }
> = {
  nmbs: {
    name: "NMBS",
    color: "#3471cb",
    website: "https://www.belgiantrain.be",
  },
  delijn: {
    name: "De Lijn",
    color: "#ebbc42",
    website: "https://www.delijn.be",
  },
  stib: { name: "MIVB", color: "#cf4e75", website: "https://www.stib-mivb.be" },
  tec: { name: "TEC", color: "#dc6043", website: "https://www.letec.be" },
};
