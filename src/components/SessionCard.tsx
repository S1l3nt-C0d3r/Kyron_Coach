import type { Athlete, TrainingSession } from "../types";
import { formatDate } from "../utils/date";

type Props = {
  session: TrainingSession;
  athletes: Athlete[];
  interactive?: boolean;
  onComplete?: () => void;
};

export default function SessionCard({
  session,
  athletes,
  interactive = false,
  onComplete,
}: Props) {
  const athleteNames = session.athleteIds
    .map((id) => athletes.find((athlete) => athlete.id === id)?.name)
    .filter(Boolean);

  return (
    <div className={`session-card ${session.completed ? "completed" : ""}`}>
      <div className="session-time">{session.time}</div>

      <div className="session-main">
        <div className="session-type">{session.type}</div>
        <h3>{session.title}</h3>
        <p>
          {formatDate(session.date)} · {session.duration} min
        </p>
        <span className="session-athletes">
          {athleteNames.length
            ? athleteNames.join(", ")
            : "No athletes assigned"}
        </span>
      </div>

      {interactive && (
        <button
          className={session.completed ? "secondary-button" : "primary-button"}
          onClick={onComplete}
        >
          {session.completed ? "Completed" : "Mark Complete"}
        </button>
      )}
    </div>
  );
}
