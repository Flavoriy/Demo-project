import { describe, expect, it } from "vitest";

import {
  getFocusPlan,
  getTaskBoardCounts,
  getTaskDueMeta,
  groupTasksByStatus,
  type TaskBoardRecord,
} from "@/lib/tasks/task-board";

const baseTask: TaskBoardRecord = {
  id: "task-1",
  title: "Write release notes",
  description: null,
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "2026-05-17",
  dueTime: "09:30",
  dueAtUtc: "2026-05-17T02:30:00.000Z",
  completedAt: null,
};

describe("task-board helpers", () => {
  it("marks past due open tasks as overdue", () => {
    const result = getTaskDueMeta(baseTask, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));

    expect(result).toMatchObject({
      label: "Overdue",
      tone: "danger",
      isOverdue: true,
    });
  });

  it("treats completed tasks as done instead of overdue", () => {
    const result = getTaskDueMeta(
      {
        ...baseTask,
        status: "DONE",
        completedAt: "2026-05-17T05:00:00.000Z",
      },
      "Asia/Ho_Chi_Minh",
      new Date("2026-05-17T06:00:00.000Z"),
    );

    expect(result).toMatchObject({
      label: "Done",
      tone: "success",
      isOverdue: false,
    });
  });

  it("builds summary counts and groups by status", () => {
    const tasks: TaskBoardRecord[] = [
      baseTask,
      {
        ...baseTask,
        id: "task-2",
        status: "IN_PROGRESS",
        dueDate: "2026-05-18",
        dueAtUtc: "2026-05-18T03:00:00.000Z",
      },
      {
        ...baseTask,
        id: "task-3",
        status: "DONE",
        completedAt: "2026-05-17T05:00:00.000Z",
      },
    ];

    expect(getTaskBoardCounts(tasks, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"))).toEqual({
      todo: 1,
      inProgress: 1,
      done: 1,
      overdue: 1,
    });

    expect(groupTasksByStatus(tasks)).toEqual({
      TODO: [tasks[0]],
      IN_PROGRESS: [tasks[1]],
      DONE: [tasks[2]],
    });
  });

  it("builds a ranked focus plan from open task signals", () => {
    const tasks: TaskBoardRecord[] = [
      baseTask,
      {
        ...baseTask,
        id: "task-today",
        title: "Review CI deploy",
        status: "IN_PROGRESS",
        priority: "LOW",
        dueDate: "2026-05-17",
        dueAtUtc: "2026-05-17T10:00:00.000Z",
      },
      {
        ...baseTask,
        id: "task-upcoming",
        title: "Prepare launch checklist",
        priority: "HIGH",
        dueDate: "2026-05-18",
        dueAtUtc: "2026-05-18T03:00:00.000Z",
      },
      {
        ...baseTask,
        id: "task-done",
        status: "DONE",
        priority: "HIGH",
        completedAt: "2026-05-17T05:00:00.000Z",
      },
    ];

    const plan = getFocusPlan(tasks, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"), 3);

    expect(plan.map((item) => item.task.id)).toEqual(["task-1", "task-today", "task-upcoming"]);
    expect(plan.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(plan[0]).toMatchObject({
      due: {
        label: "Overdue",
        tone: "danger",
      },
      reason: "Medium priority and overdue",
    });
  });

  it("returns Someday for tasks with no due date", () => {
    const result = getTaskDueMeta(
      { ...baseTask, dueDate: null, dueAtUtc: null, dueTime: null },
      "Asia/Ho_Chi_Minh",
      new Date("2026-05-17T04:00:00.000Z")
    );
    expect(result.label).toBe("Someday");
  });

  it("handles overdue based on dueDate string comparison", () => {
    const result = getTaskDueMeta(
      { ...baseTask, dueAtUtc: null, dueDate: "2026-05-15" },
      "Asia/Ho_Chi_Minh",
      new Date("2026-05-17T04:00:00.000Z")
    );
    expect(result.label).toBe("Overdue");
  });

  it("breaks ties during focus plan ranking based on priority, due date, and title", () => {
    const tasks: TaskBoardRecord[] = [
      { ...baseTask, id: "task-A", title: "B task", priority: "MEDIUM", dueDate: "2026-05-18", dueAtUtc: null },
      { ...baseTask, id: "task-B", title: "A task", priority: "MEDIUM", dueDate: "2026-05-18", dueAtUtc: null },
    ];
    const plan = getFocusPlan(tasks, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));
    expect(plan[0].task.id).toBe("task-B"); // "A task" comes before "B task" alphabetically
  });

  it("covers remaining branches for getFocusReason and getDueOrder", () => {
    // 1. getFocusReason - "Already in progress" (IN_PROGRESS but not today/overdue)
    const taskInProgress = {
      ...baseTask,
      status: "IN_PROGRESS" as const,
      dueDate: null,
      dueAtUtc: null,
    };
    const plan1 = getFocusPlan([taskInProgress], "Asia/Ho_Chi_Minh", new Date());
    expect(plan1[0].reason).toBe("Already in progress");

    // 2. getFocusReason - "Useful after urgent work is clear"
    const taskSomeday = {
      ...baseTask,
      status: "TODO" as const,
      priority: "LOW" as const,
      dueDate: null,
      dueAtUtc: null,
    };
    const plan2 = getFocusPlan([taskSomeday], "Asia/Ho_Chi_Minh", new Date());
    expect(plan2[0].reason).toBe("Useful after urgent work is clear");

    // 3. getFocusReason - High priority with upcoming and high priority without due date
    const taskHighUpcoming = {
      ...baseTask,
      status: "TODO" as const,
      priority: "HIGH" as const,
      dueDate: "2026-05-19",
      dueAtUtc: null,
    };
    const plan3 = getFocusPlan([taskHighUpcoming], "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));
    expect(plan3[0].reason).toBe("High priority with an upcoming due date");

    const taskHighNoDue = {
      ...baseTask,
      status: "TODO" as const,
      priority: "HIGH" as const,
      dueDate: null,
      dueAtUtc: null,
    };
    const plan4 = getFocusPlan([taskHighNoDue], "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));
    expect(plan4[0].reason).toBe("High priority without a due date");

    // 4. getDueOrder - Invalid due date string and no due date
    const tasksForOrder: TaskBoardRecord[] = [
      {
        ...baseTask,
        id: "task-A",
        title: "B task",
        priority: "LOW",
        dueAtUtc: null,
        dueDate: null,
      },
      {
        ...baseTask,
        id: "task-B",
        title: "A task",
        priority: "LOW",
        dueAtUtc: null,
        dueDate: "invalid-date",
      },
    ];
    const plan5 = getFocusPlan(tasksForOrder, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));
    expect(plan5).toHaveLength(2);
    // B task should come before A task because of the tie-breaking on title (alphabetical sort for A task vs B task)
    expect(plan5[0].task.id).toBe("task-B"); 
  });
});
