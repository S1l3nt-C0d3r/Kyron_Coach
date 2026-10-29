import type { Competition } from "../data/competitions";

export type Page =
  | "dashboard"
  | "competitions"
  | "schedule"
  | "athletes"
  | "training"
  | "camps";

export type Athlete = {
  id: string;
  name: string;
  age: number;
  weightClass: string;
  category: string;
  status: "Active" | "Inactive";
  power?: number;
  speed?: number;
  endurance?: number;
};

export type AthletePerformance = {
  power: number;
  speed: number;
  endurance: number;
};

export type TrainingSession = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  duration: number;
  athleteIds: string[];
  completed: boolean;
  campId?: string;
  mode?: WorkoutLogMode;
  sets?: number;
  reps?: number;
  rounds?: number;
  rpe?: number;
  notes?: string;
};

export type WorkoutLogMode = "sets-reps" | "time" | "both";

export type WorkoutLog = {
  id: string;
  athleteId: string;
  date: string;
  time: string;
  title: string;
  category: string;
  mode: WorkoutLogMode;
  sets?: number;
  reps?: number;
  duration?: number;
  rounds?: number;
  rpe: number;
  notes: string;
  campId?: string;
};

export type Camp = {
  id: string;
  name: string;
  competitionId: string;
  startDate: string;
  endDate: string;
  athleteIds: string[];
  status: "Planning" | "Active" | "Completed";
};

export type { Competition };
