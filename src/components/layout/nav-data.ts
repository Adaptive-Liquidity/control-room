import {
  Beaker,
  Bot,
  Briefcase,
  CalendarDays,
  FolderOpen,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LineChart,
  PenLine,
  ScrollText,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Command",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Briefcase, label: "Chief of Staff", href: "/staff" },
      { icon: Bot, label: "Agents", href: "/agents" },
      { icon: Inbox, label: "Queue", href: "/queue" },
      { icon: PenLine, label: "Studio", href: "/studio" },
      { icon: CalendarDays, label: "Calendar", href: "/calendar" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { icon: GitBranch, label: "Attribution", href: "/attribution" },
      { icon: LineChart, label: "Analytics", href: "/analytics" },
      { icon: Beaker, label: "A/B Lab", href: "/ablab" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: FolderOpen, label: "Library", href: "/library" },
      { icon: Target, label: "Campaigns", href: "/campaigns" },
      { icon: ScrollText, label: "Audit", href: "/audit" },
      { icon: Users, label: "Team", href: "/team" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
];

/** Hrefs pinned to the phone bottom tab bar, in display order. */
export const primaryTabHrefs = ["/dashboard", "/queue", "/agents", "/calendar"] as const;

export const primaryTabs: NavItem[] = primaryTabHrefs.map((href) => {
  const item = navSections
    .flatMap((s) => s.items)
    .find((i) => i.href === href);
  if (!item) throw new Error(`primaryTabHrefs references unknown href: ${href}`);
  return item;
});

/** Sections rendered inside the phone "More" sheet (primary tabs excluded). */
export const moreSections: NavSection[] = navSections
  .map((section) => ({
    ...section,
    items: section.items.filter(
      (i) => !primaryTabHrefs.includes(i.href as (typeof primaryTabHrefs)[number])
    ),
  }))
  .filter((section) => section.items.length > 0);

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
