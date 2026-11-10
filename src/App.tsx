import { useEffect, useState } from "react";
import type { Competition, Page } from "./types";
import type { Athlete, Camp, TrainingSession, WorkoutLog } from "./types";
import { usePersistentState } from "./hooks/UsePersistentState";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AthletesPage from "./pages/AthletesPage";
import TrainingPage from "./pages/TrainingPage";
import SchedulePage from "./pages/SchedulePage";
import CampsPage from "./pages/CampsPage";
import CompetitionsPage from "./pages/CompetitionsPage";
import BackendDownScreen from "./components/BackendDownScreen";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type StoredCollections = {
  sessions: TrainingSession[];
  camps: Camp[];
  workoutLogs: WorkoutLog[];
};

type StoredCollectionsResponse = {
  success: boolean;
  collections: StoredCollections;
};

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(
    null,
  );

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] =
    useState<Competition | null>(null);
  const [campCompetitionId, setCampCompetitionId] = useState("");

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [athleteError, setAthleteError] = useState("");

  const [sessions, setSessions] = usePersistentState<TrainingSession[]>(
    "boxingos-training",
    [],
  );

  const [camps, setCamps] = usePersistentState<Camp[]>("boxingos-camps", []);

  const [workoutLogs, setWorkoutLogs] = usePersistentState<WorkoutLog[]>(
    "boxingos-workout-logs",
    [],
  );

  const [appDataReady, setAppDataReady] = useState(false);
  const [appDataError, setAppDataError] = useState("");
  const [appDataRetry, setAppDataRetry] = useState(0);

  const [loadingCompetitions, setLoadingCompetitions] = useState(true);
  const [competitionError, setCompetitionError] = useState("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [backendError, setBackendError] = useState("Checking backend connection…");
  const [backendRetry, setBackendRetry] = useState(0);

  // Every navigation change starts at the top of the new page. This prevents
  // headers from appearing clipped when the previous page was scrolled down.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page, selectedAthleteId]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const checkBackend = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${API_URL}/api/health`, { signal: controller.signal });
        const payload = await response.json().catch(() => null) as {status?: string; database?: string; error?: string} | null;
        if (!response.ok || payload?.status !== "ok") {
          throw new Error(payload?.error || `Backend health check failed (HTTP ${response.status}).`);
        }
        if (active) {
          setBackendStatus("online");
          setBackendError("");
        }
      } catch (error) {
        const message = error instanceof Error
          ? (error.name === "AbortError" ? "The backend health check timed out after 4 seconds." : error.message)
          : "Unknown connection error.";
        if (active) {
          setBackendStatus("offline");
          setBackendError(`${message} API address: ${API_URL}.`);
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void checkBackend();
    timer = window.setInterval(() => void checkBackend(), 5000);
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [backendRetry]);

  const loadAthletes = async () => {
    setLoadingAthletes(true);
    setAthleteError("");

    try {
      const response = await fetch(`${API_URL}/api/athletes`);

      if (!response.ok) {
        throw new Error(`Could not load athletes (${response.status})`);
      }

      const data = (await response.json()) as Athlete[];
      setAthletes(data);
    } catch (error) {
      console.error("Failed to load athletes from SQLite:", error);
      setAthleteError(
        "Could not connect to the athlete database. Check that the Kyron Coach backend is running, then retry.",
      );
    } finally {
      setLoadingAthletes(false);
    }
  };

  const addAthlete = async (athlete: Omit<Athlete, "id">): Promise<Athlete> => {
    const response = await fetch(`${API_URL}/api/athletes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(athlete),
    });

    const payload = (await response.json().catch(() => null)) as
      | Athlete
      | { error?: string }
      | null;

    if (!response.ok) {
      const message =
        payload && "error" in payload && payload.error
          ? payload.error
          : "Could not save athlete.";

      throw new Error(message);
    }

    if (!payload || !("id" in payload)) {
      throw new Error("The server returned an invalid athlete record.");
    }

    const savedAthlete = payload as Athlete;

    setAthletes((current) => [...current, savedAthlete]);
    setAthleteError("");

    return savedAthlete;
  };

  const updateAthleteStats = async (
    id: string,
    stats: { power: number; speed: number; endurance: number },
  ): Promise<Athlete> => {
    const response = await fetch(
      `${API_URL}/api/athletes/${encodeURIComponent(id)}/performance`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Could not save athlete stats (${response.status}). Ensure the backend supports PATCH /api/athletes/:id.`,
      );
    }

    const payload = (await response.json()) as { success?: boolean; athlete?: Athlete; error?: string };
    if (!payload.athlete) throw new Error(payload.error || "Backend did not return the updated athlete.");
    const updated = payload.athlete;

    setAthletes((current) =>
      current.map((athlete) => (athlete.id === id ? updated : athlete)),
    );

    return updated;
  };

  const deleteAthlete = async (id: string): Promise<void> => {
    const response = await fetch(
      `${API_URL}/api/athletes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error || "Could not remove athlete.");
    }

    setAthletes((current) => current.filter((athlete) => athlete.id !== id));
    setAthleteError("");
  };

  const loadCompetitions = async () => {
    try {
      setLoadingCompetitions(true);
      setCompetitionError("");

      const response = await fetch(`${API_URL}/api/competitions`);

      if (!response.ok) {
        throw new Error("Failed to load competitions");
      }

      const data = (await response.json()) as Competition[];
      setCompetitions(data);
    } catch (error) {
      console.error("Failed to load competitions:", error);
      setCompetitionError(
        "Competition server unavailable. Demo features are still working.",
      );
    } finally {
      setLoadingCompetitions(false);
    }
  };

  useEffect(() => {
    void loadAthletes();
  }, []);

  useEffect(() => {
    void loadCompetitions();

    const interval = window.setInterval(
      () => void loadCompetitions(),
      5 * 60 * 1000,
    );

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAndMigrateAppData() {
      setAppDataReady(false);
      setAppDataError("");

      try {
        const stateResponse = await fetch(`${API_URL}/api/app-state`);
        if (!stateResponse.ok) {
          throw new Error(`Could not load app data (${stateResponse.status})`);
        }

        const state = (await stateResponse.json()) as {
          collections: StoredCollections;
          initialized: Record<keyof StoredCollections, boolean>;
        };

        if (!state.collections || !state.initialized) {
          throw new Error("The server returned invalid app data.");
        }

        let collections = state.collections;
        const needsMigration = !(state.initialized.sessions && state.initialized.camps && state.initialized.workoutLogs);

        if (needsMigration) {
          const migrationResponse = await fetch(`${API_URL}/api/app-state/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Presentation setup: do not import stale browser/demo records.
              // The SQLite collections remain the source of truth.
              collections: { sessions: [], camps: [], workoutLogs: [] },
            }),
          });

          if (!migrationResponse.ok) {
            throw new Error(`Could not migrate app data (${migrationResponse.status})`);
          }

          const migrated = (await migrationResponse.json()) as StoredCollectionsResponse;
          if (!migrated.collections || !Array.isArray(migrated.collections.sessions) || !Array.isArray(migrated.collections.camps) || !Array.isArray(migrated.collections.workoutLogs)) {
            throw new Error("The server returned invalid migrated app data.");
          }
          collections = migrated.collections;
        }

        if (cancelled) return;
        setSessions(collections.sessions);
        setCamps(collections.camps);
        setWorkoutLogs(collections.workoutLogs);
        setAppDataReady(true);
      } catch (error) {
        if (cancelled) return;

        console.error("SQLite app data loading failed:", error);
        setAppDataError(
          "Training data could not be loaded from SQLite. Check that the backend is running, then retry. Your existing browser data has been retained.",
        );
      }
    }

    void loadAndMigrateAppData();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appDataRetry]);

  useEffect(() => {
    if (!appDataReady) return;

    const controller = new AbortController();

    async function saveCollection(
      collection: keyof StoredCollections,
      data: unknown[],
    ) {
      try {
        const response = await fetch(`${API_URL}/api/app-state/${collection}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to save ${collection} (${response.status})`);
        }

        if (!controller.signal.aborted) setAppDataError("");
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(`Failed to persist ${collection}:`, error);
        setAppDataError(
          `Could not save ${collection} to SQLite. Check your backend connection before continuing.`,
        );
      }
    }

    void saveCollection("sessions", sessions);
    void saveCollection("camps", camps);
    void saveCollection("workoutLogs", workoutLogs);

    return () => controller.abort();
  }, [appDataReady, sessions, camps, workoutLogs]);

  const openAthlete = (id: string) => {
    setSelectedAthleteId(id);
    setPage("athletes");
  };

  const openCompetition = (competition: Competition) => {
    setSelectedCompetition(competition);
    setPage("competitions");
  };

  const startCamp = () => {
    setCampCompetitionId(selectedCompetition?.id || "");
    setSelectedCompetition(null);
    setPage("camps");
  };

  const completeSession = async (
    sessionId: string,
    efforts: Record<string, number>,
  ): Promise<void> => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || session.completed) return;

    const response = await fetch(`${API_URL}/api/integrations/training-sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ efforts }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; syncWarning?: string; failures?: unknown[] };
    if (!response.ok) throw new Error(payload.error || `Could not complete workout (${response.status}).`);
    if (payload.syncWarning) setAppDataError(payload.syncWarning);
    else if (payload.failures?.length) setAppDataError(`Workout completed, but Akiles sync failed for ${payload.failures.length} athlete(s).`);

    const newLogs: WorkoutLog[] = session.athleteIds.map((athleteId) => ({
      id: `session-${session.id}-${athleteId}`,
      athleteId,
      date: session.date,
      time: session.time || "00:00",
      title: session.title,
      category: session.type,
      mode: session.mode ?? "time",
      ...(session.sets !== undefined ? { sets: session.sets } : {}),
      ...(session.reps !== undefined ? { reps: session.reps } : {}),
      ...(session.duration > 0 ? { duration: session.duration } : {}),
      ...(session.rounds !== undefined ? { rounds: session.rounds } : {}),
      rpe: efforts[athleteId] ?? 5,
      notes: session.notes?.trim() || "Completed scheduled session.",
      ...(session.campId ? { campId: session.campId } : {}),
    }));

    setWorkoutLogs((current) => {
      const existingIds = new Set(current.map((log) => log.id));
      const uniqueNewLogs = newLogs.filter((log) => !existingIds.has(log.id));

      return [...uniqueNewLogs, ...current];
    });

    setSessions((current) =>
      current.map((item) =>
        item.id === sessionId ? { ...item, completed: true } : item,
      ),
    );
  };

  const addSession = (session: TrainingSession) => {
    setSessions((current) => [...current, session]);
  };

  const retryAppData = () => {
    setAppDataReady(false);
    setAppDataRetry((value) => value + 1);
  };

  if (backendStatus !== "online") {
    return (
      <BackendDownScreen
        status={backendStatus}
        error={backendError}
        onRetry={() => { setBackendStatus("checking"); setBackendError("Retrying backend connection…"); setBackendRetry((value) => value + 1); }}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-content">
        {appDataError && (
          <div className="empty-state" role="alert">
            <p>{appDataError}</p>
            <button className="secondary-button" onClick={retryAppData}>
              Retry database connection
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <Dashboard
            competitions={competitions}
            athletes={athletes}
            sessions={sessions}
            camps={camps}
            loading={loadingCompetitions}
            error={competitionError}
            setPage={setPage}
            onOpenAthlete={openAthlete}
            onOpenCompetition={openCompetition}
          />
        )}

        {page === "competitions" && (
          <CompetitionsPage
            competitions={competitions}
            loading={loadingCompetitions}
            error={competitionError}
            reload={loadCompetitions}
            selectedCompetition={selectedCompetition}
            setSelectedCompetition={setSelectedCompetition}
            onStartCamp={startCamp}
          />
        )}

        {page === "schedule" && (
          <SchedulePage
            sessions={sessions}
            athletes={athletes}
            camps={camps}
            onComplete={completeSession}
            onAddSession={addSession}
          />
        )}

        {page === "athletes" && (
          <AthletesPage
            athletes={athletes}
            loadingAthletes={loadingAthletes}
            athleteError={athleteError}
            onRetryLoadAthletes={loadAthletes}
            onAddAthlete={addAthlete}
            onUpdateAthlete={updateAthleteStats}
            onDeleteAthlete={deleteAthlete}
            workoutLogs={workoutLogs}
            setWorkoutLogs={setWorkoutLogs}
            sessions={sessions}
            selectedAthleteId={selectedAthleteId}
            onSelectAthlete={setSelectedAthleteId}
            onBackToRoster={() => setSelectedAthleteId(null)}
          />
        )}

        {page === "training" && (
          <TrainingPage
            athletes={athletes}
            camps={camps}
            sessions={sessions}
            workoutLogs={workoutLogs}
            onAddSession={addSession}
            onComplete={completeSession}
          />
        )}

        {page === "camps" && (
          <CampsPage
            camps={camps}
            setCamps={setCamps}
            competitions={competitions}
            athletes={athletes}
            sessions={sessions}
            onOpenAthlete={(id) => {
              setSelectedAthleteId(id);
              setPage("athletes");
            }}
            initialCompetitionId={campCompetitionId}
          />
        )}
      </main>
    </div>
  );
}
