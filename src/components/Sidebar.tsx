import type { Page } from "../types";
import SidebarIcon, { type SidebarIconName } from "./SidebarIcon";
import logo from "../../Kyron_Logo.png";

type Props = {
  page: Page;
  setPage: (page: Page) => void;
};

export default function Sidebar({ page, setPage }: Props) {
  const items: {
    id: Page;
    label: string;
    icon: SidebarIconName;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: "pantheon" },
    { id: "competitions", label: "Competitions", icon: "spears" },
    { id: "camps", label: "Camps", icon: "camps" },
    { id: "schedule", label: "Schedule", icon: "calendar" },
    { id: "training", label: "Training", icon: "sword" },
    { id: "athletes", label: "Athletes", icon: "helmet" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img
            src={logo}
            alt="Kyron Coach logo"
            height={50}
            width={50}
          />
        </div>
        <div>
          <div className="brand-name">Kyron Coach</div>
          <div className="brand-subtitle">Coach Platform</div>
        </div>
      </div>

      <nav className="nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">
              <SidebarIcon name={item.icon} />
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="coach-card">
          <div className="avatar">NS</div>
          <div>
            <strong>Coach</strong>
            <span>Boxing Academy</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
