import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./database";
import athletesRouter from "./athletes";
import appStateRouter from "./appState";
import { getCompetitions } from "../store";
import { runIngestion } from "./ingestion";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({
      status: "ok",
      service: "kyron-coach-server",
      database: "sqlite",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "error", database: "unavailable" });
  }
});

// Both routers import the same singleton SQLite connection from database.ts.
app.use("/api/athletes", athletesRouter);
app.use("/api/app-state", appStateRouter);

app.get("/api/competitions", (_req, res) => {
  try {
    res.json(getCompetitions());
  } catch (error) {
    console.error("Failed to load competitions:", error);
    res.status(500).json({ error: "Failed to load competitions" });
  }
});

app.post("/api/internal/ingestion/run", async (_req, res) => {
  try {
    const discovered = await runIngestion();
    res.json({ success: true, discovered });
  } catch (error) {
    console.error("Ingestion failed:", error);
    res.status(500).json({ success: false, error: "Ingestion failed" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🥊 Kyron Coach server running at http://localhost:${PORT}`);
  console.log("SQLite database: data/kyron-coach.sqlite");
});

// Avoid starting overlapping ingestion runs; keep ingestion failures separate
// from core API availability so the athlete and training APIs remain online.
let ingestionRunning = false;
async function safeIngestion() {
  if (ingestionRunning) return;
  ingestionRunning = true;
  try {
    await runIngestion();
  } catch (error) {
    console.error("Competition ingestion failed:", error);
  } finally {
    ingestionRunning = false;
  }
}

void safeIngestion();
const ingestionTimer = setInterval(() => void safeIngestion(), 30 * 60 * 1000);

function shutdown() {
  clearInterval(ingestionTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
