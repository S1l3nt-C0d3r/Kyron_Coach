import type { Competition } from "../types";

export default function CompetitionCard({
  competition,
}: {
  competition: Competition;
}) {
  const date = new Date(competition.date);

  return (
    <div className="competition-card">
      <div className="date-box">
        <span>{date.toLocaleDateString("en-IN", { month: "short" })}</span>
        <strong>{date.getDate()}</strong>
      </div>

      <div className="competition-info">
        <h3>{competition.name}</h3>
        <p>
          {competition.city}
          {competition.venue ? ` · ${competition.venue}` : ""}
        </p>
        <span className="organizer">{competition.organizer}</span>
      </div>

      <div className="competition-meta">
        <span className="status upcoming">
          {competition.status || "Upcoming"}
        </span>
        <span className="arrow">→</span>
      </div>
    </div>
  );
}
