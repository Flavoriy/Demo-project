import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const qstashMocks = vi.hoisted(() => {
  const publishJSON = vi.fn();
  const cancel = vi.fn();
  const Client = vi.fn().mockImplementation(function () {
    return {
      publishJSON,
      messages: {
        cancel,
      },
    };
  });

  return {
    Client,
    cancel,
    publishJSON,
  };
});

vi.mock("@upstash/qstash", () => ({
  Client: qstashMocks.Client,
}));

const qstashEnvKeys = ["QSTASH_TOKEN", "NEXT_PUBLIC_APP_URL"] as const;
const originalEnv = Object.fromEntries(qstashEnvKeys.map((key) => [key, process.env[key]]));

function clearQStashEnv() {
  for (const key of qstashEnvKeys) {
    delete process.env[key];
  }
}

async function loadScheduler() {
  return import("@/lib/qstash/client");
}

beforeEach(() => {
  vi.resetModules();
  qstashMocks.Client.mockClear();
  qstashMocks.publishJSON.mockReset();
  qstashMocks.cancel.mockReset();
  clearQStashEnv();
});

afterEach(() => {
  clearQStashEnv();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("qstashReminderScheduler", () => {
  it("publishes reminder delivery requests to the reminder webhook", async () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    process.env.NEXT_PUBLIC_APP_URL = "https://taskflow.example";
    qstashMocks.publishJSON.mockResolvedValue({ messageId: "msg_123" });

    const { qstashReminderScheduler } = await loadScheduler();
    const payload = {
      reminderId: "reminder_1",
      userId: "user_1",
      targetType: "TASK" as const,
      targetId: "task_1",
    };
    const remindAtUtc = new Date("2026-05-17T08:00:00.000Z");

    await expect(qstashReminderScheduler.scheduleReminderDelivery(payload, remindAtUtc)).resolves.toEqual({
      messageId: "msg_123",
    });
    expect(qstashMocks.Client).toHaveBeenCalledWith({ token: "qstash-token" });
    expect(qstashMocks.publishJSON).toHaveBeenCalledWith({
      url: "https://taskflow.example/api/webhooks/qstash-reminder",
      body: payload,
      notBefore: Math.floor(remindAtUtc.getTime() / 1000),
      retries: 3,
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("rejects scheduling when QStash token is missing", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://taskflow.example";
    const { qstashReminderScheduler } = await loadScheduler();

    await expect(
      qstashReminderScheduler.scheduleReminderDelivery(
        {
          reminderId: "reminder_1",
          userId: "user_1",
          targetType: "TASK",
          targetId: "task_1",
        },
        new Date("2026-05-17T08:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      status: 500,
      code: "QSTASH_NOT_CONFIGURED",
    });
  });

  it("rejects scheduling when app URL is missing", async () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    const { qstashReminderScheduler } = await loadScheduler();

    await expect(
      qstashReminderScheduler.scheduleReminderDelivery(
        {
          reminderId: "reminder_1",
          userId: "user_1",
          targetType: "EVENT",
          targetId: "event_1",
        },
        new Date("2026-05-17T08:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      status: 500,
      code: "APP_URL_NOT_CONFIGURED",
    });
  });

  it("cancels scheduled reminder messages", async () => {
    process.env.QSTASH_TOKEN = "qstash-token";
    const { qstashReminderScheduler } = await loadScheduler();

    await qstashReminderScheduler.cancelReminderDelivery("msg_123");

    expect(qstashMocks.cancel).toHaveBeenCalledWith("msg_123");
  });
});
