import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { db } from "./storage/db";

void db.open().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
