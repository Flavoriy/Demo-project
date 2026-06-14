import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ListTodo, Target, TimerReset } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { serializeTask } from "@/lib/serializers";
import { getFocusPlan, getTaskBoardCounts, type FocusPlanItem } from "@/lib/tasks/task-board";
import { cn } from "@/lib/utils/cn";
import { listTasksForView } from "@/server/services/task.service";

const dueToneClasses: Record<FocusPlanItem["due"]["tone"], string> = {
  danger: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  warning: "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]",
  success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
  default: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
};

const priorityClasses = {
  HIGH: "bg-[#fee2e2] text-[#b91c1c]",
  MEDIUM: "bg-[#ffedd5] text-[#c2410c]",
  LOW: "bg-[#dbeafe] text-[#1d4ed8]",
};

function formatPriority(priority: FocusPlanItem["task"]["priority"]) {
  if (priority === "HIGH") return "High priority";
  if (priority === "MEDIUM") return "Medium priority";
  return "Low priority";
}

function FocusPlanList({ plan }: { plan: FocusPlanItem[] }) {
  if (plan.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-8 text-sm text-[#166534]">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>No open tasks need focus right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-[18px] border border-border bg-white">
      {plan.map((item) => (
        <article key={item.task.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              {item.rank}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", dueToneClasses[item.due.tone])}>
                  {item.due.label}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", priorityClasses[item.task.priority])}>
                  {formatPriority(item.task.priority)}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold leading-snug">{item.task.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.reason}</p>
              <p className="mt-2 text-xs text-muted">{item.due.detail}</p>
            </div>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--panel-muted)]"
            href={`/tasks?search=${encodeURIComponent(item.task.title)}`}
          >
            Open
            <ArrowRight className="size-4" />
          </Link>
        </article>
      ))}
    </div>
  );
}

export default async function FocusPage() {
  const profile = await getCurrentProfileOrRedirect();
  const { tasks } = await listTasksForView({
    userId: profile.id,
    timezone: profile.timezone,
    query: { view: "all" },
  });
  const serializedTasks = tasks.map(serializeTask);
  const focusPlan = getFocusPlan(serializedTasks, profile.timezone);
  const counts = getTaskBoardCounts(serializedTasks, profile.timezone);
  const openTasks = serializedTasks.filter((task) => task.status !== "DONE");
  const highPriorityOpen = openTasks.filter((task) => task.priority === "HIGH").length;

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-l-4 border-l-accent">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-label">Focus</p>
              <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.04em]">
                Work the next best task.
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                Current order from overdue, due today, priority, and in-progress signals.
              </p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(22,163,74,0.18)]"
              href="/tasks"
            >
              Task board
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#b91c1c]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Overdue</p>
              <p className="mt-2 text-3xl font-bold leading-none">{counts.overdue}</p>
              <p className="mt-1 text-xs opacity-80">recover first</p>
            </div>
            <div className="rounded-[14px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[#9a3412]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">To do</p>
              <p className="mt-2 text-3xl font-bold leading-none">{counts.todo}</p>
              <p className="mt-1 text-xs opacity-80">waiting to start</p>
            </div>
            <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[#1d4ed8]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">In progress</p>
              <p className="mt-2 text-3xl font-bold leading-none">{counts.inProgress}</p>
              <p className="mt-1 text-xs opacity-80">already moving</p>
            </div>
            <div className="rounded-[14px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[#166534]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">High</p>
              <p className="mt-2 text-3xl font-bold leading-none">{highPriorityOpen}</p>
              <p className="mt-1 text-xs opacity-80">open priority</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="section-label">Queue health</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Open work</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
              <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-[#eff6ff] text-[#1d4ed8]">
                <ListTodo className="size-4" />
              </span>
              <div>
                <p className="font-semibold">{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</p>
                <p className="text-muted">Across the current workspace.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
              <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-[#fff7ed] text-[#9a3412]">
                <Clock3 className="size-4" />
              </span>
              <div>
                <p className="font-semibold">{focusPlan.length} ranked item{focusPlan.length === 1 ? "" : "s"}</p>
                <p className="text-muted">Ready for focused execution.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-white px-3 py-3">
              <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-[#f0fdf4] text-[#166534]">
                <TimerReset className="size-4" />
              </span>
              <div>
                <p className="font-semibold">{counts.done} completed</p>
                <p className="text-muted">Closed in the full task list.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Ranked plan</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Priority stack</h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--panel-muted)] px-3 py-1.5 text-xs font-semibold text-muted">
            <Target className="size-3.5" />
            {profile.timezone.replaceAll("_", " ")}
          </span>
        </div>
        <FocusPlanList plan={focusPlan} />
      </Card>
    </>
  );
}
