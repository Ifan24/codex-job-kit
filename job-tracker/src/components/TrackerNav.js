"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsModal from "./SettingsModal";

const navItems = [
  { href: "/", label: "Apply Next" },
  { href: "/timeline", label: "Timeline" },
  { href: "/runs", label: "Workflow Runs" },
];

export default function TrackerNav() {
  const pathname = usePathname();

  return (
    <nav className="tracker-nav" aria-label="Primary">
      <div className="tracker-nav-brand">
        <span className="tracker-nav-mark" aria-hidden="true">
          JT
        </span>
        <span>
          <span className="eyebrow">Job Tracker</span>
          <span className="tracker-nav-subtitle">Application operations</span>
        </span>
      </div>
      <div className="tracker-nav-links">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`tracker-nav-link ${pathname === item.href ? "is-active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        <SettingsModal />
      </div>
    </nav>
  );
}
