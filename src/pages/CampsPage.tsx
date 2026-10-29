import { useEffect, useMemo, useState } from "react";
import type { Athlete, Camp, Competition, TrainingSession } from "../types";
import { dateString, formatDate } from "../utils/date";
import SessionCard from "../components/SessionCard";

type Props = {
  camps: Camp[];
  setCamps: React.Dispatch<React.SetStateAction<Camp[]>>;
  competitions: Competition[];
  athletes: Athlete[];
  sessions: TrainingSession[];
  onOpenAthlete: (id: string) => void;
  initialCompetitionId?: string;
};

export default function CampsPage({
  camps,
  setCamps,
  competitions,
  athletes,
  sessions,
  onOpenAthlete,
  initialCompetitionId = "",
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [competitionId, setCompetitionId] = useState(initialCompetitionId);
  const [startDate, setStartDate] = useState(dateString(0));
  const [endDate, setEndDate] = useState(dateString(21));
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialCompetitionId) {
      setCompetitionId(initialCompetitionId);
      setShowForm(true);
    } else if (!competitionId && competitions.length > 0) {
      setCompetitionId(competitions[0].id);
    }
  }, [initialCompetitionId, competitions, competitionId]);

  const selectedCamp = camps.find((camp) => camp.id === selectedCampId);

  const campSessions = useMemo(() => {
    if (!selectedCamp) return [];

    return sessions
      .filter((session) => session.campId === selectedCamp.id)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime(),
      );
  }, [selectedCamp, sessions]);

  const campAthletes = selectedCamp
    ? athletes.filter((athlete) => selectedCamp.athleteIds.includes(athlete.id))
    : [];

  const addCamp = () => {
    if (!name.trim() || !startDate || !endDate) {
      setError("Enter a camp name, start date, and end date.");
      return;
    }

    if (endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }

    const camp: Camp = {
      id: `camp-${Date.now()}`,
      name: name.trim(),
      competitionId,
      startDate,
      endDate,
      athleteIds:
        selectedAthletes.length > 0
          ? selectedAthletes
          : athletes.map((athlete) => athlete.id),
      status: "Planning",
    };

    setCamps((current) => [...current, camp]);
    setName("");
    setCompetitionId(initialCompetitionId || competitions[0]?.id || "");
    setStartDate(dateString(0));
    setEndDate(dateString(21));
    setSelectedAthletes([]);
    setDescription("");
    setError("");
    setShowForm(false);
  };

  const toggleAthlete = (id: string) => {
    setSelectedAthletes((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const deleteCamp = (camp: Camp) => {
    if (
      !window.confirm(
        `Delete "${camp.name}"? Its scheduled training sessions will remain, but will no longer be associated with this camp.`,
      )
    ) {
      return;
    }

    setCamps((current) => current.filter((item) => item.id !== camp.id));

    if (selectedCampId === camp.id) {
      setSelectedCampId(null);
    }
  };

  if (selectedCamp) {
    const competition = competitions.find(
      (item) => item.id === selectedCamp.competitionId,
    );

    return (
      <>
        <button className="back-button" onClick={() => setSelectedCampId(null)}>
          ← Back to camps
        </button>

        <header className="page-header">
          <div>
            <p className="eyebrow">TRAINING CAMP</p>
            <h1>{selectedCamp.name}</h1>
            <p className="muted">
              {competition?.name ?? "Competition not selected"}
            </p>
          </div>
          <span className="status upcoming">{selectedCamp.status}</span>
        </header>

        <section className="section">
          <div className="section-header">
            <div>
              <h2>Camp details</h2>
              <p className="muted">Competition preparation timeline.</p>
            </div>
          </div>

          <div className="form-card">
            <div className="athlete-details">
              <div>
                <span>Start date</span>
                <strong>{formatDate(selectedCamp.startDate)}</strong>
              </div>
              <div>
                <span>End date</span>
                <strong>{formatDate(selectedCamp.endDate)}</strong>
              </div>
              <div>
                <span>Athletes</span>
                <strong>{campAthletes.length}</strong>
              </div>
              <div>
                <span>Scheduled sessions</span>
                <strong>{campSessions.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <div>
              <h2>Athletes in camp</h2>
              <p className="muted">Performance scores and athlete profiles.</p>
            </div>
          </div>

          {campAthletes.length === 0 ? (
            <div className="empty-state">
              No athletes are assigned to this camp.
            </div>
          ) : (
            <div className="athlete-grid">
              {campAthletes.map((athlete) => (
                <article className="athlete-card" key={athlete.id}>
                  <h3>{athlete.name}</h3>
                  <p className="athlete-category">
                    {athlete.category} · {athlete.weightClass} · Age{" "}
                    {athlete.age}
                  </p>

                  <div className="athlete-details">
                    <div>
                      <span>Power</span>
                      <strong>{athlete.power ?? "—"}/10</strong>
                    </div>
                    <div>
                      <span>Speed</span>
                      <strong>{athlete.speed ?? "—"}/10</strong>
                    </div>
                    <div>
                      <span>Endurance</span>
                      <strong>{athlete.endurance ?? "—"}/10</strong>
                    </div>
                  </div>

                  <button
                    className="secondary-button"
                    style={{ marginTop: 12 }}
                    onClick={() => onOpenAthlete(athlete.id)}
                  >
                    View athlete profile
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <div>
              <h2>Camp training schedule</h2>
              <p className="muted">
                Sessions assigned to this camp, in chronological order.
              </p>
            </div>
          </div>

          {campSessions.length === 0 ? (
            <div className="empty-state">
              No sessions are scheduled for this camp yet. Add a workout from
              Training or Schedule and assign it to this camp.
            </div>
          ) : (
            <div className="session-list">
              {campSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  athletes={athletes}
                />
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">CAMPS</p>
          <h1>Training Camps</h1>
          <p className="muted">
            Organise competition preparation, athletes, and training sessions.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? "Cancel" : "+ Create Camp"}
        </button>
      </header>

      {showForm && (
        <div className="form-card">
          <h2>Create training camp</h2>

          <div className="form-grid">
            <label className="tracker-field">
              Camp name
              <input
                className="form-input"
                placeholder="e.g. National Championship Camp"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="tracker-field">
              Competition
              <select
                className="form-input"
                value={competitionId}
                onChange={(event) => setCompetitionId(event.target.value)}
              >
                <option value="">Select competition</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="tracker-field">
              Start date
              <input
                className="form-input"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (endDate < event.target.value) {
                    setEndDate(event.target.value);
                  }
                }}
              />
            </label>

            <label className="tracker-field">
              End date
              <input
                className="form-input"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>

          <div className="tracker-field" style={{ marginTop: 18 }}>
            <span>Choose athletes for this camp</span>
            <p className="muted">
              If you select none, all current athletes will be included.
            </p>
            <div className="athlete-selector">
              {athletes.map((athlete) => (
                <button
                  type="button"
                  key={athlete.id}
                  className={`athlete-select ${
                    selectedAthletes.includes(athlete.id) ? "selected" : ""
                  }`}
                  onClick={() => toggleAthlete(athlete.id)}
                >
                  {athlete.name}
                </button>
              ))}
            </div>
          </div>

          {error && <p role="alert">{error}</p>}

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
            <button className="primary-button" onClick={addCamp}>
              Create Camp
            </button>
          </div>
        </div>
      )}

      {camps.length === 0 ? (
        <div className="empty-state">
          No camps created yet. Create a camp to organise competition
          preparation and training.
        </div>
      ) : (
        <div className="athlete-grid">
          {camps.map((camp) => {
            const competition = competitions.find(
              (item) => item.id === camp.competitionId,
            );
            const sessionCount = sessions.filter(
              (session) => session.campId === camp.id,
            ).length;

            return (
              <article className="athlete-card" key={camp.id}>
                <p className="eyebrow">TRAINING CAMP</p>
                <h3>{camp.name}</h3>
                <p className="athlete-category">
                  {competition?.name ?? "No competition selected"}
                </p>

                <div className="athlete-details">
                  <div>
                    <span>Starts</span>
                    <strong>{formatDate(camp.startDate)}</strong>
                  </div>
                  <div>
                    <span>Ends</span>
                    <strong>{formatDate(camp.endDate)}</strong>
                  </div>
                </div>

                <div className="athlete-details" style={{ marginTop: 12 }}>
                  <div>
                    <span>Athletes</span>
                    <strong>{camp.athleteIds.length}</strong>
                  </div>
                  <div>
                    <span>Sessions</span>
                    <strong>{sessionCount}</strong>
                  </div>
                </div>

                <div className="camp-card-actions">
                  <button
                    className="primary-button"
                    onClick={() => setSelectedCampId(camp.id)}
                  >
                    View camp details
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => deleteCamp(camp)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
