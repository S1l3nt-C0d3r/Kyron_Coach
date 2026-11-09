import { useEffect, useState } from "react";
import type { Athlete, TrainingSession, WorkoutLog } from "../types";
import { formatDate } from "../utils/date";
import AthletePerformanceCard from "../components/AthletePerformanceCard";
import SessionCard from "../components/SessionCard";

type AthleteVideo = {
	id: string;
	title: string;
	url: string;
	createdAt: string;
};

type CoachNote = {
	id: string;
	athleteId: string;
	message: string;
	createdAt: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Props = {
	athletes: Athlete[];
	loadingAthletes: boolean;
	athleteError: string;
	onRetryLoadAthletes: () => void;
	onAddAthlete: (athlete: Omit<Athlete, "id">) => Promise<Athlete>;
	onDeleteAthlete: (id: string) => Promise<void>;
	onUpdateAthlete?: (
		id: string,
		stats: { power: number; speed: number; endurance: number },
	) => Promise<Athlete>;
	workoutLogs: WorkoutLog[];
	setWorkoutLogs: React.Dispatch<React.SetStateAction<WorkoutLog[]>>;
	sessions: TrainingSession[];
	selectedAthleteId: string | null;
	onSelectAthlete: (id: string) => void;
	onBackToRoster: () => void;
};

export default function AthletesPage({
	athletes,
	loadingAthletes,
	athleteError,
	onRetryLoadAthletes,
	onAddAthlete,
	onDeleteAthlete,
	onUpdateAthlete,
	workoutLogs,
	setWorkoutLogs,
	sessions,
	selectedAthleteId,
	onSelectAthlete,
	onBackToRoster,
}: Props) {
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [age, setAge] = useState("");
	const [weightClass, setWeightClass] = useState("60 kg");
	const [category, setCategory] = useState("Elite");
	const [power, setPower] = useState("5");
	const [speed, setSpeed] = useState("5");
	const [endurance, setEndurance] = useState("5");
	const [formError, setFormError] = useState("");
	const [saving, setSaving] = useState(false);
	const [editingStats, setEditingStats] = useState(false);
	const [statDraft, setStatDraft] = useState({
		power: "5",
		speed: "5",
		endurance: "5",
	});
	const [videos, setVideos] = useState<AthleteVideo[]>([]);
	const [videoTitle, setVideoTitle] = useState("");
	const [videoUrl, setVideoUrl] = useState("");
	const [videoError, setVideoError] = useState("");
	const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
	const [noteDraft, setNoteDraft] = useState("");
	const [notesLoading, setNotesLoading] = useState(false);
	const [noteSaving, setNoteSaving] = useState(false);
	const [notesError, setNotesError] = useState("");

	const validScore = (score: string) =>
		score.trim() !== "" &&
		Number.isFinite(Number(score)) &&
		Number(score) >= 0 &&
		Number(score) <= 10;

	const selectedAthlete = athletes.find(
		(athlete) => athlete.id === selectedAthleteId,
	);

	// Videos remain demo-only in this browser. Coach notes are stored in SQLite
	// through the Kyron API so the history is shared across devices and sessions.
	useEffect(() => {
		if (!selectedAthleteId) {
			setVideos([]);
			setCoachNotes([]);
			return;
		}

		try {
			const savedVideos = localStorage.getItem(
				`kyron-videos-${selectedAthleteId}`,
			);
			setVideos(savedVideos ? (JSON.parse(savedVideos) as AthleteVideo[]) : []);
		} catch (error) {
			console.error("Could not load demo video links:", error);
			setVideos([]);
		}

		setVideoTitle("");
		setVideoUrl("");
		setVideoError("");
		setNoteDraft("");
		setNotesError("");

		const loadCoachNotes = async () => {
			setNotesLoading(true);
			try {
				const response = await fetch(
					`${API_URL}/api/athletes/${encodeURIComponent(selectedAthleteId)}/notes`,
				);
				const payload = await response.json().catch(() => null);
				if (!response.ok) {
					throw new Error(payload?.error || "Could not load coach notes.");
				}
				setCoachNotes(Array.isArray(payload) ? payload : []);
			} catch (error) {
				console.error("Could not load coach notes:", error);
				setNotesError(
					error instanceof Error
						? error.message
						: "Could not load coach notes.",
				);
				setCoachNotes([]);
			} finally {
				setNotesLoading(false);
			}
		};

		void loadCoachNotes();
	}, [selectedAthleteId]);

	const addAthleteVideo = () => {
		if (!selectedAthleteId || !videoTitle.trim() || !videoUrl.trim()) {
			setVideoError("Enter a video title and URL.");
			return;
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(videoUrl.trim());
			if (!["http:", "https:"].includes(parsedUrl.protocol))
				throw new Error("Invalid URL");
		} catch {
			setVideoError(
				"Please enter a valid video URL starting with http:// or https://.",
			);
			return;
		}

		const updated = [
			{
				id: crypto.randomUUID(),
				title: videoTitle.trim(),
				url: parsedUrl.toString(),
				createdAt: new Date().toISOString(),
			},
			...videos,
		];

		try {
			localStorage.setItem(
				`kyron-videos-${selectedAthleteId}`,
				JSON.stringify(updated),
			);
			setVideos(updated);
			setVideoTitle("");
			setVideoUrl("");
			setVideoError("");
		} catch (error) {
			console.error("Could not save video link:", error);
			setVideoError("Could not save this video link in browser storage.");
		}
	};

	const removeAthleteVideo = (id: string) => {
		if (!selectedAthleteId) return;
		const updated = videos.filter((video) => video.id !== id);
		localStorage.setItem(
			`kyron-videos-${selectedAthleteId}`,
			JSON.stringify(updated),
		);
		setVideos(updated);
	};

	const sendCoachNote = async () => {
		if (!selectedAthleteId || !noteDraft.trim() || noteSaving) return;

		setNoteSaving(true);
		setNotesError("");
		try {
			const response = await fetch(
				`${API_URL}/api/athletes/${encodeURIComponent(selectedAthleteId)}/notes`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ message: noteDraft.trim() }),
				},
			);
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.error || "Could not save coach note.");
			}

			// Append the server-created record; earlier notes remain in the history.
			setCoachNotes((current) => [payload as CoachNote, ...current]);
			setNoteDraft("");
		} catch (error) {
			console.error("Could not save coach note:", error);
			setNotesError(
				error instanceof Error ? error.message : "Could not save coach note.",
			);
		} finally {
			setNoteSaving(false);
		}
	};

	const addAthlete = async () => {
		if (
			!name.trim() ||
			!age ||
			Number(age) <= 0 ||
			![power, speed, endurance].every(validScore)
		) {
			setFormError(
				"Enter a name, a valid age, and all three scores between 0 and 10.",
			);
			return;
		}

		setSaving(true);
		setFormError("");

		try {
			await onAddAthlete({
				name: name.trim(),
				age: Number(age),
				weightClass,
				category,
				status: "Active",
				power: Number(power),
				speed: Number(speed),
				endurance: Number(endurance),
			});

			setName("");
			setAge("");
			setPower("5");
			setSpeed("5");
			setEndurance("5");
			setShowForm(false);
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "Could not save athlete.",
			);
		} finally {
			setSaving(false);
		}
	};

	const removeAthlete = async (id: string) => {
		const athlete = athletes.find((item) => item.id === id);

		if (athlete && !window.confirm(`Remove ${athlete.name}?`)) return;

		try {
			await onDeleteAthlete(id);
			setWorkoutLogs((current) =>
				current.filter((log) => log.athleteId !== id),
			);

			if (selectedAthleteId === id) onBackToRoster();
		} catch (error) {
			window.alert(
				error instanceof Error ? error.message : "Could not remove athlete.",
			);
		}
	};

	const saveStats = async (id: string) => {
		if (
			![statDraft.power, statDraft.speed, statDraft.endurance].every(validScore)
		) {
			setFormError("Scores must be between 0 and 10.");
			return;
		}

		if (!onUpdateAthlete) {
			setFormError("The backend athlete update endpoint is not configured.");
			return;
		}

		setSaving(true);
		setFormError("");

		try {
			await onUpdateAthlete(id, {
				power: Number(statDraft.power),
				speed: Number(statDraft.speed),
				endurance: Number(statDraft.endurance),
			});
			setEditingStats(false);
		} catch (error) {
			setFormError(
				error instanceof Error ? error.message : "Could not update scores.",
			);
		} finally {
			setSaving(false);
		}
	};

	const renderWorkoutLog = (log: WorkoutLog) => (
		<div className="workout-log-row" key={log.id}>
			<strong>{log.title}</strong>
			<span>
				{formatDate(log.date)} · {log.category}
			</span>

			<div className="workout-log-details">
				{log.mode !== "time" && (
					<span>
						{log.sets} sets × {log.reps} reps
					</span>
				)}
				{log.mode !== "sets-reps" && (
					<span>
						{log.duration} min
						{log.rounds !== undefined ? ` · ${log.rounds} rounds` : ""}
					</span>
				)}
				<span>Effort: {log.rpe}/10</span>
			</div>

			{log.notes && <small>{log.notes}</small>}
		</div>
	);

	if (selectedAthlete) {
		// Scores are stored in SQLite on a 0–10 scale; never replace them
		// with hardcoded fallback values or rescale them in the profile view.
		const performance = {
			power: selectedAthlete.power ?? 0,
			speed: selectedAthlete.speed ?? 0,
			endurance: selectedAthlete.endurance ?? 0,
		};

		const athleteLogs = workoutLogs
			.filter((log) => log.athleteId === selectedAthlete.id)
			.sort((a, b) => b.date.localeCompare(a.date));

		const athleteSessions = sessions
			.filter((session) => session.athleteIds.includes(selectedAthlete.id))
			.sort(
				(a, b) =>
					new Date(`${a.date}T${a.time}`).getTime() -
					new Date(`${b.date}T${b.time}`).getTime(),
			);

		return (
			<>
				<button className="back-button" onClick={onBackToRoster}>
					← Back to athletes
				</button>

				<header className="page-header">
					<div>
						<p className="eyebrow">ATHLETE PROFILE</p>
						<h1>{selectedAthlete.name}</h1>
						<p className="muted">
							{selectedAthlete.category} · {selectedAthlete.weightClass} · Age{" "}
							{selectedAthlete.age}
						</p>
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							flexWrap: "wrap",
						}}
					>
						<span className="status upcoming">{selectedAthlete.status}</span>
						<button
							className="secondary-button"
							onClick={async () => {
								const athleteEmail = window.prompt(
									`Enter ${selectedAthlete.name}'s Akiles account email:`,
								);
								if (!athleteEmail) return;
								const message =
									window.prompt("Optional onboarding note for the athlete:") ||
									"Your coach has invited you to connect with Kyron Coach.";
								try {
									const apiUrl =
										import.meta.env.VITE_API_URL || "http://localhost:4000";
									const response = await fetch(
										`${apiUrl}/api/integrations/onboarding-invitations`,
										{
											method: "POST",
											headers: {
												"Content-Type": "application/json",
											},
											body: JSON.stringify({
												athleteId: selectedAthlete.id,
												athleteName: selectedAthlete.name,
												athleteEmail,
												message,
											}),
										},
									);

									const data = await response.json();

									if (!response.ok) {
										throw new Error(data.error || "Could not send invitation.");
									}

									// Keep your existing success handling here.
									alert(`Invitation sent to ${athleteEmail}.`);
								} catch (error) {
									console.error("Failed to send Akiles invitation:", error);

									alert(
										error instanceof Error
											? error.message
											: "Something went wrong while sending the invitation.",
									);
								}
							}}
						>
							Invite to Akiles
						</button>
					</div>
				</header>

				<section className="section">
					<div className="section-header">
						<div>
							<h2>Performance tracking</h2>
							<p className="muted">
								Current power, speed, and endurance scores.
							</p>
						</div>
					</div>
					<div>
						<button
							className="secondary-button"
							onClick={() => {
								setEditingStats(!editingStats);
								setStatDraft({
									power: String(selectedAthlete.power ?? 5),
									speed: String(selectedAthlete.speed ?? 5),
									endurance: String(selectedAthlete.endurance ?? 5),
								});
								setFormError("");
							}}
						>
							{editingStats ? "Cancel editing" : "Edit scores"}
						</button>
					</div>
					{editingStats && (
						<div className="form-card">
							<div className="form-grid">
								{(["power", "speed", "endurance"] as const).map((key) => (
									<label className="tracker-field" key={key}>
										{key[0].toUpperCase() + key.slice(1)} (0–10)
										<input
											className="form-input"
											type="number"
											min="0"
											max="10"
											step="0.1"
											value={statDraft[key]}
											onChange={(event) =>
												setStatDraft((current) => ({
													...current,
													[key]: event.target.value,
												}))
											}
										/>
									</label>
								))}
							</div>

							{formError && <p role="alert">{formError}</p>}

							<button
								className="primary-button"
								disabled={saving}
								onClick={() => saveStats(selectedAthlete.id)}
							>
								{saving ? "Saving…" : "Save scores"}
							</button>
						</div>
					)}

					<AthletePerformanceCard
						athlete={selectedAthlete}
						performance={performance}
						onClick={() => {}}
					/>
				</section>

				<section className="section athlete-workout-section">
					<div className="section-header">
						<div>
							<h2>Workout history</h2>
							<p className="muted">
								Completed workouts recorded in the Training section.
							</p>
						</div>
						<span className="muted">
							{athleteLogs.length}{" "}
							{athleteLogs.length === 1 ? "workout" : "workouts"}
						</span>
					</div>

					{athleteLogs.length === 0 ? (
						<div className="empty-state">
							No workouts recorded yet. Completed workouts logged in Training
							will appear here.
						</div>
					) : (
						<div className="workout-log-list">
							{athleteLogs.map(renderWorkoutLog)}
						</div>
					)}
				</section>

				<section className="section">
					<div className="section-header">
						<div>
							<h2>Video library</h2>
							<p className="muted">
								Add training clips and reference videos for this athlete.
							</p>
						</div>
						<span className="muted">
							{videos.length} {videos.length === 1 ? "video" : "videos"}
						</span>
					</div>

					<div className="form-card">
						<div className="form-grid">
							<label className="tracker-field">
								Video title
								<input
									className="form-input"
									placeholder="e.g. Footwork review"
									value={videoTitle}
									onChange={(event) => setVideoTitle(event.target.value)}
								/>
							</label>
							<label className="tracker-field">
								Video URL
								<input
									className="form-input"
									type="url"
									placeholder="https://..."
									value={videoUrl}
									onChange={(event) => setVideoUrl(event.target.value)}
								/>
							</label>
						</div>
						{videoError && <p role="alert">{videoError}</p>}
						<div className="form-actions">
							<button className="primary-button" onClick={addAthleteVideo}>
								Add video
							</button>
						</div>
					</div>

					{videos.length === 0 ? (
						<div className="empty-state">
							No videos added yet. Add a link to a training clip or review.
						</div>
					) : (
						<div className="workout-log-list">
							{videos.map((video) => (
								<div className="workout-log-row" key={video.id}>
									<strong>{video.title}</strong>
									<small>{new Date(video.createdAt).toLocaleString()}</small>
									<div className="form-actions">
										<a
											className="secondary-button"
											href={video.url}
											target="_blank"
											rel="noreferrer"
										>
											Open video ↗
										</a>
										<button
											className="danger-button"
											onClick={() => removeAthleteVideo(video.id)}
										>
											Remove
										</button>
									</div>
								</div>
							))}
						</div>
					)}
					<p className="muted">
						Demo mode: only video links are saved in this browser. Video files
						are not uploaded.
					</p>
				</section>

				<section className="section">
					<div className="section-header">
						<div>
							<h2>Coach's notes</h2>
							<p className="muted">
								Write feedback and reminders for this athlete.
							</p>
						</div>
						<span className="muted">
							{coachNotes.length} {coachNotes.length === 1 ? "note" : "notes"}
						</span>
					</div>

					<div className="form-card">
						<label className="tracker-field">
							New note
							<textarea
								className="form-input"
								rows={4}
								placeholder="Share feedback, corrections, or training reminders..."
								value={noteDraft}
								onChange={(event) => setNoteDraft(event.target.value)}
							/>
						</label>
						<div className="form-actions">
							<button
								className="primary-button"
								disabled={!noteDraft.trim() || noteSaving}
								onClick={() => void sendCoachNote()}
							>
								{noteSaving ? "Saving…" : "Save note"}
							</button>
						</div>
					</div>

					{notesError && <p role="alert">{notesError}</p>}
					{notesLoading ? (
						<div className="empty-state">Loading note history…</div>
					) : coachNotes.length === 0 ? (
						<div className="empty-state">
							No coach notes yet. Your feedback will appear here.
						</div>
					) : (
						<div className="workout-log-list">
							{coachNotes.map((note) => (
								<article className="workout-log-row" key={note.id}>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											gap: 12,
											flexWrap: "wrap",
										}}
									>
										<strong>Coach's feedback</strong>
										<small>
											{new Date(note.createdAt).toLocaleString(undefined, {
												dateStyle: "medium",
												timeStyle: "short",
											})}
										</small>
									</div>
									<p style={{ whiteSpace: "pre-wrap" }}>{note.message}</p>
								</article>
							))}
						</div>
					)}
					<p className="muted">
						Notes are saved to the Kyron database and remain in this athlete's
						dated history. They are currently visible in Kyron only; Akiles
						delivery and notifications are not connected yet.
					</p>
				</section>

				<section className="section">
					<div className="section-header">
						<div>
							<h2>Scheduled sessions</h2>
							<p className="muted">
								Training sessions assigned to this athlete.
							</p>
						</div>
					</div>

					{athleteSessions.length === 0 ? (
						<div className="empty-state">
							No training sessions assigned yet.
						</div>
					) : (
						<div className="session-list">
							{athleteSessions.map((session) => (
								<SessionCard
									key={session.id}
									session={session}
									athletes={athletes}
								/>
							))}
						</div>
					)}
				</section>

				<button
					className="danger-button"
					onClick={() => removeAthlete(selectedAthlete.id)}
				>
					Remove Athlete
				</button>
			</>
		);
	}

	return (
		<>
			<header className="page-header">
				<div>
					<p className="eyebrow">ROSTER</p>
					<h1>Athletes</h1>
					<p className="muted">
						Track athlete performance, training history, and progress.
					</p>
				</div>

				<button
					className="primary-button"
					onClick={() => setShowForm((current) => !current)}
				>
					{showForm ? "Cancel" : "+ Add Athlete"}
				</button>
			</header>

			{showForm && (
				<div className="form-card">
					<h2>Add athlete</h2>

					<div className="form-grid">
						<input
							className="form-input"
							placeholder="Athlete name"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>

						<input
							className="form-input"
							type="number"
							min="1"
							placeholder="Age"
							value={age}
							onChange={(event) => setAge(event.target.value)}
						/>

						<select
							className="form-input"
							value={weightClass}
							onChange={(event) => setWeightClass(event.target.value)}
						>
							{[
								"48 kg",
								"51 kg",
								"54 kg",
								"57 kg",
								"60 kg",
								"63.5 kg",
								"67 kg",
								"71 kg",
								"75 kg",
								"80 kg",
								"86 kg",
								"92 kg",
								"92+ kg",
							].map((weight) => (
								<option key={weight} value={weight}>
									{weight}
								</option>
							))}
						</select>

						<select
							className="form-input"
							value={category}
							onChange={(event) => setCategory(event.target.value)}
						>
							{["Youth", "Elite", "Junior", "Sub-Junior"].map((item) => (
								<option key={item} value={item}>
									{item}
								</option>
							))}
						</select>
					</div>

					<div className="form-grid" style={{ marginTop: 16 }}>
						{(
							[
								["Power", power, setPower],
								["Speed", speed, setSpeed],
								["Endurance", endurance, setEndurance],
							] as const
						).map(([label, value, setter]) => (
							<label className="tracker-field" key={label}>
								{label} (0–10)
								<input
									className="form-input"
									type="number"
									min="0"
									max="10"
									step="0.1"
									value={value}
									onChange={(event) => setter(event.target.value)}
									required
								/>
							</label>
						))}
					</div>

					{formError && <p role="alert">{formError}</p>}

					<div className="form-actions">
						<button
							className="secondary-button"
							onClick={() => setShowForm(false)}
						>
							Cancel
						</button>
						<button
							className="primary-button"
							onClick={addAthlete}
							disabled={
								saving ||
								!name.trim() ||
								!age ||
								Number(age) <= 0 ||
								![power, speed, endurance].every(validScore)
							}
						>
							{saving ? "Saving…" : "Add Athlete"}
						</button>
					</div>
				</div>
			)}

			{athleteError && (
				<div className="empty-state" role="alert">
					{athleteError}{" "}
					<button className="secondary-button" onClick={onRetryLoadAthletes}>
						Retry
					</button>
				</div>
			)}

			{loadingAthletes ? (
				<div className="empty-state">Loading athletes…</div>
			) : athletes.length === 0 ? (
				<div className="empty-state">
					No athletes yet. Add an athlete to begin tracking performance.
				</div>
			) : (
				<div className="athlete-grid">
					{athletes.map((athlete) => {
						const logs = workoutLogs.filter(
							(log) => log.athleteId === athlete.id,
						);
						const totalMinutes = logs.reduce(
							(total, log) => total + (log.duration || 0),
							0,
						);

						return (
							<article
								className="athlete-card athlete-roster-card"
								key={athlete.id}
							>
								<button
									type="button"
									className="athlete-roster-open"
									onClick={() => onSelectAthlete(athlete.id)}
									aria-label={`Open ${athlete.name}'s profile`}
								>
									<div className="athlete-top">
										<div className="athlete-avatar">
											{athlete.name
												.split(" ")
												.map((part) => part[0])
												.join("")
												.slice(0, 2)
												.toUpperCase()}
										</div>
										<span className="status upcoming">{athlete.status}</span>
									</div>

									<h3>{athlete.name}</h3>
									<p className="athlete-category">{athlete.category}</p>

									<div className="athlete-details">
										<div>
											<span>Age</span>
											<strong>{athlete.age}</strong>
										</div>
										<div>
											<span>Weight</span>
											<strong>{athlete.weightClass}</strong>
										</div>
									</div>

									<div className="athlete-details tracker-stats">
										<div>
											<span>Workouts</span>
											<strong>{logs.length}</strong>
										</div>
										<div>
											<span>Training minutes</span>
											<strong>{totalMinutes}</strong>
										</div>
									</div>

									<span className="athlete-card-link">
										View tracking profile →
									</span>
								</button>

								<div className="athlete-card-actions">
									<button
										type="button"
										className="danger-button"
										onClick={() => removeAthlete(athlete.id)}
									>
										Remove
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
