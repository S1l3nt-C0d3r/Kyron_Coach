import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, type Athlete } from "./database";

const router = Router();

const validStatuses = ["Active", "Inactive"] as const;

type AthleteStatus = (typeof validStatuses)[number];

type AthleteInput = {
  name: string;
  age: number;
  weightClass: string;
  category: string;
  status?: AthleteStatus;
  power?: number;
  speed?: number;
  endurance?: number;
};

type AthleteUpdate = Partial<AthleteInput>;

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10
  );
}

function isValidAthleteInput(body: unknown): body is AthleteInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const value = body as Record<string, unknown>;

  return (
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.trim().length <= 120 &&
    typeof value.age === "number" &&
    Number.isInteger(value.age) &&
    value.age > 0 &&
    value.age <= 120 &&
    typeof value.weightClass === "string" &&
    value.weightClass.trim().length > 0 &&
    value.weightClass.trim().length <= 40 &&
    typeof value.category === "string" &&
    value.category.trim().length > 0 &&
    value.category.trim().length <= 60 &&
    (value.status === undefined ||
      (typeof value.status === "string" &&
        validStatuses.includes(value.status as AthleteStatus))) &&
    (value.power === undefined || isValidScore(value.power)) &&
    (value.speed === undefined || isValidScore(value.speed)) &&
    (value.endurance === undefined || isValidScore(value.endurance))
  );
}

function cleanAthlete(body: AthleteInput) {
  return {
    name: body.name.trim(),
    age: body.age,
    weightClass: body.weightClass.trim(),
    category: body.category.trim(),
    status: body.status ?? ("Active" as const),
    power: body.power ?? 5,
    speed: body.speed ?? 5,
    endurance: body.endurance ?? 5,
  };
}

function getAthlete(id: string): Athlete | undefined {
  return db
    .prepare(
      `
      SELECT
        id,
        name,
        age,
        weightClass,
        category,
        status,
        power,
        speed,
        endurance,
        createdAt,
        updatedAt
      FROM athletes
      WHERE id = ?
    `,
    )
    .get(id) as Athlete | undefined;
}

function isValidPartialUpdate(body: unknown): body is AthleteUpdate {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const value = body as Record<string, unknown>;

  const allowedFields = [
    "name",
    "age",
    "weightClass",
    "category",
    "status",
    "power",
    "speed",
    "endurance",
  ];

  if (
    Object.keys(value).length === 0 ||
    Object.keys(value).some((key) => !allowedFields.includes(key))
  ) {
    return false;
  }

  if (
    value.name !== undefined &&
    (typeof value.name !== "string" ||
      value.name.trim().length === 0 ||
      value.name.trim().length > 120)
  ) {
    return false;
  }

  if (
    value.age !== undefined &&
    (typeof value.age !== "number" ||
      !Number.isInteger(value.age) ||
      value.age < 1 ||
      value.age > 120)
  ) {
    return false;
  }

  if (
    value.weightClass !== undefined &&
    (typeof value.weightClass !== "string" ||
      value.weightClass.trim().length === 0 ||
      value.weightClass.trim().length > 40)
  ) {
    return false;
  }

  if (
    value.category !== undefined &&
    (typeof value.category !== "string" ||
      value.category.trim().length === 0 ||
      value.category.trim().length > 60)
  ) {
    return false;
  }

  if (
    value.status !== undefined &&
    (typeof value.status !== "string" ||
      !validStatuses.includes(value.status as AthleteStatus))
  ) {
    return false;
  }

  for (const field of ["power", "speed", "endurance"] as const) {
    if (value[field] !== undefined && !isValidScore(value[field])) {
      return false;
    }
  }

  return true;
}

// GET /api/athletes
// Returns all athlete details, including the three performance columns.
router.get("/", (_req: Request, res: Response) => {
  try {
    const athletes = db
      .prepare(
        `
        SELECT
          id,
          name,
          age,
          weightClass,
          category,
          status,
          power,
          speed,
          endurance,
          createdAt,
          updatedAt
        FROM athletes
        ORDER BY name COLLATE NOCASE ASC
      `,
      )
      .all() as Athlete[];

    return res.json(athletes);
  } catch (error) {
    console.error("Failed to fetch athletes:", error);

    return res.status(500).json({
      error: "Failed to load athletes.",
    });
  }
});

// GET /api/athletes/:id
router.get("/:id", (req: Request, res: Response) => {
  try {
    const athlete = getAthlete(req.params.id);

    if (!athlete) {
      return res.status(404).json({
        error: "Athlete not found.",
      });
    }

    return res.json(athlete);
  } catch (error) {
    console.error("Failed to fetch athlete:", error);

    return res.status(500).json({
      error: "Failed to load athlete.",
    });
  }
});

// POST /api/athletes
// Creates the athlete and writes all three scores to separate columns.
router.post("/", (req: Request, res: Response) => {
  if (!isValidAthleteInput(req.body)) {
    return res.status(400).json({
      error:
        "Invalid athlete details. Provide a name, positive integer age, weight class, category, and valid performance scores from 0 to 10.",
    });
  }

  const athlete = {
    id: randomUUID(),
    ...cleanAthlete(req.body),
  };

  try {
    db.prepare(
      `
      INSERT INTO athletes (
        id,
        name,
        age,
        weightClass,
        category,
        status,
        power,
        speed,
        endurance
      )
      VALUES (
        @id,
        @name,
        @age,
        @weightClass,
        @category,
        @status,
        @power,
        @speed,
        @endurance
      )
    `,
    ).run(athlete);

    const saved = getAthlete(athlete.id);

    return res.status(201).json(saved);
  } catch (error) {
    console.error("Failed to create athlete:", error);

    return res.status(500).json({
      error: "Failed to save athlete.",
    });
  }
});

// PUT /api/athletes/:id
// Replaces the athlete's editable fields, including performance scores.
router.put("/:id", (req: Request, res: Response) => {
  if (!isValidAthleteInput(req.body)) {
    return res.status(400).json({
      error: "Invalid athlete details.",
    });
  }

  try {
    const existing = getAthlete(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: "Athlete not found.",
      });
    }

    const input = cleanAthlete(req.body);

    db.prepare(
      `
      UPDATE athletes
      SET
        name = @name,
        age = @age,
        weightClass = @weightClass,
        category = @category,
        status = @status,
        power = @power,
        speed = @speed,
        endurance = @endurance,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = @id
    `,
    ).run({
      id: req.params.id,
      ...input,
    });

    return res.json(getAthlete(req.params.id));
  } catch (error) {
    console.error("Failed to update athlete:", error);

    return res.status(500).json({
      error: "Failed to update athlete.",
    });
  }
});

// PATCH /api/athletes/:id
// Supports updating only the performance scores, or any allowed subset
// of athlete fields. Unspecified values remain unchanged.
router.patch("/:id", (req: Request, res: Response) => {
  if (!isValidPartialUpdate(req.body)) {
    return res.status(400).json({
      error:
        "Invalid update. Provide at least one valid athlete field. Scores must be numbers between 0 and 10.",
    });
  }

  try {
    const existing = getAthlete(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: "Athlete not found.",
      });
    }

    const body = req.body as AthleteUpdate;

    const updated = {
      name: body.name ?? existing.name,
      age: body.age ?? existing.age,
      weightClass: body.weightClass ?? existing.weightClass,
      category: body.category ?? existing.category,
      status: body.status ?? existing.status,
      power: body.power ?? existing.power,
      speed: body.speed ?? existing.speed,
      endurance: body.endurance ?? existing.endurance,
    };

    db.prepare(
      `
      UPDATE athletes
      SET
        name = @name,
        age = @age,
        weightClass = @weightClass,
        category = @category,
        status = @status,
        power = @power,
        speed = @speed,
        endurance = @endurance,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = @id
    `,
    ).run({
      id: req.params.id,
      ...updated,
    });

    return res.json(getAthlete(req.params.id));
  } catch (error) {
    console.error("Failed to update athlete:", error);

    return res.status(500).json({
      error: "Failed to update athlete.",
    });
  }
});

// PATCH /api/athletes/:id/status
router.patch("/:id/status", (req: Request, res: Response) => {
  const { status } = req.body as { status?: unknown };

  if (
    typeof status !== "string" ||
    !validStatuses.includes(status as AthleteStatus)
  ) {
    return res.status(400).json({
      error: "Status must be Active or Inactive.",
    });
  }

  try {
    const result = db
      .prepare(
        `
        UPDATE athletes
        SET status = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      )
      .run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Athlete not found.",
      });
    }

    return res.json(getAthlete(req.params.id));
  } catch (error) {
    console.error("Failed to update athlete status:", error);

    return res.status(500).json({
      error: "Failed to update athlete status.",
    });
  }
});

// DELETE /api/athletes/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const result = db
      .prepare("DELETE FROM athletes WHERE id = ?")
      .run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Athlete not found.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Failed to delete athlete:", error);

    return res.status(500).json({
      error: "Failed to delete athlete.",
    });
  }
});

export default router;
