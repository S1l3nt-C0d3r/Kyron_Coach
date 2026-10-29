import crypto from "crypto";
import { addCompetition, getCompetitions } from "./store";
import { SOURCES, CompetitionSource } from "./sources";

const MAHARASHTRA_CITIES = [
  "Navi Mumbai", "Chhatrapati Sambhajinagar", "Mumbai", "Thane", "Pune", "Nagpur", "Nashik", "Kolhapur", "Solapur", "Satara", "Sangli", "Ahilyanagar", "Ahmednagar", "Jalgaon", "Amravati", "Akola", "Latur", "Ratnagiri", "Dhule", "Nanded", "Wardha", "Yavatmal", "Beed", "Parbhani", "Osmanabad", "Dharashiv", "Palghar", "Raigad", "Sindhudurg", "Gondia", "Bhandara", "Chandrapur", "Washim", "Buldhana", "Hingoli", "Jalna", "Gadchiroli"
];
const MONTHS: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12", jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };

function createId(name: string, date: string, city: string) {
  return crypto.createHash("sha256").update(`${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}-${city.toLowerCase()}`).digest("hex").slice(0, 20);
}
function plainText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
}
function isBoxingEvent(text: string) {
  const lower = text.toLowerCase();
  return /\bboxing\b/.test(lower) && !/\bkickboxing\b|\bboxercise\b|\bshadow boxing fitness\b/.test(lower);
}
function extractDate(text: string): string | null {
  const patterns: RegExp[] = [
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/g,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(20\d{2})\b/gi,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})\b/gi,
  ];
  for (const match of text.matchAll(patterns[0])) {
    const [, d, m, y] = match;
    const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (isValidDate(date)) return date;
  }
  for (const match of text.matchAll(patterns[1])) {
    const [, d, month, y] = match;
    const date = `${y}-${MONTHS[month.toLowerCase()]}-${d.padStart(2, "0")}`;
    if (isValidDate(date)) return date;
  }
  for (const match of text.matchAll(patterns[2])) {
    const [, month, d, y] = match;
    const date = `${y}-${MONTHS[month.toLowerCase()]}-${d.padStart(2, "0")}`;
    if (isValidDate(date)) return date;
  }
  return null;
}
function isValidDate(value: string) { const d = new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; }
function extractCity(text: string): string | null {
  const lower = text.toLowerCase();
  return MAHARASHTRA_CITIES.sort((a, b) => b.length - a.length).find((city) => new RegExp(`\\b${city.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) ?? null;
}
function extractEventName(text: string, source: CompetitionSource) {
  const patterns = [/(?:event|competition|championship|tournament)\s*(?:name)?\s*[:\-]\s*([^.;|]{5,100})/i, /((?:district|state|maharashtra|national|open|boxing)[^.;|]{0,70}(?:boxing|championship|competition|tournament)[^.;|]{0,30})/i, /([^.;|]{5,80}(?:boxing championship|boxing competition|boxing tournament))/i];
  for (const pattern of patterns) { const match = text.match(pattern); if (match?.[1]) return match[1].replace(/\s+/g, " ").trim().slice(0, 100); }
  return source.name;
}
async function fetchSource(source: CompetitionSource) {
  const response = await fetch(source.url, { headers: { "user-agent": "BoxingOSCompetitionMonitor/1.0 (+event discovery; contact site owner before production use)" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  return response.text();
}
async function processSource(source: CompetitionSource) {
  const html = await fetchSource(source);
  const text = plainText(html);
  if (!isBoxingEvent(text)) return 0;
  const city = extractCity(text);
  const date = extractDate(text);
  if (!city || !date || date < new Date().toISOString().slice(0, 10)) return 0;
  const name = extractEventName(text, source);
  const competition = {
    id: createId(name, date, city), name, date, city, organizer: source.name,
    status: "needs-verification", source: source.name, sourceUrl: source.url,
    discoveredAt: new Date().toISOString(),
  };
  // Avoid adding duplicate events found through multiple sources using name/date/city similarity.
  const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existing = getCompetitions().find((item) => item.date === date && item.city.toLowerCase() === city.toLowerCase() && (key(item.name).includes(key(name).slice(0, 12)) || key(name).includes(key(item.name).slice(0, 12))));
  if (existing) return 0;
  return addCompetition(competition) ? 1 : 0;
}
export async function runIngestion() {
  let discovered = 0;
  for (const source of SOURCES) {
    try { const count = await processSource(source); discovered += count; console.log(`[INGESTION] ${source.name}: ${count} new candidates`); }
    catch (error) { console.error(`[INGESTION] Failed: ${source.name}`, error); }
  }
  console.log(`[INGESTION] Complete. ${discovered} new candidate competitions.`);
  return discovered;
}
