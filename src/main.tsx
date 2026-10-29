import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      networkMode: "always",
      retry: 1,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
  },
});
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Even opnieuw verbinden</h1>
        <p>Er ging iets mis. Je opgeslagen voorkeuren blijven behouden.</p>
        <button onClick={() => location.reload()}>Opnieuw openen</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </Boundary>
  </React.StrictMode>,
);

// Pick up published versions when returning to the installed web app.
if ('serviceWorker' in navigator) {
 let reloading = false;
 const hadController = !!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (hadController && !reloading) { reloading = true; location.reload(); }
 });
 const update = () => { if (!document.hidden && navigator.onLine) navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {}); };
 window.addEventListener('pageshow', update);
 document.addEventListener('visibilitychange', update);
}
