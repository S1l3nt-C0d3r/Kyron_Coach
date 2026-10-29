export type CompetitionSource = {
  id: string;
  name: string;
  type: "website" | "instagram";
  url: string;
  region: "Maharashtra";
  sport: "boxing";
  trusted: boolean;
};

export const SOURCES: CompetitionSource[] = [
  {
    id: "outplay-sports",
    name: "Outplay Sports",
    type: "website",
    url: "https://outplaysports.org/upcoming-events/outplay-boxing-championship",
    region: "Maharashtra",
    sport: "boxing",
    trusted: true,
  },

  {
    id: "maharashtra-boxing-association",
    name: "Maharashtra Boxing Association",
    type: "website",
    url: "https://maharashtraboxingassociation.com/",
    region: "Maharashtra",
    sport: "boxing",
    trusted: true,
  },

  {
    id: "mumbai-suburban-dso",
    name: "Mumbai Suburban District Sports Office",
    type: "website",
    url: "https://dsomumbaisub.blogspot.com/",
    region: "Maharashtra",
    sport: "boxing",
    trusted: true,
  },
];
