import type { Athlete, AthletePerformance } from "../types";

type Props = {
  athlete: Athlete;
  performance: AthletePerformance;
  onClick: () => void;
};

export default function AthletePerformanceCard({
  athlete,
  performance,
  onClick,
}: Props) {
  const metrics = [
    { label: "Power", value: performance.power, color: "#f04424" },
    { label: "Speed", value: performance.speed, color: "#36a9f5" },
    { label: "Endurance", value: performance.endurance, color: "#65d45e" },
  ];

  return (
    <button
      type="button"
      className="athlete-performance-card"
      onClick={onClick}
      aria-label={`Open ${athlete.name}'s profile`}
    >
      <div className="athlete-performance-heading">
        <div className="athlete-performance-avatar">
          {athlete.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>

        <div className="athlete-performance-identity">
          <h3>{athlete.name}</h3>
          <span>
            {athlete.category} · {athlete.weightClass}
          </span>
        </div>
      </div>

      <div className="athlete-performance-metrics">
        {metrics.map((metric) => (
          <div className="athlete-performance-row" key={metric.label}>
            <span className="athlete-performance-label">{metric.label}:</span>

            <div
              className="athlete-performance-track"
              role="progressbar"
              aria-label={`${metric.label} score`}
              aria-valuenow={metric.value}
              aria-valuemin={0}
              aria-valuemax={10}
            >
              <div
                className="athlete-performance-fill"
                style={{
                  width: `${Math.max(0, Math.min(10, metric.value)) * 10}%`,
                  backgroundColor: metric.color,
                }}
              />
            </div>

            <span className="athlete-performance-value">{Number(metric.value).toFixed(1)}/10</span>
          </div>
        ))}
      </div>
    </button>
  );
}
