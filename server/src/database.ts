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

  CREATE TABLE IF NOT EXISTS coach_notes (
    id TEXT PRIMARY KEY,
    athleteId TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_created
    ON coach_notes(athleteId, createdAt DESC);

  CREATE TABLE IF NOT EXISTS app_state (
    state_key TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Scheduled training sessions are stored separately from completed logs.
  CREATE TABLE IF NOT EXISTS training_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    session_date TEXT NOT NULL,
    session_time TEXT NOT NULL,
    category TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    camp_id TEXT,
    mode TEXT NOT NULL DEFAULT 'time',
    sets INTEGER,
    reps INTEGER,
    rounds INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_training_sessions_date
    ON training_sessions(session_date, session_time);

  CREATE TABLE IF NOT EXISTS session_athletes (
    session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, athlete_id)
  );
  CREATE INDEX IF NOT EXISTS idx_session_athletes_athlete
    ON session_athletes(athlete_id);

  CREATE TABLE IF NOT EXISTS training_camps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    competition_id TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Planning',
    data_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS camp_athletes (
    camp_id TEXT NOT NULL REFERENCES training_camps(id) ON DELETE CASCADE,
    athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    PRIMARY KEY (camp_id, athlete_id)
  );

  CREATE TABLE IF NOT EXISTS normalized_collections (
    collection_key TEXT PRIMARY KEY,
    initialized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY,
    athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    log_time TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    rpe REAL NOT NULL DEFAULT 5,
    camp_id TEXT,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_date
    ON workout_logs(athlete_id, log_date DESC);

  CREATE TABLE IF NOT EXISTS akiles_onboarding_invitations (
    id TEXT PRIMARY KEY, athlete_name TEXT NOT NULL, athlete_email TEXT NOT NULL,
    coach_id TEXT NOT NULL, coach_name TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','superseded')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, responded_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_akiles_invites_email ON akiles_onboarding_invitations(athlete_email,status);
  CREATE TABLE IF NOT EXISTS akiles_relationships (
    id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL UNIQUE REFERENCES akiles_onboarding_invitations(id),
    athlete_email TEXT NOT NULL, athlete_name TEXT NOT NULL, coach_id TEXT NOT NULL, coach_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_akiles_relationship_email ON akiles_relationships(athlete_email,status);
  CREATE TABLE IF NOT EXISTS akiles_shared_workouts (
    id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES akiles_relationships(id),
    athlete_email TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, log_date TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0, sets INTEGER, reps INTEGER, rounds INTEGER, rpe REAL NOT NULL DEFAULT 5,
    notes TEXT NOT NULL DEFAULT '', source_workout_id TEXT NOT NULL, UNIQUE(relationship_id,source_workout_id)
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
// Link each Akiles account to the exact Kyron athlete record.
ensureColumn("akiles_onboarding_invitations", "athlete_id", "TEXT");
ensureColumn("akiles_relationships", "athlete_id", "TEXT");

// Store the Kyron athlete ID against every workout received from Akiles.
ensureColumn("akiles_shared_workouts", "athlete_id", "TEXT");

// Link Akiles invitations, relationships and shared workouts
// to the corresponding Kyron athlete record.
ensureColumn("akiles_onboarding_invitations", "athlete_id", "TEXT");
ensureColumn("akiles_relationships", "athlete_id", "TEXT");
ensureColumn("akiles_shared_workouts", "athlete_id", "TEXT");

// Backfill relationships created before athlete_id was added.
db.exec(`
  UPDATE akiles_relationships
  SET athlete_id = (
    SELECT athlete_id
    FROM akiles_onboarding_invitations
    WHERE akiles_onboarding_invitations.id = akiles_relationships.invitation_id
  )
  WHERE athlete_id IS NULL;
`);

// New installations start empty: athlete records are created by the user.

export function closeDatabase(): void {
	db.close();
}
