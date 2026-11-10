import { useState } from "react";
import type { Athlete, Camp, TrainingSession } from "../types";
import { dateString } from "../utils/date";
import SessionCard from "../components/SessionCard";

type Props = {
  sessions: TrainingSession[];
  athletes: Athlete[];
  camps: Camp[];
  onComplete: (id: string, efforts: Record<string, number>) => Promise<void> | void;
  onAddSession: (session: TrainingSession) => void;
};

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function SchedulePage({
  sessions,
  athletes,
  camps,
  onComplete,
  onAddSession,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(dateString(0));
  const [completingSession, setCompletingSession] =
    useState<TrainingSession | null>(null);
  const [efforts, setEfforts] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Shadowboxing");
  const [time, setTime] = useState("17:00");
  const [type, setType] = useState("Technical");
  const [duration, setDuration] = useState("60");
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [campId, setCampId] = useState("");
  const [error, setError] = useState("");
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionError, setCompletionError] = useState("");

  const daySessions = sessions
    .filter((session) => session.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const assignedAthletes =
    completingSession?.athleteIds
      .map((id) => athletes.find((athlete) => athlete.id === id))
      .filter((athlete): athlete is Athlete => Boolean(athlete)) ?? [];

  const openCompletionModal = (session: TrainingSession) => {
    if (session.completed) return;

    setEfforts(Object.fromEntries(session.athleteIds.map((id) => [id, 5])));
    setCompletingSession(session);
  };

  const closeModal = () => {
    if (completionBusy) return;
    setCompletingSession(null);
    setEfforts({});
    setCompletionError("");
  };

  const confirmCompletion = async () => {
    if (!completingSession || completionBusy) return;
    setCompletionBusy(true);
    setCompletionError("");
    try {
      await onComplete(completingSession.id, efforts);
      setCompletingSession(null);
      setEfforts({});
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Could not complete workout.");
    } finally {
      setCompletionBusy(false);
    }
  };

  const saveSession = () => {
    if (!title.trim() || !time || athleteIds.length === 0) {
      setError("Enter a workout title and select at least one athlete.");
      return;
    }

    const camp = camps.find((item) => item.id === campId);

    if (camp && athleteIds.some((id) => !camp.athleteIds.includes(id))) {
      setError("Every selected athlete must belong to the selected camp.");
      return;
    }

    onAddSession({
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      date: selectedDate,
      time,
      type,
      duration: Math.max(1, Number(duration) || 60),
      athleteIds,
      completed: false,
      ...(campId ? { campId } : {}),
    });

    setShowForm(false);
    setTitle("Shadowboxing");
    setAthleteIds([]);
    setCampId("");
    setError("");
  };

  const toggleAthlete = (id: string) => {
    setAthleteIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const weekStart = shiftDate(
    selectedDate,
    -((new Date(`${selectedDate}T12:00:00`).getDay() + 6) % 7),
  );

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    shiftDate(weekStart, index),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">CALENDAR</p>
          <h1>Schedule</h1>
          <p className="muted">View planned and completed workouts by date.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? "Cancel" : "+ Schedule Workout"}
        </button>
      </header>

      <section
        style={{
          marginTop: 24,
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            className="secondary-button"
            onClick={() => setSelectedDate((date) => shiftDate(date, -7))}
          >
            ← Previous week
          </button>

          <button
            className="secondary-button"
            onClick={() => setSelectedDate(dateString(0))}
          >
            Today
          </button>

          <button
            className="secondary-button"
            onClick={() => setSelectedDate((date) => shiftDate(date, 7))}
          >
            Next week →
          </button>

          <label
            className="tracker-field"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginLeft: "auto",
            }}
          >
            Jump to date
            <input
              className="form-input"
              aria-label="Select schedule date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
            />
          </label>
        </div>

        <div
          className="week-selector"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 10,
            paddingTop: 8,
          }}
        >
          {weekDays.map((day) => {
            const date = new Date(`${day}T12:00:00`);

            return (
              <button
                key={day}
                className={`day-button ${selectedDate === day ? "selected" : ""}`}
                onClick={() => setSelectedDate(day)}
              >
                <span>
                  {date.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <strong>{date.getDate()}</strong>
              </button>
            );
          })}
        </div>
      </section>

      {showForm && (
        <div className="form-card">
          <h2>Schedule workout · {selectedDate}</h2>

          <div className="form-grid">
            <label className="tracker-field">
              Workout title
              <input
                className="form-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="tracker-field">
              Time
              <input
                className="form-input"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>

            <label className="tracker-field">
              Duration (minutes)
              <input
                className="form-input"
                type="number"
                min="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </label>

            <label className="tracker-field">
              Category
              <select
                className="form-input"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {[
                  "Technical",
                  "Bag work",
                  "Sparring",
                  "Conditioning",
                  "Strength",
                  "Mobility",
                  "Recovery",
                  "Roadwork",
                  "Strategy",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              Camp
              <select
                className="form-input"
                value={campId}
                onChange={(event) => {
                  const nextCampId = event.target.value;
                  setCampId(nextCampId);

                  if (nextCampId) {
                    const selectedCamp = camps.find(
                      (camp) => camp.id === nextCampId,
                    );

                    if (selectedCamp) {
                      setAthleteIds((current) =>
                        current.filter((id) =>
                          selectedCamp.athleteIds.includes(id),
                        ),
                      );
                    }
                  }
                }}
              >
                <option value="">No camp</option>
                {camps.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tracker-field" style={{ marginTop: 18 }}>
            <span>Assign athletes</span>
            <div className="athlete-selector">
              {athletes
                .filter((athlete) => {
                  const camp = camps.find((item) => item.id === campId);
                  return !camp || camp.athleteIds.includes(athlete.id);
                })
                .map((athlete) => (
                  <button
                    type="button"
                    key={athlete.id}
                    className={`athlete-select ${
                      athleteIds.includes(athlete.id) ? "selected" : ""
                    }`}
                    onClick={() => toggleAthlete(athlete.id)}
                  >
                    {athlete.name}
                  </button>
                ))}
            </div>
          </div>

          {error && (
            <p className="muted" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
            >
              Cancel
            </button>
            <button className="primary-button" onClick={saveSession}>
              Add to Schedule
            </button>
          </div>
        </div>
      )}

      <div className="schedule-day">
        <div className="schedule-date">
          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>

        {daySessions.length === 0 ? (
          <div className="empty-state">No training scheduled for this day.</div>
        ) : (
          <div className="session-list">
            {daySessions.map((session) => (
              <div key={session.id}>
                <SessionCard
                  session={session}
                  athletes={athletes}
                  interactive
                  onComplete={() => openCompletionModal(session)}
                />

                {session.campId && (
                  <p className="muted">
                    Camp:{" "}
                    {camps.find((camp) => camp.id === session.campId)?.name ??
                      "Training camp"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {completingSession && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,.82)",
            backdropFilter: "blur(8px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-title"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#141414",
              color: "#f4eddd",
              border: "1px solid #80632f",
              borderRadius: 16,
              padding: 26,
            }}
          >
            <p className="eyebrow">SESSION REVIEW</p>
            <h2 id="completion-title">Complete workout</h2>
            <p className="muted">
              Record each athlete's effort for {completingSession.title}.
            </p>
            <p className="muted">
              {completingSession.date} · {completingSession.time} ·{" "}
              {assignedAthletes.length} athletes
            </p>

            {assignedAthletes.length === 0 ? (
              <div className="empty-state">
                No assigned athletes were found.
              </div>
            ) : (
              assignedAthletes.map((athlete) => (
                <div className="form-card" key={athlete.id}>
                  <label className="tracker-field">
                    {athlete.name}: {efforts[athlete.id] ?? 5}/10 effort
                    <input
                      aria-label={`${athlete.name} effort rating`}
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={efforts[athlete.id] ?? 5}
                      onChange={(event) =>
                        setEfforts((current) => ({
                          ...current,
                          [athlete.id]: Number(event.target.value),
                        }))
                      }
                      style={{ width: "100%", accentColor: "#c8a45d" }}
                    />
                  </label>
                </div>
              ))
            )}

            {completionError && <p className="muted" role="alert">{completionError}</p>}
            <div className="form-actions">
              <button className="secondary-button" onClick={closeModal} disabled={completionBusy}>
                Cancel
              </button>
              <button className="primary-button" disabled={!assignedAthletes.length || completionBusy} onClick={() => void confirmCompletion()}>
                {completionBusy ? "Saving…" : "Confirm Completion"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
