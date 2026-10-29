import { Router, type Request, type Response } from "express";
import { db } from "./database";

const router = Router();
const COLLECTION_KEYS = ["sessions", "camps", "workoutLogs"] as const;
type CollectionKey = (typeof COLLECTION_KEYS)[number];
type AppState = Record<CollectionKey, unknown[]>;
const isCollectionKey = (value: string): value is CollectionKey =>
  COLLECTION_KEYS.includes(value as CollectionKey);

function readLegacyCollection(key: CollectionKey): unknown[] {
  const row = db.prepare("SELECT state_json FROM app_state WHERE state_key = ?")
    .get(key) as { state_json: string } | undefined;
  if (!row) return [];
  try {
    const parsed: unknown = JSON.parse(row.state_json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error(`Invalid JSON stored in app_state.${key}`);
    return [];
  }
}

function readNormalizedCollection(key: CollectionKey): unknown[] {
  if (key === "sessions") {
    return (db.prepare(`SELECT s.data_json, s.id, GROUP_CONCAT(sa.athlete_id) AS athlete_ids
      FROM training_sessions s LEFT JOIN session_athletes sa ON sa.session_id = s.id
      GROUP BY s.id ORDER BY s.session_date, s.session_time`).all() as Array<{data_json:string; id:string; athlete_ids:string|null}>)
      .map((row) => {
        try {
          const value = JSON.parse(row.data_json) as Record<string, unknown>;
          value.athleteIds = row.athlete_ids ? row.athlete_ids.split(",") : [];
          return value;
        } catch { return null; }
      }).filter(Boolean) as unknown[];
  }
  if (key === "camps") {
    return (db.prepare(`SELECT c.data_json, c.id, GROUP_CONCAT(ca.athlete_id) AS athlete_ids
      FROM training_camps c LEFT JOIN camp_athletes ca ON ca.camp_id = c.id
      GROUP BY c.id ORDER BY c.start_date`).all() as Array<{data_json:string; id:string; athlete_ids:string|null}>)
      .map((row) => {
        try {
          const value = JSON.parse(row.data_json) as Record<string, unknown>;
          value.athleteIds = row.athlete_ids ? row.athlete_ids.split(",") : [];
          return value;
        } catch { return null; }
      }).filter(Boolean) as unknown[];
  }
  return (db.prepare("SELECT data_json FROM workout_logs ORDER BY log_date DESC, log_time DESC").all() as Array<{data_json:string}>)
    .map((row) => { try { return JSON.parse(row.data_json); } catch { return null; } })
    .filter(Boolean) as unknown[];
}

function collectionHasRows(key: CollectionKey): boolean {
  const marked = db.prepare("SELECT 1 AS found FROM normalized_collections WHERE collection_key = ?").get(key) as {found:number}|undefined;
  if (marked) return true;
  const table = key === "sessions" ? "training_sessions" : key === "camps" ? "training_camps" : "workout_logs";
  return Boolean((db.prepare(`SELECT 1 AS found FROM ${table} LIMIT 1`).get() as {found:number}|undefined)?.found);
}

function readCollection(key: CollectionKey): unknown[] {
  return collectionHasRows(key) ? readNormalizedCollection(key) : readLegacyCollection(key);
}

function saveSessions(data: unknown[]) {
  const athletes = new Set((db.prepare("SELECT id FROM athletes").all() as {id:string}[]).map(x => x.id));
  const insertSession = db.prepare(`INSERT INTO training_sessions
    (id,title,session_date,session_time,category,duration,completed,camp_id,mode,sets,reps,rounds,notes,data_json)
    VALUES (@id,@title,@date,@time,@type,@duration,@completed,@campId,@mode,@sets,@reps,@rounds,@notes,@json)`);
  const insertLink = db.prepare("INSERT INTO session_athletes(session_id, athlete_id) VALUES (?, ?)");
  db.prepare("DELETE FROM training_sessions").run();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    if (typeof s.id !== "string" || typeof s.title !== "string" || typeof s.date !== "string") continue;
    const ids = Array.isArray(s.athleteIds) ? s.athleteIds.filter((id): id is string => typeof id === "string" && athletes.has(id)) : [];
    const cleaned = {...s, athleteIds: ids};
    insertSession.run({id:s.id,title:s.title, date:s.date,time:typeof s.time === "string" ? s.time : "00:00",
      type:typeof s.type === "string" ? s.type : "Training", duration:Number(s.duration)||0,
      completed:s.completed ? 1 : 0, campId:typeof s.campId === "string" ? s.campId : null,
      mode:typeof s.mode === "string" ? s.mode : "time", sets:typeof s.sets === "number" ? s.sets : null,
      reps:typeof s.reps === "number" ? s.reps : null, rounds:typeof s.rounds === "number" ? s.rounds : null,
      notes:typeof s.notes === "string" ? s.notes : "", json:JSON.stringify(cleaned)});
    for (const id of ids) insertLink.run(s.id, id);
  }
}

function saveCamps(data: unknown[]) {
  const athletes = new Set((db.prepare("SELECT id FROM athletes").all() as {id:string}[]).map(x => x.id));
  const insert = db.prepare(`INSERT INTO training_camps(id,name,competition_id,start_date,end_date,status,data_json)
    VALUES (@id,@name,@competitionId,@startDate,@endDate,@status,@json)`);
  const link = db.prepare("INSERT INTO camp_athletes(camp_id,athlete_id) VALUES (?,?)");
  db.prepare("DELETE FROM training_camps").run();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.name !== "string") continue;
    const ids = Array.isArray(c.athleteIds) ? c.athleteIds.filter((id): id is string => typeof id === "string" && athletes.has(id)) : [];
    const cleaned = {...c, athleteIds: ids};
    insert.run({id:c.id,name:c.name,competitionId:typeof c.competitionId === "string" ? c.competitionId : "",
      startDate:typeof c.startDate === "string" ? c.startDate : "",endDate:typeof c.endDate === "string" ? c.endDate : "",
      status:typeof c.status === "string" ? c.status : "Planning",json:JSON.stringify(cleaned)});
    for (const id of ids) link.run(c.id,id);
  }
}

function saveWorkoutLogs(data: unknown[]) {
  const athletes = new Set((db.prepare("SELECT id FROM athletes").all() as {id:string}[]).map(x => x.id));
  const insert = db.prepare(`INSERT INTO workout_logs(id,athlete_id,log_date,log_time,title,category,rpe,camp_id,data_json)
    VALUES (@id,@athleteId,@date,@time,@title,@category,@rpe,@campId,@json)`);
  db.prepare("DELETE FROM workout_logs").run();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const log = item as Record<string, unknown>;
    if (typeof log.id !== "string" || typeof log.athleteId !== "string" || !athletes.has(log.athleteId)) continue;
    insert.run({id:log.id,athleteId:log.athleteId,date:typeof log.date === "string" ? log.date : "",
      time:typeof log.time === "string" ? log.time : "",title:typeof log.title === "string" ? log.title : "Workout",
      category:typeof log.category === "string" ? log.category : "Training",rpe:typeof log.rpe === "number" ? log.rpe : 5,
      campId:typeof log.campId === "string" ? log.campId : null,json:JSON.stringify(log)});
  }
}

function persistCollection(key: CollectionKey, data: unknown[]) {
  const tx = db.transaction(() => {
    if (key === "sessions") saveSessions(data);
    else if (key === "camps") saveCamps(data);
    else saveWorkoutLogs(data);
    db.prepare("INSERT OR IGNORE INTO normalized_collections(collection_key) VALUES (?)").run(key);
    db.prepare(`INSERT INTO app_state(state_key,state_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(state_key) DO UPDATE SET state_json=excluded.state_json, updated_at=CURRENT_TIMESTAMP`)
      .run(key, JSON.stringify(readNormalizedCollection(key)));
  });
  tx();
}

router.get("/", (_req: Request, res: Response) => {
  const collections = Object.fromEntries(COLLECTION_KEYS.map(key => [key, readCollection(key)])) as AppState;
  const initializedRows = db.prepare("SELECT state_key FROM app_state").all() as {state_key:string}[];
  const initialized = Object.fromEntries(COLLECTION_KEYS.map(key => [key,
    initializedRows.some(row => row.state_key === key) || collectionHasRows(key)]));
  res.json({collections, initialized});
});

router.put("/:collection", (req: Request, res: Response) => {
  const rawKey = req.params.collection;
  if (typeof rawKey !== "string" || !isCollectionKey(rawKey)) return res.status(404).json({error:"Unknown data collection."});
  if (!Array.isArray(req.body?.data)) return res.status(400).json({error:"The request body must contain a data array."});
  try {
    persistCollection(rawKey, req.body.data);
    return res.json({success:true, collection:rawKey, count:readCollection(rawKey).length});
  } catch (error) {
    console.error(`Failed to persist ${rawKey}:`, error);
    return res.status(500).json({error:`Failed to save ${rawKey} to SQLite. Check athlete references and retry.`});
  }
});

router.post("/migrate", (req: Request, res: Response) => {
  const incoming = req.body?.collections;
  if (!incoming || typeof incoming !== "object") return res.status(400).json({error:"Expected a collections object."});
  try {
    const tx = db.transaction(() => {
      for (const key of COLLECTION_KEYS) {
        if (!Array.isArray(incoming[key])) continue;
        const alreadyExists = collectionHasRows(key) || Boolean(db.prepare("SELECT 1 FROM app_state WHERE state_key=?").get(key));
        if (!alreadyExists) persistCollection(key, incoming[key]);
      }
    });
    tx();
    const collections = Object.fromEntries(COLLECTION_KEYS.map(key => [key, readCollection(key)])) as AppState;
    return res.json({success:true, collections});
  } catch (error) {
    console.error("App data migration failed:", error);
    return res.status(500).json({error:"Could not migrate training data to SQLite."});
  }
});

export default router;
