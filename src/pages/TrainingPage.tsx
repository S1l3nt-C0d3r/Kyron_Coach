import { useEffect, useState } from "react";
import type {
  Athlete,
  Camp,
  TrainingSession,
  WorkoutLog,
  WorkoutLogMode,
} from "../types";
import { dateString, formatDate } from "../utils/date";
import { exerciseOptions } from "../data/exerciseOptions";

type Props = {
  athletes: Athlete[];
  camps: Camp[];
  sessions: TrainingSession[];
  workoutLogs: WorkoutLog[];
  onAddSession: (session: TrainingSession) => void;
  initialAthleteId?: string | null;
};

const workoutCategories = [
  "Technical",
  "Bag work",
  "Sparring",
  "Conditioning",
  "Strength",
  "Mobility",
  "Recovery",
  "Roadwork",
  "Strategy",
];

export default function TrainingPage({
  athletes,
  camps,
  sessions,
  onAddSession,
  initialAthleteId,
}: Props) {
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [title, setTitle] = useState(exerciseOptions[0]?.name ?? "");
  const [category, setCategory] = useState("Technical");
  const [date, setDate] = useState(dateString(0));
  const [time, setTime] = useState("17:00");
  const [mode, setMode] = useState<WorkoutLogMode>("sets-reps");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [duration, setDuration] = useState("60");
  const [rounds, setRounds] = useState("6");
  const [notes, setNotes] = useState("");
  const [campId, setCampId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialAthleteId) {
      setSelectedAthleteIds([initialAthleteId]);
      setShowWorkoutForm(true);
    }
  }, [initialAthleteId]);

  const resetForm = () => {
    setSelectedAthleteIds([]);
    setTitle(exerciseOptions[0]?.name ?? "");
    setCategory("Technical");
    setDate(dateString(0));
    setTime("17:00");
    setMode("sets-reps");
    setSets("3");
    setReps("10");
    setDuration("60");
    setRounds("6");
    setNotes("");
    setCampId("");
    setError("");
    setShowWorkoutForm(false);
  };

  const saveWorkout = () => {
    if (!selectedAthleteIds.length || !title.trim() || !date || !time) {
      setError("Select at least one athlete and complete the workout details.");
      return;
    }

    const selectedCamp = camps.find((camp) => camp.id === campId);

    if (campId && !selectedCamp) {
      setError("The selected camp could not be found.");
      return;
    }

    if (
      selectedCamp &&
      selectedAthleteIds.some((id) => !selectedCamp.athleteIds.includes(id))
    ) {
      setError("Every selected athlete must belong to the selected camp.");
      return;
    }

    const session: TrainingSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      date,
      time,
      type: category,
      duration: mode === "sets-reps" ? 0 : Math.max(1, Number(duration) || 1),
      athleteIds: selectedAthleteIds,
      completed: false,
      mode,
      ...(mode !== "time" && {
        sets: Math.max(1, Number(sets) || 1),
        reps: Math.max(1, Number(reps) || 1),
      }),
      ...(mode !== "sets-reps" && {
        rounds: Math.max(0, Number(rounds) || 0),
      }),
      notes: notes.trim(),
      ...(campId ? { campId } : {}),
    };

    onAddSession(session);
    resetForm();
  };

  const athleteName = (id: string) =>
    athletes.find((athlete) => athlete.id === id)?.name ?? "Removed athlete";

  const today = dateString(0);

  const todaySessions = sessions
    .filter((session) => session.date === today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">TRAINING</p>
          <h1>Training</h1>
          <p className="muted">
            Schedule workouts first. Completed sessions are added to athlete
            history.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            if (showWorkoutForm) {
              resetForm();
            } else {
              setSelectedAthleteIds(initialAthleteId ? [initialAthleteId] : []);
              setShowWorkoutForm(true);
            }
          }}
          disabled={!athletes.length}
        >
          {showWorkoutForm ? "Cancel" : "+ Schedule Workout"}
        </button>
      </header>

      {athletes.length === 0 && (
        <div className="empty-state">
          Add an athlete in the Athletes section before scheduling a workout.
        </div>
      )}

      {showWorkoutForm && athletes.length > 0 && (
        <div className="form-card workout-log-form">
          <h2>Schedule workout</h2>

          <div className="form-grid">
            <div className="tracker-field">
              <span>Assign athletes</span>

              <div className="athlete-selector">
                {athletes.map((athlete) => {
                  const selected = selectedAthleteIds.includes(athlete.id);

                  return (
                    <button
                      type="button"
                      key={athlete.id}
                      className={`athlete-select ${selected ? "selected" : ""}`}
                      onClick={() =>
                        setSelectedAthleteIds((current) =>
                          selected
                            ? current.filter((id) => id !== athlete.id)
                            : [...current, athlete.id],
                        )
                      }
                    >
                      {athlete.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="tracker-field">
              Exercise
              <select
                className="form-input"
                value={title}
                onChange={(event) => {
                  const exercise = exerciseOptions.find(
                    (item) => item.name === event.target.value,
                  );

                  setTitle(event.target.value);

                  if (exercise) {
                    setCategory(exercise.category);
                  }
                }}
              >
                {exerciseOptions.map((exercise) => (
                  <option key={exercise.name} value={exercise.name}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              Category
              <select
                className="form-input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {workoutCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              Training camp
              <select
                className="form-input"
                value={campId}
                onChange={(event) => setCampId(event.target.value)}
              >
                <option value="">No camp</option>
                {camps.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              Workout date
              <input
                className="form-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <label className="tracker-field">
              Workout time
              <input
                className="form-input"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="tracker-field">
            <p>Tracking method</p>

            <div
              className="workout-mode-toggle"
              role="group"
              aria-label="Workout tracking method"
            >
              {(
                [
                  { value: "sets-reps", label: "Sets & Reps" },
                  { value: "time", label: "Time" },
                  { value: "both", label: "Both" },
                ] as const
              ).map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`workout-mode-option ${
                    mode === option.value ? "selected" : ""
                  }`}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid">
            {mode !== "time" && (
              <>
                <label className="tracker-field">
                  Sets
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={sets}
                    onChange={(event) => setSets(event.target.value)}
                  />
                </label>

                <label className="tracker-field">
                  Reps per set
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={reps}
                    onChange={(event) => setReps(event.target.value)}
                  />
                </label>
              </>
            )}

            {mode !== "sets-reps" && (
              <>
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
                  Rounds
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={rounds}
                    onChange={(event) => setRounds(event.target.value)}
                  />
                </label>
              </>
            )}

            <label className="tracker-field">
              Notes
              <input
                className="form-input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </label>
          </div>

          {error && (
            <p className="muted" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button className="secondary-button" onClick={resetForm}>
              Cancel
            </button>

            <button
              className="primary-button"
              onClick={saveWorkout}
              disabled={!selectedAthleteIds.length || !title.trim()}
            >
              Add to Schedule
            </button>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Today's scheduled workouts</h2>
            <p className="muted">
              Only workouts scheduled for today are shown here. Full scheduling
              history is available in Schedule.
            </p>
          </div>
        </div>

        {todaySessions.length === 0 ? (
          <div className="empty-state">No workouts scheduled for today.</div>
        ) : (
          <div className="workout-log-list">
            {todaySessions.map((session) => (
              <div className="workout-log-row" key={session.id}>
                <strong>{session.title}</strong>
                <span>
                  {formatDate(session.date)} · {session.time} · {session.type}
                </span>
                <span>{session.athleteIds.map(athleteName).join(", ")}</span>

                {session.campId && (
                  <span>
                    Camp:{" "}
                    {camps.find((camp) => camp.id === session.campId)?.name ??
                      "Camp"}
                  </span>
                )}

                <span>{session.completed ? "Completed" : "Scheduled"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
