import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

import { getCompetitions } from "./store";
import { runIngestion } from "./ingestion";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Keep the SQLite database in backend/data so it survives server restarts.
const DATA_DIR = path.resolve(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "kyron-coach.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* =========================
   DATABASE INITIALIZATION
========================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    weightClass TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    power REAL NOT NULL DEFAULT 5,
    speed REAL NOT NULL DEFAULT 5,
    endurance REAL NOT NULL DEFAULT 5,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];

  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Safely migrate an existing athletes table if it already exists.
ensureColumn("athletes", "power", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "speed", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "endurance", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "createdAt", "TEXT");
ensureColumn("athletes", "updatedAt", "TEXT");

/* =========================
   TYPES AND VALIDATION
========================= */

type AthleteInput = {
  name: string;
  age: number;
  weightClass: string;
  category: string;
  status?: "Active" | "Inactive";
  power: number;
  speed: number;
  endurance: number;
};

type AthleteRow = {
  id: string;
  name: string;
  age: number;
  weightClass: string;
  category: string;
  status: "Active" | "Inactive";
  power: number;
  speed: number;
  endurance: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10
  );
}

function isValidAthleteInput(value: unknown): value is AthleteInput {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    typeof item.age === "number" &&
    Number.isInteger(item.age) &&
    item.age > 0 &&
    typeof item.weightClass === "string" &&
    item.weightClass.trim().length > 0 &&
    typeof item.category === "string" &&
    item.category.trim().length > 0 &&
    (item.status === undefined ||
      item.status === "Active" ||
      item.status === "Inactive") &&
    isValidScore(item.power) &&
    isValidScore(item.speed) &&
    isValidScore(item.endurance)
  );
}

function getAthlete(id: string): AthleteRow | undefined {
  return db.prepare("SELECT * FROM athletes WHERE id = ?").get(id) as
    | AthleteRow
    | undefined;
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "kyron-coach-server",
    database: "sqlite",
  });
});

/* =========================
   ATHLETES: READ
========================= */

// Read all athletes, including persisted performance stats.
app.get("/api/athletes", (_req, res) => {
  try {
    const athletes = db
      .prepare(
        `
        SELECT
          id,
          name,
          age,
          weightClass,
          category,
          status,
          power,
          speed,
          endurance,
          createdAt,
          updatedAt
        FROM athletes
        ORDER BY name COLLATE NOCASE
      `,
      )
      .all();

    res.json(athletes);
  } catch (error) {
    console.error("Failed to read athletes:", error);
    res.status(500).json({ error: "Failed to load athletes" });
  }
});

// Read one athlete.
app.get("/api/athletes/:id", (req, res) => {
  try {
    const athlete = getAthlete(req.params.id);

    if (!athlete) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    return res.json(athlete);
  } catch (error) {
    console.error("Failed to read athlete:", error);
    return res.status(500).json({ error: "Failed to load athlete" });
  }
});

/* =========================
   ATHLETES: CREATE
========================= */

app.post("/api/athletes", (req, res) => {
  if (!isValidAthleteInput(req.body)) {
    return res.status(400).json({
      error:
        "Invalid athlete. Provide name, positive integer age, weightClass, category, and power, speed, and endurance scores from 0 to 10.",
    });
  }

  const input = req.body;
  const id = `athlete-${crypto.randomUUID()}`;

  try {
    db.prepare(
      `
      INSERT INTO athletes (
        id,
        name,
        age,
        weightClass,
        category,
        status,
        power,
        speed,
        endurance,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
    ).run(
      id,
      input.name.trim(),
      input.age,
      input.weightClass.trim(),
      input.category.trim(),
      input.status ?? "Active",
      input.power,
      input.speed,
      input.endurance,
    );

    const athlete = getAthlete(id);

    return res.status(201).json(athlete);
  } catch (error) {
    console.error("Failed to create athlete:", error);
    return res.status(500).json({ error: "Failed to save athlete" });
  }
});

/* =========================
   ATHLETES: UPDATE
========================= */

// Supports updating performance stats and other athlete details.
app.patch("/api/athletes/:id", (req, res) => {
  const existing = getAthlete(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: "Athlete not found" });
  }

  const allowedFields = [
    "name",
    "age",
    "weightClass",
    "category",
    "status",
    "power",
    "speed",
    "endurance",
  ] as const;

  const body = req.body as Record<string, unknown>;

  const unknownFields = Object.keys(body).filter(
    (key) => !allowedFields.includes(key as (typeof allowedFields)[number]),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: `Unsupported fields: ${unknownFields.join(", ")}`,
    });
  }

  const updated = {
    name: body.name ?? existing.name,
    age: body.age ?? existing.age,
    weightClass: body.weightClass ?? existing.weightClass,
    category: body.category ?? existing.category,
    status: body.status ?? existing.status,
    power: body.power ?? existing.power,
    speed: body.speed ?? existing.speed,
    endurance: body.endurance ?? existing.endurance,
  };

  if (!isValidAthleteInput(updated)) {
    return res.status(400).json({
      error: "Invalid athlete data or performance score. Scores must be 0–10.",
    });
  }

  try {
    db.prepare(
      `
      UPDATE athletes
      SET
        name = ?,
        age = ?,
        weightClass = ?,
        category = ?,
        status = ?,
        power = ?,
        speed = ?,
        endurance = ?,
        updatedAt = datetime('now')
      WHERE id = ?
    `,
    ).run(
      updated.name.trim(),
      updated.age,
      updated.weightClass.trim(),
      updated.category.trim(),
      updated.status ?? "Active",
      updated.power,
      updated.speed,
      updated.endurance,
      req.params.id,
    );

    return res.json(getAthlete(req.params.id));
  } catch (error) {
    console.error("Failed to update athlete:", error);
    return res.status(500).json({ error: "Failed to update athlete" });
  }
});

/* =========================
   ATHLETES: DELETE
========================= */

app.delete("/api/athletes/:id", (req, res) => {
  try {
    const result = db
      .prepare("DELETE FROM athletes WHERE id = ?")
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    return res.status(204).end();
  } catch (error) {
    console.error("Failed to delete athlete:", error);
    return res.status(500).json({ error: "Failed to delete athlete" });
  }
});

/* =========================
   COMPETITIONS
========================= */

app.get("/api/competitions", (_req, res) => {
  try {
    res.json(getCompetitions());
  } catch (error) {
    console.error("Failed to load competitions:", error);
    res.status(500).json({ error: "Failed to load competitions" });
  }
});

/* =========================
   INGESTION
========================= */

app.post("/api/internal/ingestion/run", async (_req, res) => {
  try {
    const discovered = await runIngestion();

    res.json({
      success: true,
      discovered,
    });
  } catch (error) {
    console.error("Ingestion failed:", error);

    res.status(500).json({
      success: false,
      error: "Ingestion failed",
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, async () => {
  console.log(`🥊 Kyron Coach server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${path.join(DATA_DIR, "kyron-coach.sqlite")}`);

  try {
    console.log("Running initial competition ingestion...");
    await runIngestion();
  } catch (error) {
    console.error("Initial competition ingestion failed:", error);
  }

  setInterval(
    () => {
      runIngestion().catch((error) => {
        console.error("Scheduled ingestion failed:", error);
      });
    },
    30 * 60 * 1000,
  );
});
