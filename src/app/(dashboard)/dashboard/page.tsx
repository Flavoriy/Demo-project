import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, ListTodo } from "lucide-react";
import type { Task, Event } from "@prisma/client";

import { Card } from "@/components/ui/card";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { sortEvents, sortTasks, toLocalDateTimeLabel } from "@/lib/dates/taskflow-dates";
import { getDashboardData } from "@/server/services/dashboard.service";

function formatTaskDue(task: { dueDate: string | null; dueTime: string | null; dueAtUtc: Date | null }, timezone: string) {
  if (task.dueAtUtc) {
    return `Due ${toLocalDateTimeLabel(task.dueAtUtc, timezone)}`;
  }

  if (task.dueDate) {
    return `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}`;
  }

  return "No due date";
}

function getPrimaryAction(overdueTasksCount: number, openTodayTasksCount: number) {
  if (overdueTasksCount > 0) {
    return {
      label: "Review overdue",
      href: "/tasks?view=overdue",
    };
  }
  if (openTodayTasksCount > 0) {
    return {
      label: "Open today tasks",
      href: "/tasks?view=today",
    };
  }
  return {
    label: "Plan upcoming",
    href: "/tasks?view=upcoming",
  };
}

function getHeroMessage(overdueTasksCount: number, openTodayTasksCount: number, hasNextEvent: boolean) {
  if (overdueTasksCount > 0) {
    return `${overdueTasksCount} overdue task${overdueTasksCount === 1 ? "" : "s"} need recovery first.`;
  }
  if (openTodayTasksCount > 0) {
    return `${openTodayTasksCount} task${openTodayTasksCount === 1 ? "" : "s"} still need attention today.`;
  }
  if (hasNextEvent) {
    return "Tasks are under control. The calendar is likely the main driver for the rest of today.";
  }
  return "Today looks calm. This is a good window to plan ahead or clear small admin tasks.";
}

interface PriorityOrderCardProps {
  overdueTasksCount: number;
  openTodayTasksCount: number;
  hasNextEvent: boolean;
  nextEventTitle: string | undefined;
}

function PriorityOrderCard({ overdueTasksCount, openTodayTasksCount, hasNextEvent, nextEventTitle }: Readonly<PriorityOrderCardProps>) {
  let overdueMessage = "No overdue work right now.";
  if (overdueTasksCount > 0) {
    const itemPlural = overdueTasksCount === 1 ? "" : "s";
    overdueMessage = `${overdueTasksCount} item${itemPlural} need a decision.`;
  }

  return (
    <Card>
      <p className="section-label">Next move</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Priority order</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fee2e2] text-xs font-bold text-[#b91c1c]">
            1
          </span>
          <div>
            <p className="font-semibold">Recover anything overdue</p>
            <p className="mt-1 text-muted">
              {overdueMessage}
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fff7ed] text-xs font-bold text-[#9a3412]">
            2
          </span>
          <div>
            <p className="font-semibold">Move today&apos;s open tasks</p>
            <p className="mt-1 text-muted">
              {openTodayTasksCount} task{openTodayTasksCount === 1 ? "" : "s"} still on today&apos;s board.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-xs font-bold text-[#1d4ed8]">
            3
          </span>
          <div>
            <p className="font-semibold">Protect calendar time</p>
            <p className="mt-1 text-muted">
              {hasNextEvent && nextEventTitle ? `${nextEventTitle} is the next visible calendar item.` : "No event is scheduled for today."}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface FocusQueueCardProps {
  focusTasks: Task[];
  overdueTasks: Task[];
  timezone: string;
}

function FocusQueueCard({ focusTasks, overdueTasks, timezone }: Readonly<FocusQueueCardProps>) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label">Focus queue</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Do these before anything optional</h2>
        </div>
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-accent" href="/tasks">
          Open tasks
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-white">
        {focusTasks.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted">Nothing urgent is on the board right now.</div>
        ) : (
          focusTasks.map((task, index) => {
            const isOverdue = overdueTasks.some((overdue) => overdue.id === task.id);
            return (
              <div key={task.id} className="flex gap-4 px-4 py-4">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--panel-muted)] text-sm font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isOverdue ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-[#fff7ed] text-[#9a3412]"
                      }`}
                    >
                      {isOverdue ? "Overdue" : "Today"}
                    </span>
                    <span className="rounded-full bg-[var(--panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {task.priority}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{task.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {formatTaskDue(task, timezone)}
                    {task.description ? ` • ${task.description}` : ""}
                  </p>
                </div>
                <ListTodo className="mt-1 size-5 shrink-0 text-accent" />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

interface ScheduleCardProps {
  sortedEvents: Event[];
  timezone: string;
}

function ScheduleCard({ sortedEvents, timezone }: Readonly<ScheduleCardProps>) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Calendar</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Today&apos;s schedule</h2>
        </div>
        <Link className="text-sm font-medium text-accent" href="/calendar">
          Week view
        </Link>
      </div>
      <div className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-white">
        {sortedEvents.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted">No calendar events are blocking time today.</div>
        ) : (
          sortedEvents.map((event) => {
            const timeLabel = event.isAllDay
              ? "All day"
              : event.startAtUtc
                ? toLocalDateTimeLabel(event.startAtUtc, timezone)
                : "Time TBD";
            return (
              <div key={event.id} className="flex items-start gap-3 px-4 py-4">
                <CalendarClock className="mt-1 size-5 shrink-0 text-[#1d4ed8]" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {timeLabel}
                    {event.description ? ` • ${event.description}` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

interface OverdueListCardProps {
  topOverdue: Task[];
  timezone: string;
}

function OverdueListCard({ topOverdue, timezone }: Readonly<OverdueListCardProps>) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Recovery</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Overdue list</h2>
        </div>
        <Link className="text-sm font-medium text-accent" href="/tasks?view=overdue">
          Review
        </Link>
      </div>
      <div className="mt-4 space-y-2">
        {topOverdue.length === 0 ? (
          <div className="rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-6 text-sm text-[#166534]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p>Nothing is overdue right now.</p>
            </div>
          </div>
        ) : (
          topOverdue.map((task) => (
            <div key={task.id} className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#dc2626]" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#7f1d1d]">{task.title}</h3>
                  <p className="mt-1 text-xs text-[#991b1b]">{formatTaskDue(task, timezone)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const profile = await getCurrentProfileOrRedirect();
  const dashboard = await getDashboardData(profile.id, profile.timezone);
  const openTodayTasks = dashboard.todayTasks.filter((task) => task.status !== "DONE");
  const focusTasks = sortTasks([
    ...dashboard.overdueTasks,
    ...openTodayTasks.filter((task) => !dashboard.overdueTasks.some((overdue) => overdue.id === task.id)),
  ]).slice(0, 5);
  const sortedEvents = sortEvents(dashboard.todayEvents);
  const topOverdue = sortTasks(dashboard.overdueTasks).slice(0, 4);
  const nextEvent = sortedEvents[0] ?? null;
  const primaryAction = getPrimaryAction(dashboard.summary.overdueTasks, openTodayTasks.length);
  const heroMessage = getHeroMessage(dashboard.summary.overdueTasks, openTodayTasks.length, nextEvent !== null);

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <Card className="border-l-4 border-l-accent">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-label">Command center</p>
              <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.04em]">
                Start with the highest signal.
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">{heroMessage}</p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(22,163,74,0.18)]"
              href={primaryAction.href}
            >
              {primaryAction.label}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[14px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[#9a3412]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Today</p>
              <p className="mt-2 text-3xl font-bold leading-none">{openTodayTasks.length}</p>
              <p className="mt-1 text-xs opacity-80">open task{openTodayTasks.length === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#b91c1c]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Overdue</p>
              <p className="mt-2 text-3xl font-bold leading-none">{dashboard.summary.overdueTasks}</p>
              <p className="mt-1 text-xs opacity-80">needs recovery</p>
            </div>
            <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[#1d4ed8]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Calendar</p>
              <p className="mt-2 text-3xl font-bold leading-none">{dashboard.summary.eventsToday}</p>
              <p className="mt-1 text-xs opacity-80">event{dashboard.summary.eventsToday === 1 ? "" : "s"} today</p>
            </div>
            <div className="rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[#166534]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Momentum</p>
              <p className="mt-2 text-3xl font-bold leading-none">{dashboard.summary.completedThisWeek}</p>
              <p className="mt-1 text-xs opacity-80">done this week</p>
            </div>
          </div>
        </Card>

        <PriorityOrderCard
          overdueTasksCount={dashboard.summary.overdueTasks}
          openTodayTasksCount={openTodayTasks.length}
          hasNextEvent={nextEvent !== null}
          nextEventTitle={nextEvent?.title}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FocusQueueCard
          focusTasks={focusTasks}
          overdueTasks={dashboard.overdueTasks}
          timezone={profile.timezone}
        />

        <div className="space-y-4">
          <ScheduleCard
            sortedEvents={sortedEvents}
            timezone={profile.timezone}
          />

          <OverdueListCard
            topOverdue={topOverdue}
            timezone={profile.timezone}
          />
        </div>
      </div>
    </>
  );
}
