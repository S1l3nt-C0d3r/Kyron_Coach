import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Athlete = {
  id: string;
  name: string;
  age: number;
  weightClass: string;
  category: string;
  status: "Active" | "Inactive";
  power: number;
  speed: number;
  endurance: number;
  createdAt?: string;
  updatedAt?: string;
};

const dataDirectory = path.join(process.cwd(), "data");

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "kyron-coach.sqlite");

export const db = new Database(databasePath);

// Improves read/write performance while preserving database consistency.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age > 0),
    weightClass TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active'
      CHECK (status IN ('Active', 'Inactive')),
    power REAL NOT NULL DEFAULT 5 CHECK (power >= 0 AND power <= 10),
    speed REAL NOT NULL DEFAULT 5 CHECK (speed >= 0 AND speed <= 10),
    endurance REAL NOT NULL DEFAULT 5
      CHECK (endurance >= 0 AND endurance <= 10),
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_athletes_name
    ON athletes(name);

  CREATE INDEX IF NOT EXISTS idx_athletes_status
    ON athletes(status);

  CREATE TABLE IF NOT EXISTS app_state (
    state_key TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Adds a column to an existing table only if it is missing.
 * This makes startup migrations safe to run repeatedly.
 */
function ensureColumn(
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

// Migrate existing databases without deleting athlete records.
// SQLite will populate existing rows with the specified default values.
ensureColumn("athletes", "power", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "speed", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "endurance", "REAL NOT NULL DEFAULT 5");
ensureColumn("athletes", "createdAt", "TEXT");
ensureColumn("athletes", "updatedAt", "TEXT");

// Seed demo athletes only when the table is empty.
const athleteCount = (
  db.prepare("SELECT COUNT(*) AS count FROM athletes").get() as {
    count: number;
  }
).count;

if (athleteCount === 0) {
  const insertAthlete = db.prepare(`
    INSERT INTO athletes (
      id,
      name,
      age,
      weightClass,
      category,
      status,
      power,
      speed,
      endurance
    )
    VALUES (
      @id,
      @name,
      @age,
      @weightClass,
      @category,
      @status,
      @power,
      @speed,
      @endurance
    )
  `);

  const seedAthletes: Athlete[] = [
    {
      id: "athlete-1",
      name: "Arjun Mehta",
      age: 19,
      weightClass: "60 kg",
      category: "Elite",
      status: "Active",
      power: 8,
      speed: 8,
      endurance: 8,
    },
    {
      id: "athlete-2",
      name: "Rohan Patil",
      age: 17,
      weightClass: "63.5 kg",
      category: "Youth",
      status: "Active",
      power: 7,
      speed: 8,
      endurance: 7,
    },
    {
      id: "athlete-3",
      name: "Kabir Shah",
      age: 16,
      weightClass: "57 kg",
      category: "Youth",
      status: "Active",
      power: 7,
      speed: 9,
      endurance: 8,
    },
  ];

  const seedTransaction = db.transaction(() => {
    for (const athlete of seedAthletes) {
      insertAthlete.run(athlete);
    }
  });

  seedTransaction();
}

export function closeDatabase(): void {
  db.close();
}
