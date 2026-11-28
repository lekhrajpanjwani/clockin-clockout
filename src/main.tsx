import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/global.css";
import { App } from "./App";
import { initMonitoring } from "./lib/monitoring";

void initMonitoring();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element with id "root" was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
