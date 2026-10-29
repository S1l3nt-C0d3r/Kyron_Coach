import type {
  Athlete,
  Camp,
  Competition,
  Page,
  TrainingSession,
} from "../types";
import AthletePerformanceCard from "../components/AthletePerformanceCard";
import StatCard from "../components/StatCard";
import SessionCard from "../components/SessionCard";
import CompetitionCard from "../components/CompetitionCard";

type Props = {
  competitions: Competition[];
  athletes: Athlete[];
  sessions: TrainingSession[];
  camps: Camp[];
  loading: boolean;
  error: string;
  setPage: (page: Page) => void;
  onOpenAthlete: (id: string) => void;
  onOpenCompetition: (competition: Competition) => void;
};

export default function Dashboard({
  competitions,
  athletes,
  sessions,
  camps,
  loading,
  error,
  setPage,
  onOpenAthlete,
  onOpenCompetition,
}: Props) {
  const now = new Date();

  const upcomingCompetitions = competitions
    .filter((item) => new Date(item.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingSessions = sessions
    .filter((item) => new Date(`${item.date}T${item.time}`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.time}`).getTime() -
        new Date(`${b.date}T${b.time}`).getTime(),
    );

  const activeAthletes = athletes.filter(
    (athlete) => athlete.status === "Active",
  );

  const sessionsThisWeek = sessions.filter((session) => {
    const diff =
      new Date(`${session.date}T${session.time}`).getTime() - now.getTime();

    return diff >= -7 * 86400000 && diff <= 7 * 86400000;
  }).length;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">COACH DASHBOARD</p>
          <h1>Good afternoon, Coach.</h1>
          <p className="muted">
            Everything you need to manage your boxing program.
          </p>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="section athlete-performance-section">
        <div className="section-header">
          <div>
            <h2>Athlete Performance</h2>
            <p className="muted">
              Power, speed, and endurance scores out of 10.
            </p>
          </div>
        </div>

        <div className="athlete-performance-list">
          {activeAthletes.map((athlete) => (
            <AthletePerformanceCard
              key={athlete.id}
              athlete={athlete}
              performance={{
                power: athlete.power ?? 0,
                speed: athlete.speed ?? 0,
                endurance: athlete.endurance ?? 0,
              }}
              onClick={() => onOpenAthlete(athlete.id)}
            />
          ))}

          {activeAthletes.length === 0 && (
            <div className="empty-state">
              No active athletes yet. Add an athlete to get started.
            </div>
          )}
        </div>
      </section>

      <section className="stats-grid dashboard-summary-stats">
        <StatCard
          label="Upcoming Competitions"
          value={loading ? "—" : String(upcomingCompetitions.length)}
        />
        <StatCard
          label="Active Camps"
          value={String(
            camps.filter((camp) => camp.status === "Active").length,
          )}
        />
        <StatCard label="Athletes" value={String(activeAthletes.length)} />
        <StatCard label="Sessions This Week" value={String(sessionsThisWeek)} />
      </section>

      <div className="dashboard-grid">
        <section className="section">
          <div className="section-header">
            <div>
              <h1>Next training</h1>
              <p className="muted">Your upcoming sessions.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setPage("training")}
            >
              Training
            </button>
          </div>

          {upcomingSessions.length === 0 ? (
            <div className="empty-state">No upcoming sessions.</div>
          ) : (
            <div className="session-list">
              {upcomingSessions.slice(0, 4).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  athletes={athletes}
                />
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <div>
              <h1>Upcoming competitions</h1>
              <p className="muted">Competition discovery.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setPage("competitions")}
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : upcomingCompetitions.length === 0 ? (
            <div className="empty-state">No competitions found.</div>
          ) : (
            <div className="competition-list">
              {upcomingCompetitions.slice(0, 4).map((competition) => (
                <button
                  key={competition.id}
                  className="competition-card-button"
                  onClick={() => onOpenCompetition(competition)}
                >
                  <CompetitionCard competition={competition} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
