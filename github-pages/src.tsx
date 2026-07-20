import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Home from "../app/page";
import RuntimeGuard from "../app/runtime-guard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RuntimeGuard><Home /></RuntimeGuard>
  </StrictMode>,
);
