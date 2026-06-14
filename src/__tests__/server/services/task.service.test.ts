import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus, TaskPriority, TaskStatus } from "@prisma/client";

vi.mock("@/server/repositories/task.repository", () => ({
  taskRepository: {
    listByUser: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/services/google-sync.service", () => ({
  syncTaskToGoogle: vi.fn(),
}));

vi.mock("@/server/services/reminder.service", () => ({
  syncTaskReminders: vi.fn(),
}));

import { taskRepository } from "@/server/repositories/task.repository";
import { syncTaskToGoogle } from "@/server/services/google-sync.service";
import { syncTaskReminders } from "@/server/services/reminder.service";
import {
  completeTask,
  createTask,
  updateTask,
  listTasksForView,
  reopenTask,
  deleteTask,
  countCompletedThisWeek,
  getOverdueTasks,
} from "@/server/services/task.service";

const mockTaskRepository = vi.mocked(taskRepository);
const mockSyncTaskToGoogle = vi.mocked(syncTaskToGoogle);
const mockSyncTaskReminders = vi.mocked(syncTaskReminders);

type TaskFixture = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: Date | null;
  completedAt: Date | null;
  googleTaskId: string | null;
  googleTasklistId: string | null;
  googleEtag: string | null;
  googleUpdatedAt: Date | null;
  syncStatus: SyncStatus;
  lastSyncDirection: "APP_TO_GOOGLE" | "GOOGLE_TO_APP" | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeTask(overrides: Partial<TaskFixture> = {}): TaskFixture {
  return {
    id: "task-1",
    userId: "user-1",
    title: "Write release notes",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "2026-05-18",
    dueTime: "09:30",
    dueAtUtc: new Date("2026-05-18T02:30:00.000Z"),
    completedAt: null,
    googleTaskId: null,
    googleTasklistId: null,
    googleEtag: null,
    googleUpdatedAt: null,
    syncStatus: "LOCAL_ONLY",
    lastSyncDirection: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    createdAt: new Date("2026-05-17T08:00:00.000Z"),
    updatedAt: new Date("2026-05-17T08:00:00.000Z"),
    ...overrides,
  };
}

describe("task.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task and schedules reminders with parsed reminder offsets", async () => {
    const task = makeTask();
    mockTaskRepository.create.mockResolvedValue(task);
    mockSyncTaskReminders.mockResolvedValue({
      created: 1,
      canceled: 0,
    });

    const result = await createTask({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Write release notes",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        reminderOffsetsMinutes: [15],
      },
    });

    expect(result).toBe(task);
    expect(mockTaskRepository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Write release notes",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        dueAtUtc: expect.any(Date),
      }),
    );
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task,
      reminderOffsetsMinutes: [15],
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });

  it("passes reminder offsets through on update", async () => {
    const existing = makeTask({ googleTaskId: "google-1", syncStatus: "SYNCED" });
    const updated = makeTask({ title: "Updated title", syncStatus: "PENDING_UPDATE" });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(updated);
    mockSyncTaskReminders.mockResolvedValue({
      created: 2,
      canceled: 1,
    });

    const result = await updateTask({
      userId: "user-1",
      id: "task-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Updated title",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        reminderOffsetsMinutes: [15, 60],
      },
    });

    expect(result).toBe(updated);
    expect(mockTaskRepository.update).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        title: "Updated title",
        syncStatus: "PENDING_UPDATE",
      }),
    );
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task: updated,
      reminderOffsetsMinutes: [15, 60],
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });

  it("cancels reminders when completing a task", async () => {
    const existing = makeTask({ googleTaskId: "google-1", syncStatus: "SYNCED" });
    const completed = makeTask({
      status: "DONE",
      completedAt: new Date("2026-05-17T10:00:00.000Z"),
      syncStatus: "PENDING_UPDATE",
    });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(completed);
    mockSyncTaskReminders.mockResolvedValue({
      created: 0,
      canceled: 1,
    });

    const result = await completeTask("user-1", "task-1");

    expect(result).toBe(completed);
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task: completed,
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });

  it("lists tasks for a view with filters", async () => {
    const tasks = [makeTask({ status: "TODO" }), makeTask({ id: "task-2", status: "DONE" })];
    mockTaskRepository.listByUser.mockResolvedValue(tasks);

    const result = await listTasksForView({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      query: { view: "all", status: "TODO" },
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("task-1");
  });

  it("reopens a task", async () => {
    const existing = makeTask({ status: "DONE", completedAt: new Date() });
    const reopened = makeTask({ status: "TODO", completedAt: null, syncStatus: "LOCAL_ONLY" });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(reopened);

    const result = await reopenTask("user-1", "task-1");

    expect(result.status).toBe("TODO");
    expect(result.completedAt).toBeNull();
    expect(mockTaskRepository.update).toHaveBeenCalledWith("task-1", {
      status: "TODO",
      completedAt: null,
      syncStatus: "LOCAL_ONLY",
    });
  });

  it("deletes a task", async () => {
    const existing = makeTask({ googleTaskId: "google-1" });
    const deleted = makeTask({ deletedAt: new Date(), syncStatus: "PENDING_DELETE" });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(deleted);

    const result = await deleteTask("user-1", "task-1");

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(mockTaskRepository.update).toHaveBeenCalledWith("task-1", expect.objectContaining({
      syncStatus: "PENDING_DELETE",
    }));
  });

  it("counts tasks completed this week", async () => {
    const weekAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const tasks = [
      makeTask({ completedAt: weekAgo }),
      makeTask({ id: "task-2", completedAt: null }),
    ];
    mockTaskRepository.listByUser.mockResolvedValue(tasks);

    const result = await countCompletedThisWeek("user-1");
    expect(result).toBe(1);
  });

  it("filters overdue tasks", async () => {
    const tasks = [
      makeTask({ id: "task-1", status: "TODO", dueDate: "2026-05-10" }),
      makeTask({ id: "task-2", status: "DONE", dueDate: "2026-05-10" }),
    ];
    const overdue = getOverdueTasks(tasks, "Asia/Ho_Chi_Minh");
    expect(overdue).toHaveLength(1);
    expect(overdue[0].id).toBe("task-1");
  });
});
