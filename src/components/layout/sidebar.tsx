"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navSections = [
  {
    title: "Command",
    items: [
      { icon: "📊", label: "Dashboard", href: "/dashboard" },
      { icon: "🤖", label: "Agent Squad", href: "/agents", badge: "4" },
      { icon: "📥", label: "Approval Queue", href: "/queue", badge: "5" },
      { icon: "✏️", label: "Content Studio", href: "/studio" },
      { icon: "📅", label: "Content Calendar", href: "/calendar" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { icon: "🔗", label: "Attribution", href: "/attribution" },
      { icon: "📈", label: "Analytics", href: "/analytics" },
      { icon: "🧪", label: "A/B Lab", href: "/ablab" },
    ],
  },
  {
    title: "Operations",
    items: [
      { icon: "📚", label: "Content Library", href: "/library" },
      { icon: "🎯", label: "Campaigns", href: "/campaigns" },
      { icon: "👥", label: "Team", href: "/team" },
      { icon: "⚙️", label: "Settings", href: "/settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[270px] bg-gradient-to-b from-aeon-navy-1 to-aeon-navy border-r border-aeon-navy-3 z-50 overflow-y-auto">
      <div className="p-5 border-b border-aeon-navy-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-aeon-teal to-emerald-500 rounded-xl flex items-center justify-center text-aeon-navy-1 font-black text-xl shadow-lg shadow-aeon-teal/20">
            A
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">AEON</div>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Marketing Command v2.0</div>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          All Systems Operational
        </div>
      </div>

      <nav className="py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="px-5 pb-2 pt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 mx-3 rounded-lg text-sm transition-all duration-200 relative",
                    isActive
                      ? "bg-gradient-to-r from-aeon-teal/15 to-transparent text-aeon-teal border-l-2 border-aeon-teal"
                      : "text-muted-foreground hover:text-foreground hover:bg-aeon-teal/5"
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="absolute right-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
