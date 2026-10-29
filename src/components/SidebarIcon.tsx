export type SidebarIconName =
  | "pantheon"
  | "spears"
  | "camps"
  | "calendar"
  | "sword"
  | "helmet";

export default function SidebarIcon({ name }: { name: SidebarIconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "pantheon":
      return (
        <svg {...common}>
          <path d="M2.5 8.5 12 4l9.5 4.5h-19Z" />
          <path d="M4 10h16M4 19h16M2.5 21h19" />
          <path d="M5.5 10v9M9.8 10v9M14.2 10v9M18.5 10v9" />
        </svg>
      );

    case "spears":
      return (
        <svg {...common}>
          <path d="M4 4 20 20M2.5 2.5 7 4l-3 3-1.5-4.5Z" />
          <path d="M20 4 4 20M21.5 2.5 20 7l-3-3 4.5-1.5Z" />
        </svg>
      );

    case "camps":
      return (
        <svg {...common}>
          <path d="M3 20 12 4l9 16H3Z" />
          <path d="m8 20 4-7 4 7M12 4v3" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
          <path d="M7.5 13h2M12 13h2M7.5 16.5h2M12 16.5h2" />
        </svg>
      );

    case "sword":
      return (
        <svg {...common}>
          <path d="m6 18 12-12M14.5 4.5l5 5M12.5 7.5l4 4" />
          <path d="m4 17 3 3M3 21l5-5M17 3l4 4" />
        </svg>
      );

    case "helmet":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.5}>
          {/* Swept crest outline */}
          <path d="M3 21C5 18 5 15 4 12 2 6 7 2 13 2c3 0 6 1 8 2l-2 4c-3-2-7-2-10 0-3 2-4 5-3 8 1 2 0 4-3 5Z" />
          {/* Inner crest */}
          <path d="M7 14c0-4 3-7 8-7-3 1-5 3-5 5-1 0-2 1-3 2Z" />
          {/* Helmet face and cheek guard */}
          <path d="M10 10c3-2 7 0 8 3l2 3-3-1c-1-2-3-2-4-1 1 1 2 2 4 2v3l1 3-6-3-4 1 1-4c-1-3-1-5 1-6Z" />
        </svg>
      );
  }
}
