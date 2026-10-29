export type InstagramImport = {
  url: string;

  caption?: string;

  account?: string;
};

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractDate(text: string) {
  const patterns = [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](2026)\b/,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+2026\b/i,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+2026\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0];
    }
  }

  return null;
}

function extractCity(text: string) {
  const cities = [
    "Mumbai",
    "Pune",
    "Nashik",
    "Nagpur",
    "Thane",
    "Navi Mumbai",
    "Kolhapur",
    "Aurangabad",
    "Chhatrapati Sambhajinagar",
    "Solapur",
    "Amravati",
    "Sangli",
  ];

  for (const city of cities) {
    if (text.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }

  return null;
}

function extractCategories(text: string) {
  const categories: string[] = [];

  const possibleCategories = [
    "U11",
    "U13",
    "U15",
    "U17",
    "U19",
    "Youth",
    "Junior",
    "Elite",
    "Senior",
  ];

  for (const category of possibleCategories) {
    if (text.toLowerCase().includes(category.toLowerCase())) {
      categories.push(category);
    }
  }

  return categories;
}

export function parseInstagramPost(input: InstagramImport) {
  const caption = cleanText(input.caption || "");

  const city = extractCity(caption);

  const date = extractDate(caption);

  const categories = extractCategories(caption);

  let name = "Boxing Competition";

  const firstLine = caption.split(/[.!?\n]/)[0];

  if (firstLine && firstLine.length > 5 && firstLine.length < 100) {
    name = firstLine;
  }

  return {
    name,

    date,

    city: city || "Maharashtra",

    venue: "Venue TBA",

    status: "Pending" as const,

    deadline: null,

    categories,

    organizer: input.account || "Instagram organizer",

    registration: input.url,

    description:
      "Competition discovered from an Instagram post and awaiting verification.",

    source: "Instagram",

    sourceUrl: input.url,

    lastVerified: new Date().toISOString().split("T")[0],
  };
}
