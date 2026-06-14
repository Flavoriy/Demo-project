import { getTodayKey, toLocalDateTimeLabel } from "@/lib/dates/taskflow-dates";

export type TaskBoardRecord = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: string | null;
  completedAt: string | null;
};

export type TaskDueMeta = {
  label: string;
  detail: string;
  tone: "default" | "success" | "warning" | "danger";
  isOverdue: boolean;
};

export type FocusPlanItem = {
  rank: number;
  task: TaskBoardRecord;
  due: TaskDueMeta;
  reason: string;
  score: number;
};

const priorityWeights: Record<TaskBoardRecord["priority"], number> = {
  HIGH: 30,
  MEDIUM: 18,
  LOW: 8,
};

function formatPriorityLabel(priority: TaskBoardRecord["priority"]) {
  if (priority === "HIGH") return "High";
  if (priority === "MEDIUM") return "Medium";
  return "Low";
}

function getFocusDueWeight(due: TaskDueMeta) {
  if (due.isOverdue) return 80;
  if (due.label === "Today") return 48;
  if (due.label === "Upcoming") return 18;
  return 0;
}

function getFocusReason(task: TaskBoardRecord, due: TaskDueMeta) {
  if (due.isOverdue) {
    return `${formatPriorityLabel(task.priority)} priority and overdue`;
  }

  if (due.label === "Today" && task.status === "IN_PROGRESS") {
    return "Already moving and due today";
  }

  if (due.label === "Today") {
    return `${formatPriorityLabel(task.priority)} priority due today`;
  }

  if (task.status === "IN_PROGRESS") {
    return "Already in progress";
  }

  if (task.priority === "HIGH") {
    return due.label === "Upcoming" ? "High priority with an upcoming due date" : "High priority without a due date";
  }

  if (due.label === "Upcoming") {
    return "Upcoming due date";
  }

  return "Useful after urgent work is clear";
}

function getDueOrder(task: TaskBoardRecord) {
  if (task.dueAtUtc) {
    const dueAt = new Date(task.dueAtUtc).getTime();
    return Number.isNaN(dueAt) ? Number.POSITIVE_INFINITY : dueAt;
  }

  if (task.dueDate) {
    const dueDate = new Date(`${task.dueDate}T00:00:00.000Z`).getTime();
    return Number.isNaN(dueDate) ? Number.POSITIVE_INFINITY : dueDate;
  }

  return Number.POSITIVE_INFINITY;
}

export function getTaskDueMeta(task: TaskBoardRecord, timezone: string, now = new Date()): TaskDueMeta {
  if (task.status === "DONE") {
    return {
      label: "Done",
      detail: "Completed task",
      tone: "success",
      isOverdue: false,
    };
  }

  const todayKey = getTodayKey(timezone, now);
  const dueAt = task.dueAtUtc ? new Date(task.dueAtUtc) : null;
  const dueLabel = dueAt
    ? `Due ${toLocalDateTimeLabel(dueAt, timezone)}`
    : task.dueDate
      ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}`
      : "No due date";

  if (dueAt && dueAt.getTime() < now.getTime()) {
    return {
      label: "Overdue",
      detail: dueLabel,
      tone: "danger",
      isOverdue: true,
    };
  }

  if (task.dueDate && task.dueDate < todayKey) {
    return {
      label: "Overdue",
      detail: dueLabel,
      tone: "danger",
      isOverdue: true,
    };
  }

  if (task.dueDate === todayKey) {
    return {
      label: "Today",
      detail: dueLabel,
      tone: "warning",
      isOverdue: false,
    };
  }

  if (task.dueDate && task.dueDate > todayKey) {
    return {
      label: "Upcoming",
      detail: dueLabel,
      tone: "default",
      isOverdue: false,
    };
  }

  return {
    label: "Someday",
    detail: dueLabel,
    tone: "default",
    isOverdue: false,
  };
}

export function getTaskBoardCounts(tasks: TaskBoardRecord[], timezone: string, now = new Date()) {
  return {
    todo: tasks.filter((task) => task.status === "TODO").length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    done: tasks.filter((task) => task.status === "DONE").length,
    overdue: tasks.filter((task) => task.status !== "DONE" && getTaskDueMeta(task, timezone, now).isOverdue)
      .length,
  };
}

export function groupTasksByStatus(tasks: TaskBoardRecord[]) {
  return {
    TODO: tasks.filter((task) => task.status === "TODO"),
    IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
    DONE: tasks.filter((task) => task.status === "DONE"),
  };
}

export function getFocusPlan(
  tasks: TaskBoardRecord[],
  timezone: string,
  now = new Date(),
  limit = 6,
): FocusPlanItem[] {
  return tasks
    .filter((task) => task.status !== "DONE")
    .map((task) => {
      const due = getTaskDueMeta(task, timezone, now);
      const statusWeight = task.status === "IN_PROGRESS" ? 12 : 0;
      const score = getFocusDueWeight(due) + priorityWeights[task.priority] + statusWeight;

      return {
        rank: 0,
        task,
        due,
        reason: getFocusReason(task, due),
        score,
      };
    })
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;

      const priorityDiff = priorityWeights[right.task.priority] - priorityWeights[left.task.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const dueDiff = getDueOrder(left.task) - getDueOrder(right.task);
      if (dueDiff !== 0) return dueDiff;

      return left.task.title.localeCompare(right.task.title);
    })
    .slice(0, Math.max(0, limit))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}
