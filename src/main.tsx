import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./app/App.tsx";
import "./styles/index.css";

// Initialize Sentry error monitoring
// To enable: set VITE_SENTRY_DSN in your environment (.env file)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith("https://")) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
