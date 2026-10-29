import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import type { RideRecord } from "./data/rides";
import type { Stop, Trip } from "./data/types";
type Page = "home" | "routes" | "discover" | "live" | "profile";
interface State {
  page: Page;
  setPage: (p: Page) => void;
  name: string;
  theme: "system" | "light" | "dark";
  language: "nl" | "fr" | "de" | "en";
  favorites: Stop[];
  location: { lat: number; lon: number; label: string } | null;
  activeTrip: { id: string; date: string; line?: string; boardingStopId?: string; boardingKey?: string; alightingKey?: string; plan?: Trip } | null;
  rides: RideRecord[];
  finishRide: (ride: RideRecord) => void;
  historyEnabled: boolean;
  history: string[];
  set: (v: Partial<State>) => void;
  toggleFavorite: (s: Stop) => void;
}
export const useStore = create<State>()(
  persist(
    (setState, getState) => ({
      page: "home",
      setPage: (page) => setState({ page }),
      name: "",
      theme: "system",
      language: "nl",
      favorites: [],
      location: null,
      activeTrip: null,
      rides: [],
      finishRide: (ride) => setState(state => ({ rides: state.rides.some(r => r.id === ride.id) ? state.rides : [...state.rides, ride], activeTrip: null, page: "profile" })),
      historyEnabled: false,
      history: [],
      set: (v) => setState(v),
      toggleFavorite: (s) =>
        setState({
          favorites: getState().favorites.some((f) => f.id === s.id)
            ? getState().favorites.filter((f) => f.id !== s.id)
            : [...getState().favorites, s],
        }),
    }),
    {
      name: "ovflow-profile-v1",
      onRehydrateStorage: () => state => { if (state?.activeTrip) state.setPage("live"); },
      storage: createJSONStorage(() => ({
        getItem: async (k) => {
          // Synchronous mirror prevents a reload aborting the final IDB transaction.
          try {
            const value = localStorage.getItem(k);
            if (value !== null) return value;
          } catch {
            /* Browser may deny localStorage. */
          }
          try {
            return (await get(k)) ?? null;
          } catch {
            return null;
          }
        },
        setItem: async (k, v) => {
          try {
            localStorage.setItem(k, v);
          } catch {
            /* IDB remains the fallback. */
          }
          try {
            await set(k, v);
          } catch {
            /* Retain the synchronous local mirror. */
          }
        },
        removeItem: async (k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* Storage unavailable. */
          }
          try {
            await del(k);
          } catch {
            /* Storage unavailable. */
          }
        },
      })),
      partialize: (s) => ({
        name: s.name,
        theme: s.theme,
        language: s.language,
        favorites: s.favorites,
        location: s.location,
        activeTrip: s.activeTrip,
        rides: s.rides,
        historyEnabled: s.historyEnabled,
        history: s.history,
      }),
    },
  ),
);
