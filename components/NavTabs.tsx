"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, PieChart } from "lucide-react";

const TABS = [
  { href: "/", label: "Stocks", icon: BarChart2 },
  { href: "/sectors", label: "Sectors", icon: PieChart },
] as const;

/** Top-level tab bar shared by every page. */
export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex gap-1 bg-gray-900/60 p-1 rounded-xl border border-gray-800 mb-8">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              active
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
