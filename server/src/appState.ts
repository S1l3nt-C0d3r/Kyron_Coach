import { Router, type Request, type Response } from "express";
import { db } from "./database";

const router = Router();

const COLLECTION_KEYS = ["sessions", "camps", "workoutLogs"] as const;

type CollectionKey = (typeof COLLECTION_KEYS)[number];

type AppState = Record<CollectionKey, unknown[]>;

function isCollectionKey(value: string): value is CollectionKey {
  return COLLECTION_KEYS.includes(value as CollectionKey);
}

function readCollection(key: CollectionKey): unknown[] {
  const row = db
    .prepare("SELECT state_json FROM app_state WHERE state_key = ?")
    .get(key) as { state_json: string } | undefined;

  if (!row) return [];

  try {
    const parsed: unknown = JSON.parse(row.state_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error(`Invalid JSON stored for app_state.${key}`);
    return [];
  }
}

function writeCollection(key: CollectionKey, value: unknown[]) {
  db.prepare(
    `
    INSERT INTO app_state (state_key, state_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(state_key) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = CURRENT_TIMESTAMP
  `,
  ).run(key, JSON.stringify(value));
}

// GET /api/app-state
router.get("/", (_req: Request, res: Response) => {
  const collections = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [key, readCollection(key)]),
  ) as AppState;

  const initializedRows = db
    .prepare("SELECT state_key FROM app_state")
    .all() as { state_key: string }[];

  const initialized = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [
      key,
      initializedRows.some((row) => row.state_key === key),
    ]),
  );

  res.json({ collections, initialized });
});

// PUT /api/app-state/:collection
router.put("/:collection", (req: Request, res: Response) => {
  const rawKey = req.params.collection;

  if (typeof rawKey !== "string" || !isCollectionKey(rawKey)) {
    return res.status(404).json({
      error: "Unknown data collection.",
    });
  }

  const key = rawKey;

  if (!Array.isArray(req.body?.data)) {
    return res.status(400).json({
      error: "The request body must contain a data array.",
    });
  }

  writeCollection(key, req.body.data);

  return res.json({
    success: true,
    collection: key,
  });
});
// POST /api/app-state/migrate
// Imports browser data only when that SQLite collection has never
// been initialized. Existing SQLite data is never overwritten.
router.post("/migrate", (req: Request, res: Response) => {
  const incoming = req.body?.collections;

  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({
      error: "Expected a collections object.",
    });
  }

  const migrateTransaction = db.transaction(() => {
    const insertIfMissing = db.prepare(`
      INSERT OR IGNORE INTO app_state
        (state_key, state_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    for (const key of COLLECTION_KEYS) {
      const data = incoming[key];

      if (!Array.isArray(data)) {
        continue;
      }

      insertIfMissing.run(key, JSON.stringify(data));
    }
  });

  migrateTransaction();

  const collections = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [key, readCollection(key)]),
  ) as AppState;

  return res.json({
    success: true,
    collections,
  });
});

export default router;
