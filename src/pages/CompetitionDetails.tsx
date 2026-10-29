import type { Competition } from "../types";

type Props = {
  competition: Competition;
  onBack: () => void;
  onStartCamp: () => void;
};

export default function CompetitionDetails({
  competition,
  onBack,
  onStartCamp,
}: Props) {
  const date = new Date(competition.date);

  return (
    <>
      <button className="back-button" onClick={onBack}>
        ← Back to competitions
      </button>

      <header className="page-header">
        <div>
          <p className="eyebrow">COMPETITION</p>
          <h1>{competition.name}</h1>
          <p className="muted">
            {competition.city}
            {competition.venue ? ` · ${competition.venue}` : ""}
          </p>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-card">
          <span className="detail-label">Date</span>
          <strong>
            {date.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
        </div>

        <div className="detail-card">
          <span className="detail-label">Location</span>
          <strong>{competition.city}</strong>
        </div>

        <div className="detail-card">
          <span className="detail-label">Organizer</span>
          <strong>{competition.organizer}</strong>
        </div>

        <div className="detail-card">
          <span className="detail-label">Status</span>
          <strong>{competition.status || "Upcoming"}</strong>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Competition Camp</h2>
            <p className="muted">
              Build a training plan around this competition.
            </p>
          </div>
          <button className="primary-button" onClick={onStartCamp}>
            Start Camp
          </button>
        </div>
        <div className="empty-state">
          Select this competition as the target for your next training camp.
        </div>
      </section>

      {competition.registrationUrl && competition.registrationUrl !== "#" && (
        <section className="section">
          <h2>Registration</h2>
          <a
            className="primary-button inline-button"
            href={competition.registrationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Registration
          </a>
        </section>
      )}

      {competition.source && (
        <section className="source-info">
          <span>Discovered from</span>
          <strong>{competition.source}</strong>
        </section>
      )}
    </>
  );
}
