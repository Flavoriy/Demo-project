"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckCheck,
  House,
  ListTodo,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", label: "Today", icon: House },
  { href: "/focus", label: "Focus", icon: Target },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/integrations", label: "Integrations", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function NavigationPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity",
        pending && "animate-pulse opacity-60",
        className,
      )}
    />
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:block">
      <div className="sticky top-5 flex min-h-[calc(100vh-2.5rem)] flex-col rounded-[20px] border border-border bg-[var(--sidebar)] px-3 py-4 shadow-[var(--shadow-sidebar)]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <span className="inline-flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-accent text-white shadow-[var(--shadow-accent)]">
            <CheckCheck className="size-5" />
          </span>
          <div>
            <p className="text-[1.15rem] font-bold tracking-[-0.04em] leading-tight">TikTo</p>
            <p className="text-[11px] text-[var(--sidebar-muted)]">Tasks + Google + Telegram</p>
          </div>
        </div>

        {/* Nav label */}
        <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.16em] text-[var(--sidebar-muted)] uppercase">
          Menu
        </p>

        {/* Nav items */}
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-accent text-white shadow-[0_6px_14px_rgba(22,163,74,0.22)]"
                    : "text-[var(--sidebar-muted)] hover:bg-white hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-[8px]",
                    isActive ? "bg-white/15" : "bg-transparent",
                  )}
                >
                  <Icon className="size-[15px]" />
                </span>
                <span className="truncate">{item.label}</span>
                <NavigationPendingIndicator className="ml-auto" />
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-auto px-3 pt-6">
          <p className="text-[11px] leading-5 text-[var(--sidebar-muted)]">
            Plan your day. Sync when ready.
          </p>
        </div>
      </div>
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="glass-panel fixed right-3 bottom-3 left-3 z-40 flex rounded-[16px] px-1.5 py-2 md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-medium",
              isActive ? "bg-accent text-white" : "text-muted",
            )}
          >
            <Icon className="size-4" />
            <span className="flex min-h-4 max-w-full items-center gap-1">
              <span className="truncate">{item.label}</span>
              <NavigationPendingIndicator />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
