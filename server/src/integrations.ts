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
	if (!valid)
		return res.status(401).json({ error: "Invalid integration credentials." });
	next();
}

// Coach profile data is configured by the Kyron operator; never seed fake profiles.
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
	res.json({ coaches: profile.name && profile.verified ? [profile] : [] });
});

router.post("/onboarding-invitations", (req, res) => {
	const { athleteName, athleteEmail, message } = req.body || {};
	const coachId = process.env.KYRON_COACH_ID || "kyron-primary-coach";
	const coachName = process.env.KYRON_COACH_NAME || "Kyron Coach";
	if (
		typeof athleteName !== "string" ||
		athleteName.trim().length < 2 ||
		typeof athleteEmail !== "string" ||
		!/^\S+@\S+\.\S+$/.test(athleteEmail) ||
		typeof coachId !== "string" ||
		!coachId.trim() ||
		typeof coachName !== "string" ||
		!coachName.trim()
	) {
		return res
			.status(400)
			.json({
				error:
					"Athlete name, valid athlete email, coach ID and coach name are required.",
			});
	}
	const existing = db
		.prepare(
			`SELECT id FROM akiles_onboarding_invitations WHERE lower(athlete_email)=lower(?) AND status IN ('pending','accepted')`,
		)
		.get(athleteEmail.trim()) as { id: string } | undefined;
	if (existing)
		return res
			.status(409)
			.json({
				error:
					"This athlete already has a pending or active Kyron onboarding invitation.",
			});
	const id = randomUUID();
	db.prepare(
		`INSERT INTO akiles_onboarding_invitations(id,athlete_name,athlete_email,coach_id,coach_name,message,status) VALUES(?,?,?,?,?,?,'pending')`,
	).run(
		id,
		athleteName.trim(),
		athleteEmail.trim().toLowerCase(),
		coachId,
		coachName.trim(),
		String(message || "").slice(0, 1000),
	);
	res
		.status(201)
		.json({
			invitation: {
				id,
				athleteName: athleteName.trim(),
				athleteEmail: athleteEmail.trim().toLowerCase(),
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
	if (!email)
		return res.status(400).json({ error: "Athlete email is required." });
	const invitations = db
		.prepare(
			`SELECT id,athlete_name AS athleteName,athlete_email AS athleteEmail,coach_id AS coachId,coach_name AS coachName,message,status,created_at AS createdAt,responded_at AS respondedAt FROM akiles_onboarding_invitations WHERE lower(athlete_email)=? ORDER BY created_at DESC`,
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
			return res
				.status(400)
				.json({
					error: "Athlete email and accepted/declined decision are required.",
				});
		}
		const invitation = db
			.prepare(
				`SELECT * FROM akiles_onboarding_invitations WHERE id=? AND lower(athlete_email)=lower(?)`,
			)
			.get(req.params.id, athleteEmail) as any;
		if (!invitation)
			return res
				.status(404)
				.json({ error: "Invitation not found for this athlete." });
		if (invitation.status !== "pending")
			return res
				.status(409)
				.json({ error: "This invitation has already been answered." });
		if (decision === "accepted") {
			const active = db
				.prepare(
					`SELECT id FROM akiles_relationships WHERE lower(athlete_email)=lower(?) AND status='active'`,
				)
				.get(athleteEmail);
			if (active)
				return res
					.status(409)
					.json({
						error:
							"An active coach relationship already exists for this athlete.",
					});
		}
		const relationshipId = decision === "accepted" ? randomUUID() : null;
		const tx = db.transaction(() => {
			db.prepare(
				`UPDATE akiles_onboarding_invitations SET status=?,responded_at=CURRENT_TIMESTAMP WHERE id=?`,
			).run(decision, req.params.id);
			if (decision === "accepted") {
				db.prepare(
					`UPDATE akiles_onboarding_invitations SET status='superseded' WHERE lower(athlete_email)=lower(?) AND id<>? AND status='pending'`,
				).run(athleteEmail, req.params.id);
				db.prepare(
					`INSERT INTO akiles_relationships(id,invitation_id,athlete_email,athlete_name,coach_id,coach_name,status) VALUES(?,?,?,?,?,?,'active')`,
				).run(
					relationshipId,
					invitation.id,
					invitation.athlete_email,
					invitation.athlete_name,
					invitation.coach_id,
					invitation.coach_name,
				);
			}
		});
		tx();
		res.json({ success: true, decision, relationshipId });
	},
);

router.get("/relationship", requireIntegrationKey, (req, res) => {
	const email = String(req.query.email || "")
		.trim()
		.toLowerCase();
	if (!email)
		return res.status(400).json({ error: "Athlete email is required." });
	const relationship = db
		.prepare(
			`SELECT id AS relationshipId,athlete_email AS athleteEmail,athlete_name AS athleteName,coach_id AS coachId,coach_name AS coachName,status,created_at AS createdAt FROM akiles_relationships WHERE lower(athlete_email)=? AND status='active' ORDER BY created_at DESC LIMIT 1`,
		)
		.get(email);
	res.json({ relationship: relationship || null });
});

router.post("/workout-completions", requireIntegrationKey, (req, res) => {
	const b = req.body || {};
	if (
		!b.relationshipId ||
		!b.athleteEmail ||
		!b.workout ||
		!b.workout.id ||
		!b.workout.title ||
		!/^\d{4}-\d{2}-\d{2}$/.test(b.workout.date || "")
	) {
		return res
			.status(400)
			.json({
				error: "A valid active relationship and workout record are required.",
			});
	}
	const relation = db
		.prepare(
			`SELECT id FROM akiles_relationships WHERE id=? AND lower(athlete_email)=lower(?) AND status='active'`,
		)
		.get(b.relationshipId, b.athleteEmail);
	if (!relation)
		return res
			.status(403)
			.json({ error: "No active Kyron relationship exists for this athlete." });
	const w = b.workout;
	db.prepare(
		`INSERT OR IGNORE INTO akiles_shared_workouts(id,relationship_id,athlete_email,title,category,log_date,duration,sets,reps,rounds,rpe,notes,source_workout_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
	).run(
		randomUUID(),
		b.relationshipId,
		String(b.athleteEmail).toLowerCase(),
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

router.get("/athletes/:email/workouts", requireIntegrationKey, (req, res) => {
	const email = decodeURIComponent(req.params.email).toLowerCase();
	const relationship = db
		.prepare(
			`SELECT id FROM akiles_relationships WHERE lower(athlete_email)=? AND status='active' ORDER BY created_at DESC LIMIT 1`,
		)
		.get(email) as { id: string } | undefined;
	if (!relationship)
		return res.status(403).json({ error: "No active relationship." });
	const workouts = db
		.prepare(
			`SELECT title,category,log_date AS date,duration,sets,reps,rounds,rpe,notes FROM akiles_shared_workouts WHERE relationship_id=? ORDER BY log_date DESC`,
		)
		.all(relationship.id);
	res.json({ workouts });
});

export default router;
