import "dotenv/config";
import { Router, type Request, type Response } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./database";

const router = Router();
const integrationKey = process.env.AKILES_INTEGRATION_KEY || "";

function requireIntegrationKey(req: Request, res: Response, next: () => void) {
	const supplied = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

	if (!integrationKey || supplied.length !== integrationKey.length) {
		return res.status(401).json({ error: "Invalid integration credentials." });
	}

	const valid = timingSafeEqual(
		Buffer.from(supplied),
		Buffer.from(integrationKey),
	);

	if (!valid) {
		return res.status(401).json({ error: "Invalid integration credentials." });
	}

	next();
}

// ------------------------------------------------------
// COACH PROFILE
// ------------------------------------------------------

router.get("/coaches", requireIntegrationKey, (_req, res) => {
	const profile = {
		id: process.env.KYRON_COACH_ID || "kyron-primary-coach",
		name: process.env.KYRON_COACH_NAME || "",
		discipline: process.env.KYRON_COACH_DISCIPLINE || "Boxing",
		location: process.env.KYRON_COACH_LOCATION || "",
		experience: Number(process.env.KYRON_COACH_EXPERIENCE || 0),
		bio: process.env.KYRON_COACH_BIO || "",
		specialties: process.env.KYRON_COACH_SPECIALTIES || "",
		mode: process.env.KYRON_COACH_MODE || "Hybrid",
		verified: process.env.KYRON_COACH_VERIFIED === "true",
		rate: Number(process.env.KYRON_COACH_RATE || 0),
		phone: process.env.KYRON_COACH_PHONE || "",
		email: process.env.KYRON_COACH_EMAIL || "",
		website: process.env.KYRON_COACH_WEBSITE || "",
	};

	res.json({
		coaches: profile.name && profile.verified ? [profile] : [],
	});
});

// ------------------------------------------------------
// ONBOARDING INVITATIONS
// ------------------------------------------------------

router.post("/onboarding-invitations", (req, res) => {
	const { athleteId, athleteName, athleteEmail, message } = req.body || {};

	const coachId = process.env.KYRON_COACH_ID || "kyron-primary-coach";
	const coachName = process.env.KYRON_COACH_NAME || "Kyron Coach";

	if (
		typeof athleteId !== "string" ||
		!athleteId.trim() ||
		typeof athleteName !== "string" ||
		athleteName.trim().length < 2 ||
		typeof athleteEmail !== "string" ||
		!/^\S+@\S+\.\S+$/.test(athleteEmail.trim()) ||
		!coachId.trim() ||
		!coachName.trim()
	) {
		return res.status(400).json({
			error: "A valid athlete ID, name, email and coach profile are required.",
		});
	}

	const athlete = db
		.prepare("SELECT id, name FROM athletes WHERE id = ?")
		.get(athleteId.trim()) as { id: string; name: string } | undefined;

	if (!athlete) {
		return res.status(404).json({ error: "Kyron athlete was not found." });
	}

	const email = athleteEmail.trim().toLowerCase();

	const existing = db
		.prepare(
			`SELECT id FROM akiles_onboarding_invitations
       WHERE lower(athlete_email) = ?
       AND status IN ('pending', 'accepted')`,
		)
		.get(email);

	if (existing) {
		return res.status(409).json({
			error:
				"This athlete already has a pending or active Kyron onboarding invitation.",
		});
	}

	const id = randomUUID();

	db.prepare(
		`INSERT INTO akiles_onboarding_invitations
      (id, athlete_id, athlete_name, athlete_email, coach_id, coach_name, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
	).run(
		id,
		athlete.id,
		athlete.name,
		email,
		coachId,
		coachName.trim(),
		String(message || "").slice(0, 1000),
	);

	res.status(201).json({
		invitation: {
			id,
			athleteId: athlete.id,
			athleteName: athlete.name,
			athleteEmail: email,
			coachId,
			coachName: coachName.trim(),
			status: "pending",
		},
	});
});

router.get("/onboarding-invitations", requireIntegrationKey, (req, res) => {
	const email = String(req.query.email || "")
		.trim()
		.toLowerCase();

	if (!email) {
		return res.status(400).json({ error: "Athlete email is required." });
	}

	const invitations = db
		.prepare(
			`SELECT
        id,
        athlete_id AS athleteId,
        athlete_name AS athleteName,
        athlete_email AS athleteEmail,
        coach_id AS coachId,
        coach_name AS coachName,
        message,
        status,
        created_at AS createdAt,
        responded_at AS respondedAt
       FROM akiles_onboarding_invitations
       WHERE lower(athlete_email) = ?
       ORDER BY created_at DESC`,
		)
		.all(email);

	res.json({ invitations });
});

router.post(
	"/onboarding-invitations/:id/respond",
	requireIntegrationKey,
	(req, res) => {
		const { athleteEmail, decision } = req.body || {};

		if (
			typeof athleteEmail !== "string" ||
			!["accepted", "declined"].includes(decision)
		) {
			return res.status(400).json({
				error: "Athlete email and accepted/declined decision are required.",
			});
		}

		const email = athleteEmail.trim().toLowerCase();

		const invitation = db
			.prepare(
				`SELECT * FROM akiles_onboarding_invitations
         WHERE id = ? AND lower(athlete_email) = ?`,
			)
			.get(req.params.id, email) as any;

		if (!invitation) {
			return res.status(404).json({
				error: "Invitation not found for this athlete.",
			});
		}

		if (invitation.status !== "pending") {
			return res.status(409).json({
				error: "This invitation has already been answered.",
			});
		}

		if (decision === "accepted" && !invitation.athlete_id) {
			return res.status(409).json({
				error:
					"This invitation has no linked Kyron athlete. Ask the coach to send a new invitation.",
			});
		}

		if (decision === "accepted") {
			const active = db
				.prepare(
					`SELECT id FROM akiles_relationships
           WHERE lower(athlete_email) = ? AND status = 'active'`,
				)
				.get(email);

			if (active) {
				return res.status(409).json({
					error:
						"An active coach relationship already exists for this athlete.",
				});
			}
		}

		const relationshipId = decision === "accepted" ? randomUUID() : null;

		const tx = db.transaction(() => {
			db.prepare(
				`UPDATE akiles_onboarding_invitations
         SET status = ?, responded_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
			).run(decision, req.params.id);

			if (decision === "accepted") {
				db.prepare(
					`UPDATE akiles_onboarding_invitations
           SET status = 'superseded'
           WHERE lower(athlete_email) = ?
             AND id <> ?
             AND status = 'pending'`,
				).run(email, req.params.id);

				db.prepare(
					`INSERT INTO akiles_relationships
            (id, invitation_id, athlete_id, athlete_email, athlete_name,
             coach_id, coach_name, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
				).run(
					relationshipId,
					invitation.id,
					invitation.athlete_id,
					invitation.athlete_email,
					invitation.athlete_name,
					invitation.coach_id,
					invitation.coach_name,
				);
			}
		});

		tx();

		res.json({
			success: true,
			decision,
			relationshipId,
			athleteId: invitation.athlete_id || null,
		});
	},
);

// ------------------------------------------------------
// ACTIVE RELATIONSHIP
// ------------------------------------------------------

router.get("/relationship", requireIntegrationKey, (req, res) => {
	const email = String(req.query.email || "")
		.trim()
		.toLowerCase();

	if (!email) {
		return res.status(400).json({ error: "Athlete email is required." });
	}

	const relationship = db
		.prepare(
			`SELECT
        id AS relationshipId,
        athlete_id AS athleteId,
        athlete_email AS athleteEmail,
        athlete_name AS athleteName,
        coach_id AS coachId,
        coach_name AS coachName,
        status,
        created_at AS createdAt
       FROM akiles_relationships
       WHERE lower(athlete_email) = ?
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
		)
		.get(email);

	res.json({ relationship: relationship || null });
});

// ------------------------------------------------------
// AKILES WORKOUTS -> KYRON
// ------------------------------------------------------

router.post("/workout-completions", requireIntegrationKey, (req, res) => {
	const body = req.body || {};
	const workout = body.workout;

	if (
		!body.relationshipId ||
		!body.athleteId ||
		!body.athleteEmail ||
		!workout ||
		!workout.id ||
		!workout.title ||
		!/^\d{4}-\d{2}-\d{2}$/.test(workout.date || "")
	) {
		return res.status(400).json({
			error: "A valid relationship, athlete and workout record are required.",
		});
	}

	const email = String(body.athleteEmail).trim().toLowerCase();

	const relationship = db
		.prepare(
			`SELECT id, athlete_id
       FROM akiles_relationships
       WHERE id = ?
         AND athlete_id = ?
         AND lower(athlete_email) = ?
         AND status = 'active'`,
		)
		.get(body.relationshipId, body.athleteId, email) as
		| { id: string; athlete_id: string }
		| undefined;

	if (!relationship) {
		return res.status(403).json({
			error: "No active Kyron relationship exists for this athlete.",
		});
	}

	const w = workout;

	db.prepare(
		`INSERT OR IGNORE INTO akiles_shared_workouts
      (id, relationship_id, athlete_id, athlete_email, title, category,
       log_date, duration, sets, reps, rounds, rpe, notes, source_workout_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		randomUUID(),
		relationship.id,
		relationship.athlete_id,
		email,
		String(w.title).slice(0, 120),
		String(w.category || "Training").slice(0, 60),
		w.date,
		Number(w.duration || 0),
		w.sets ?? null,
		w.reps ?? null,
		w.rounds ?? null,
		Number(w.rpe || 5),
		String(w.notes || "").slice(0, 2000),
		String(w.id),
	);

	res.status(201).json({ success: true });
});

// Coach-facing workout history for a specific Kyron athlete.
router.get(
	"/athletes/:athleteId/workouts",
	requireIntegrationKey,
	(req, res) => {
		const workouts = db
			.prepare(
				`SELECT
          id,
          title,
          category,
          log_date AS date,
          duration,
          sets,
          reps,
          rounds,
          rpe,
          notes,
          source_workout_id AS sourceWorkoutId
         FROM akiles_shared_workouts
         WHERE athlete_id = ?
         ORDER BY log_date DESC`,
			)
			.all(req.params.athleteId);

		res.json({ workouts });
	},
);

// ------------------------------------------------------
// KYRON SCHEDULE -> AKILES
// ------------------------------------------------------

router.get("/assigned-workouts", requireIntegrationKey, (req, res) => {
	const email = String(req.query.email || "")
		.trim()
		.toLowerCase();

	if (!email) {
		return res.status(400).json({ error: "Athlete email is required." });
	}

	const relationship = db
		.prepare(
			`SELECT athlete_id
       FROM akiles_relationships
       WHERE lower(athlete_email) = ?
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
		)
		.get(email) as { athlete_id: string | null } | undefined;

	if (!relationship?.athlete_id) {
		return res.json({ workouts: [] });
	}

	const rows = db
		.prepare(
			`SELECT s.data_json
       FROM training_sessions s
       INNER JOIN session_athletes sa ON sa.session_id = s.id
       WHERE sa.athlete_id = ?
       ORDER BY s.session_date, s.session_time`,
		)
		.all(relationship.athlete_id) as { data_json: string }[];

	const workouts = rows
		.map((row) => {
			try {
				return JSON.parse(row.data_json);
			} catch {
				return null;
			}
		})
		.filter(Boolean);

	res.json({ workouts });
});

// ------------------------------------------------------
// COACH NOTES -> AKILES
// ------------------------------------------------------
router.get("/coach-notes", requireIntegrationKey, (req, res) => {
	const email = String(req.query.email || "")
		.trim()
		.toLowerCase();
	if (!email)
		return res.status(400).json({ error: "Athlete email is required." });

	const relationship = db
		.prepare(
			`SELECT athlete_id AS athleteId, coach_name AS coachName
     FROM akiles_relationships
     WHERE lower(athlete_email) = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
		)
		.get(email) as { athleteId: string | null; coachName: string } | undefined;

	if (!relationship?.athleteId) return res.json({ notes: [] });
	const notes = db
		.prepare(
			`SELECT id, athleteId, message, createdAt
     FROM coach_notes WHERE athleteId = ?
     ORDER BY createdAt DESC, rowid DESC`,
		)
		.all(relationship.athleteId);
	res.json({ notes, coachName: relationship.coachName });
});

// ------------------------------------------------------
// KYRON COACH COMPLETION
// Kyron remains the source of truth. Akiles pulls completed sessions
// through GET /assigned-workouts using KYRON_API_URL + the shared key.
// ------------------------------------------------------
router.post("/training-sessions/:sessionId/complete", (req, res) => {
	const sessionId = String(req.params.sessionId || "");
	const session = db
		.prepare(
			`SELECT id, data_json AS dataJson FROM training_sessions WHERE id = ?`,
		)
		.get(sessionId) as { id: string; dataJson: string } | undefined;
	if (!session)
		return res.status(404).json({ error: "Training session not found." });

	let workout: any;
	try {
		workout = JSON.parse(session.dataJson);
	} catch {
		return res
			.status(500)
			.json({ error: "Stored training session is invalid." });
	}

	const alreadyCompleted = Boolean(workout.completed);
	const completedAt =
		typeof workout.completedAt === "string"
			? workout.completedAt
			: new Date().toISOString();
	workout.completed = true;
	workout.completedAt = completedAt;

	db.prepare(
		`UPDATE training_sessions SET completed = 1, data_json = ? WHERE id = ?`,
	).run(JSON.stringify(workout), sessionId);

	res.json({
		success: true,
		alreadyCompleted,
		completedAt,
		synced: "available-via-kyron-api",
	});
});

export default router;
