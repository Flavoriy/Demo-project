import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus } from "@prisma/client";

vi.mock("@/server/repositories/event.repository", () => ({
  eventRepository: {
    listByUser: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/services/google-sync.service", () => ({
  syncEventToGoogle: vi.fn(),
}));

vi.mock("@/server/services/reminder.service", () => ({
  syncEventReminders: vi.fn(),
}));

import { eventRepository } from "@/server/repositories/event.repository";
import { syncEventToGoogle } from "@/server/services/google-sync.service";
import { syncEventReminders } from "@/server/services/reminder.service";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  listEventsInRange,
  getCalendarData,
  getEventFormDefaults,
  getEventDisplayDateKeys,
  toEventLocalInputValue,
} from "@/server/services/event.service";

const mockEventRepository = vi.mocked(eventRepository);
const mockSyncEventToGoogle = vi.mocked(syncEventToGoogle);
const mockSyncEventReminders = vi.mocked(syncEventReminders);

type EventFixture = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  startAtUtc: Date | null;
  endAtUtc: Date | null;
  startDate: string | null;
  endDate: string | null;
  googleEventId: string | null;
  googleCalendarId: string | null;
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

function makeEvent(overrides: Partial<EventFixture> = {}): EventFixture {
  return {
    id: "event-1",
    userId: "user-1",
    title: "Team sync",
    description: null,
    color: "teal",
    isAllDay: false,
    startAtUtc: new Date("2026-05-18T02:00:00.000Z"),
    endAtUtc: new Date("2026-05-18T03:00:00.000Z"),
    startDate: null,
    endDate: null,
    googleEventId: null,
    googleCalendarId: null,
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

describe("event.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a timed event and schedules reminders", async () => {
    const event = makeEvent();
    mockEventRepository.create.mockResolvedValue(event);
    mockSyncEventReminders.mockResolvedValue({
      created: 1,
      canceled: 0,
    });

    const result = await createEvent({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Team sync",
        isAllDay: false,
        startLocal: "2026-05-18T09:00",
        endLocal: "2026-05-18T10:00",
        reminderOffsetsMinutes: [15],
      },
    });

    expect(result).toBe(event);
    expect(mockEventRepository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Team sync",
        isAllDay: false,
        startAtUtc: expect.any(Date),
        endAtUtc: expect.any(Date),
      }),
    );
    expect(mockSyncEventReminders).toHaveBeenCalledWith({
      userId: "user-1",
      event,
      reminderOffsetsMinutes: [15],
    });
    expect(mockSyncEventToGoogle).toHaveBeenCalledWith("user-1", "event-1");
  });

  it("passes reminder offsets on update", async () => {
    const existing = makeEvent({ googleEventId: "google-1", syncStatus: "SYNCED" });
    const updated = makeEvent({ title: "Updated team sync", syncStatus: "PENDING_UPDATE" });
    mockEventRepository.findById.mockResolvedValue(existing);
    mockEventRepository.update.mockResolvedValue(updated);
    mockSyncEventReminders.mockResolvedValue({
      created: 2,
      canceled: 0,
    });

    const result = await updateEvent({
      userId: "user-1",
      id: "event-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Updated team sync",
        isAllDay: false,
        startLocal: "2026-05-18T09:00",
        endLocal: "2026-05-18T10:00",
        reminderOffsetsMinutes: [15, 60],
      },
    });

    expect(result).toBe(updated);
    expect(mockSyncEventReminders).toHaveBeenCalledWith({
      userId: "user-1",
      event: updated,
      reminderOffsetsMinutes: [15, 60],
    });
    expect(mockSyncEventToGoogle).toHaveBeenCalledWith("user-1", "event-1");
  });

  it("cancels reminders when deleting an event", async () => {
    const existing = makeEvent({ googleEventId: "google-1", syncStatus: "SYNCED" });
    const deleted = makeEvent({ deletedAt: new Date("2026-05-17T10:00:00.000Z"), syncStatus: "PENDING_DELETE" });
    mockEventRepository.findById.mockResolvedValue(existing);
    mockEventRepository.update.mockResolvedValue(deleted);
    mockSyncEventReminders.mockResolvedValue({
      created: 0,
      canceled: 1,
    });

    const result = await deleteEvent("user-1", "event-1");

    expect(result).toBe(deleted);
    expect(mockSyncEventReminders).toHaveBeenCalledWith({
      userId: "user-1",
      event: deleted,
    });
    expect(mockSyncEventToGoogle).toHaveBeenCalledWith("user-1", "event-1");
  });

  it("lists events in range", async () => {
    const events = [
      makeEvent({ startDate: "2026-05-18", endDate: "2026-05-18", isAllDay: true }),
    ];
    mockEventRepository.listByUser.mockResolvedValue(events);

    const result = await listEventsInRange({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      query: { from: "2026-05-15", to: "2026-05-20" },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("event-1");
  });

  it("gets calendar data", async () => {
    const events = [makeEvent()];
    mockEventRepository.listByUser.mockResolvedValue(events);

    const result = await getCalendarData({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      view: "week",
      date: "2026-05-18",
    });

    expect(typeof result.anchorDate).toBe("string");
    expect(result.events).toBeInstanceOf(Array);
  });

  it("gets event form defaults", () => {
    const defaults = getEventFormDefaults("Asia/Ho_Chi_Minh", "2026-05-18");
    expect(defaults.title).toBe("");
    expect(defaults.startDate).toBe("2026-05-18");
  });

  it("gets event display date keys", () => {
    const event = makeEvent({ startDate: "2026-05-18", endDate: "2026-05-18", isAllDay: true });
    const keys = getEventDisplayDateKeys(event, "Asia/Ho_Chi_Minh");
    expect(keys).toContain("2026-05-18");
  });

  it("formats date to event local input value", () => {
    const date = new Date("2026-05-18T09:00:00.000Z");
    const val = toEventLocalInputValue(date, "UTC");
    expect(val).toBe("2026-05-18T09:00");
  });
});
