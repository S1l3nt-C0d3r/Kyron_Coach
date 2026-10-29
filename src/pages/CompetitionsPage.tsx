import { useMemo, useState } from "react";
import type { Competition } from "../types";
import CompetitionCard from "../components/CompetitionCard";
import CompetitionDetails from "./CompetitionDetails";

type Props = {
  competitions: Competition[];
  loading: boolean;
  error: string;
  reload: () => void;
  selectedCompetition: Competition | null;
  setSelectedCompetition: (competition: Competition | null) => void;
  onStartCamp: () => void;
};

export default function CompetitionsPage({
  competitions,
  loading,
  error,
  reload,
  selectedCompetition,
  setSelectedCompetition,
  onStartCamp,
}: Props) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All");

  const cities = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(competitions.map((competition) => competition.city)),
      ).sort(),
    ],
    [competitions],
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return competitions
      .filter((competition) => {
        const matchesSearch =
          competition.name.toLowerCase().includes(query) ||
          competition.city.toLowerCase().includes(query) ||
          competition.organizer.toLowerCase().includes(query);

        return matchesSearch && (city === "All" || competition.city === city);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [competitions, search, city]);

  if (selectedCompetition) {
    return (
      <CompetitionDetails
        competition={selectedCompetition}
        onBack={() => setSelectedCompetition(null)}
        onStartCamp={onStartCamp}
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">DISCOVERY</p>
          <h1>Competitions</h1>
          <p className="muted">
            Boxing competitions discovered across Maharashtra.
          </p>
        </div>
        <button className="secondary-button" onClick={reload}>
          Refresh
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search competitions..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          className="filter-select"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        >
          {cities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Loading competitions...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No competitions match your search.</div>
      ) : (
        <div className="competition-list">
          {filtered.map((competition) => (
            <button
              className="competition-card-button"
              key={competition.id}
              onClick={() => setSelectedCompetition(competition)}
            >
              <CompetitionCard competition={competition} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
