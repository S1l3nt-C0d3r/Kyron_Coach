import type { Athlete, AthletePerformance, TrainingSession } from "../types";
import { dateString } from "../utils/date";

export const demoAthletes: Athlete[] = [
  {
    id: "athlete-1",
    name: "Arjun Mehta",
    age: 19,
    weightClass: "60 kg",
    category: "Elite",
    status: "Active",
  },
  {
    id: "athlete-2",
    name: "Rohan Patil",
    age: 17,
    weightClass: "63.5 kg",
    category: "Youth",
    status: "Active",
  },
  {
    id: "athlete-3",
    name: "Kabir Shah",
    age: 16,
    weightClass: "57 kg",
    category: "Youth",
    status: "Active",
  },
];

export const demoPerformance: Record<string, AthletePerformance> = {
  "athlete-1": { power: 86, speed: 92, endurance: 78 },
  "athlete-2": { power: 74, speed: 83, endurance: 89 },
  "athlete-3": { power: 93, speed: 76, endurance: 84 },
};

export const defaultPerformance: AthletePerformance = {
  power: 80,
  speed: 80,
  endurance: 80,
};

export const exerciseOptions = [
  { name: "Shadowboxing", category: "Technical" },
  { name: "Jab-cross combinations", category: "Technical" },
  { name: "Hook and uppercut combinations", category: "Technical" },
  { name: "Footwork and pivots", category: "Technical" },
  { name: "Defensive slips and blocks", category: "Technical" },
  { name: "Heavy bag rounds", category: "Bag work" },
  { name: "Speed bag", category: "Bag work" },
  { name: "Double-end bag accuracy", category: "Bag work" },
  { name: "Focus mitts", category: "Bag work" },
  { name: "Technical sparring", category: "Sparring" },
  { name: "Situational sparring", category: "Sparring" },
  { name: "Skipping rope", category: "Conditioning" },
  { name: "Running intervals", category: "Conditioning" },
  { name: "Shuttle sprints", category: "Conditioning" },
  { name: "Bodyweight circuit", category: "Strength" },
  { name: "Push-ups", category: "Strength" },
  { name: "Squats and lunges", category: "Strength" },
  { name: "Medicine-ball throws", category: "Strength" },
  { name: "Core circuit", category: "Strength" },
  { name: "Dynamic mobility", category: "Mobility" },
  { name: "Cooldown and breathing", category: "Recovery" },
];

export const demoTraining: TrainingSession[] = [
  {
    id: "session-1",
    title: "Technical Boxing",
    date: dateString(0),
    time: "17:00",
    type: "Technical",
    duration: 90,
    athleteIds: ["athlete-1", "athlete-2"],
    completed: false,
  },
  {
    id: "session-2",
    title: "Conditioning + Intervals",
    date: dateString(1),
    time: "18:00",
    type: "Conditioning",
    duration: 75,
    athleteIds: ["athlete-1", "athlete-2", "athlete-3"],
    completed: false,
  },
  {
    id: "session-3",
    title: "Sparring",
    date: dateString(2),
    time: "17:30",
    type: "Sparring",
    duration: 90,
    athleteIds: ["athlete-1"],
    completed: false,
  },
];
