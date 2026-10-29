import fs from "fs";
import path from "path";

export type Competition = {
  id: string;
  name: string;
  date: string;
  city: string;
  venue?: string;
  organizer: string;
  status?: string;
  registrationUrl?: string;
  source?: string;
  sourceUrl?: string;
  discoveredAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "competitions.json");

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

export function getCompetitions(): Competition[] {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCompetitions(competitions: Competition[]) {
  ensureDatabase();

  fs.writeFileSync(DATA_FILE, JSON.stringify(competitions, null, 2), "utf8");
}

export function addCompetition(competition: Competition) {
  const competitions = getCompetitions();

  const exists = competitions.some(
    (existing) => existing.id === competition.id,
  );

  if (exists) {
    return false;
  }

  competitions.push(competition);
  saveCompetitions(competitions);

  return true;
}

export function upsertCompetition(competition: Competition) {
  const competitions = getCompetitions();

  const index = competitions.findIndex(
    (existing) => existing.id === competition.id,
  );

  if (index >= 0) {
    competitions[index] = {
      ...competitions[index],
      ...competition,
    };
  } else {
    competitions.push(competition);
  }

  saveCompetitions(competitions);
}

export function clearCompetitions() {
  saveCompetitions([]);
}
