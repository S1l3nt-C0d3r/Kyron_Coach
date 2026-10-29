import "./backend-down.css";

type Props = {
  status: "checking" | "offline";
  error: string;
  onRetry: () => void;
};

export default function BackendDownScreen({ status, error, onRetry }: Props) {
  return (
    <main className="backend-down-screen" role="alert" aria-live="assertive">
      <section className="backend-down-card">
        <div className="backend-down-icon" aria-hidden="true">!</div>
        <p className="eyebrow">KYRON COACH · SYSTEM STATUS</p>
        <h1>{status === "checking" ? "Connecting to backend…" : "Backend unavailable"}</h1>
        <p className="backend-down-description">
          {status === "checking"
            ? "Checking the API and SQLite database connection."
            : "Kyron Coach cannot reach the backend. Your app is paused so that unsaved changes are not mistaken for saved data."}
        </p>
        <div className="backend-error-details">
          <strong>Error details</strong>
          <p>{error || "No error details available."}</p>
        </div>
        <button className="primary-button" onClick={onRetry} disabled={status === "checking"}>
          {status === "checking" ? "Checking…" : "Retry connection"}
        </button>
        <p className="backend-down-help">
          Confirm the Express server is running, the configured API URL is correct, and SQLite can be opened. The screen will also retry automatically.
        </p>
      </section>
    </main>
  );
}
