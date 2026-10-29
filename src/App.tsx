import { useEffect, useState } from "react";
import type { Competition, Page } from "./types";
import type { Athlete, Camp, TrainingSession, WorkoutLog } from "./types";
import { demoTraining } from "./data/demoData";
import { usePersistentState } from "./hooks/UsePersistentState";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import AthletesPage from "./pages/AthletesPage";
import TrainingPage from "./pages/TrainingPage";
import SchedulePage from "./pages/SchedulePage";
import CampsPage from "./pages/CampsPage";
import CompetitionsPage from "./pages/CompetitionsPage";

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
    demoTraining,
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
      `${API_URL}/api/athletes/${encodeURIComponent(id)}`,
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

    const updated = (await response.json()) as Athlete;

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
        const response = await fetch(`${API_URL}/api/app-state/migrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collections: { sessions, camps, workoutLogs },
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Could not load or migrate app data (${response.status})`,
          );
        }

        const result = (await response.json()) as StoredCollectionsResponse;

        if (
          !result.collections ||
          !Array.isArray(result.collections.sessions) ||
          !Array.isArray(result.collections.camps) ||
          !Array.isArray(result.collections.workoutLogs)
        ) {
          throw new Error("The server returned invalid app data.");
        }

        if (cancelled) return;

        setSessions(result.collections.sessions);
        setCamps(result.collections.camps);
        setWorkoutLogs(result.collections.workoutLogs);
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

  const completeSession = (
    sessionId: string,
    efforts: Record<string, number>,
  ) => {
    const session = sessions.find((item) => item.id === sessionId);

    if (!session || session.completed) return;

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
