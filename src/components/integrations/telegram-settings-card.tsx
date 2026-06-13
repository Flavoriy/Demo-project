"use client";

import { useState, useTransition } from "react";
import {
  BellRing,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Info,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildTelegramStatusGuidance,
  type TelegramStatusSnapshot,
} from "@/lib/telegram/status";
import { cn } from "@/lib/utils/cn";

type TelegramSettingsCardProps = {
  integration: {
    chatId: string;
    telegramUsername: string | null;
    isEnabled: boolean;
  } | null;
  botTokenSaved: boolean;
  botTokenStorageReady: boolean;
  appUrlConfigured: boolean;
  qstashConfigured: boolean;
  qstashSigningConfigured: boolean;
};

type TelegramStatus = TelegramStatusSnapshot;

type SetupState = "done" | "current" | "warning" | "blocked";

type SetupStep = {
  number: number;
  title: string;
  state: SetupState;
  detail: string;
  find: string;
  field: string;
  icon: typeof Bot;
};

const guidanceToneClass = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-green-200 bg-green-50 text-green-800",
} as const;

const stepToneClass = {
  done: "border-green-200 bg-green-50 text-green-800",
  current: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  blocked: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const stepLabel = {
  done: "Done",
  current: "Next",
  warning: "Check",
  blocked: "Waiting",
} as const;

function SetupIcon({ state }: { state: SetupState }) {
  if (state === "done") return <CheckCircle2 className="size-4" />;
  if (state === "warning") return <TriangleAlert className="size-4" />;
  if (state === "current") return <CircleAlert className="size-4" />;
  return <Clock3 className="size-4" />;
}

function SetupStepRow({ step }: { step: SetupStep }) {
  const Icon = step.icon;

  return (
    <li className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:w-48 sm:shrink-0">
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border",
              stepToneClass[step.state],
            )}
          >
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-muted">Step {step.number}</p>
            <p className="text-sm font-semibold">{step.title}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold",
                stepToneClass[step.state],
              )}
            >
              <SetupIcon state={step.state} />
              {stepLabel[step.state]}
            </span>
            <span className="mono rounded-[8px] bg-[var(--panel-muted)] px-2 py-1 text-xs text-foreground">
              {step.field}
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground">{step.detail}</p>
          <p className="mt-1 text-xs text-muted">Find it: {step.find}</p>
        </div>
      </div>
    </li>
  );
}

function StatusTile({
  label,
  value,
  detail,
  good,
}: {
  label: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-white px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={cn("mt-0.5 size-2 rounded-full", good ? "bg-green-600" : "bg-amber-500")} />
      </div>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

interface StepParams {
  botConfigured: boolean;
  botVerified: boolean;
  chatVerified: boolean;
  deliveryInfrastructureReady: boolean;
  readyForReminders: boolean;
  status: TelegramStatus | null;
  trimmedBotToken: boolean;
  trimmedChatId: boolean;
  missingDeliveryEnv: string[];
}

function getStep1Info(
  botConfigured: boolean,
  botVerified: boolean,
  status: TelegramStatus | null,
  trimmedBotToken: boolean
): { state: SetupState; detail: string } {
  let state: SetupState = "current";
  if (botConfigured) {
    if (status && !botVerified) {
      state = "warning";
    } else if (botVerified) {
      state = "done";
    }
  }

  let detail = "Paste this user's bot token below. It will be encrypted before it is saved.";
  if (botConfigured) {
    if (botVerified) {
      const botUsernamePart = status?.botUsername ? ` (${status.botUsername})` : "";
      detail = `${status?.botDisplayName ?? "Telegram bot"}${botUsernamePart} is reachable.`;
    } else if (trimmedBotToken) {
      detail = "A new token is entered. Save Telegram, then run Check status.";
    } else {
      detail = "A bot token is saved. Run Check status to verify it.";
    }
  }

  return { state, detail };
}

function getStep2Info(
  botConfigured: boolean,
  chatVerified: boolean,
  status: TelegramStatus | null,
  trimmedChatId: boolean
): { state: SetupState; detail: string } {
  let state: SetupState = "blocked";
  if (botConfigured) {
    if (chatVerified) {
      state = "done";
    } else if (status?.chatReachable === false) {
      state = "warning";
    } else if (trimmedChatId) {
      state = "current";
    }
  }

  let detail = "Message the bot first, then paste the chat.id where reminders should land.";
  if (chatVerified) {
    detail = `${status?.chatDisplayName ?? "Saved chat"} can receive bot messages.`;
  } else if (trimmedChatId) {
    detail = "A Chat ID is filled in. Save, then Check status to confirm the bot can see it.";
  }

  return { state, detail };
}

function getStep3Info(
  deliveryInfrastructureReady: boolean,
  botConfigured: boolean,
  missingDeliveryEnv: string[]
): { state: SetupState; detail: string } {
  let state: SetupState = "blocked";
  if (deliveryInfrastructureReady) {
    state = "done";
  } else if (botConfigured) {
    state = "current";
  }

  const detail = deliveryInfrastructureReady
    ? "QStash and the public app URL are configured for scheduled reminders."
    : `Missing ${missingDeliveryEnv.join(", ") || "delivery settings"} in the server environment.`;

  return { state, detail };
}

function getStep4Info(
  readyForReminders: boolean,
  status: TelegramStatus | null
): { state: SetupState; detail: string } {
  let state: SetupState = "blocked";
  if (readyForReminders) {
    state = "done";
  } else if (status) {
    state = "current";
  }

  const detail = readyForReminders
    ? "Telegram reminders are ready for this user."
    : "Save the bot token and chat, keep reminders enabled, then run Check status.";

  return { state, detail };
}

function getSetupSteps({
  botConfigured,
  botVerified,
  chatVerified,
  deliveryInfrastructureReady,
  readyForReminders,
  status,
  trimmedBotToken,
  trimmedChatId,
  missingDeliveryEnv,
}: StepParams): SetupStep[] {
  const step1 = getStep1Info(botConfigured, botVerified, status, trimmedBotToken);
  const step2 = getStep2Info(botConfigured, chatVerified, status, trimmedChatId);
  const step3 = getStep3Info(deliveryInfrastructureReady, botConfigured, missingDeliveryEnv);
  const step4 = getStep4Info(readyForReminders, status);

  return [
    {
      number: 1,
      title: "Bot token",
      state: step1.state,
      detail: step1.detail,
      find: "Telegram -> @BotFather -> /newbot or /token",
      field: "Bot token",
      icon: Bot,
    },
    {
      number: 2,
      title: "Chat target",
      state: step2.state,
      detail: step2.detail,
      find: "Send /start to the bot, then call getUpdates and use result.message.chat.id",
      field: "Chat ID",
      icon: MessageCircle,
    },
    {
      number: 3,
      title: "Delivery queue",
      state: step3.state,
      detail: step3.detail,
      find: "Vercel Environment Variables and Upstash Console -> QStash -> Tokens",
      field: "NEXT_PUBLIC_APP_URL + QSTASH_*",
      icon: Settings2,
    },
    {
      number: 4,
      title: "Verify",
      state: step4.state,
      detail: step4.detail,
      find: "Use the Save Telegram and Check status buttons on this card",
      field: "Save + Check status",
      icon: ShieldCheck,
    },
  ];
}

interface SetupHeaderSectionProps {
  readyForReminders: boolean;
  completedSteps: number;
  botConfigured: boolean;
  checkStatus: () => void;
  isCheckingStatus: boolean;
  guidance: { tone: "danger" | "warning" | "success"; title: string; description: string };
  nextStepTitle: string | undefined;
  statusError: string | null;
  botTokenStorageReady: boolean;
}

function SetupHeaderSection({
  readyForReminders,
  completedSteps,
  botConfigured,
  checkStatus,
  isCheckingStatus,
  guidance,
  nextStepTitle,
  statusError,
  botTokenStorageReady,
}: Readonly<SetupHeaderSectionProps>) {
  return (
    <div className="border-b border-border px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="section-label">Telegram setup</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Bot reminders</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Follow the steps in order. The next missing item stays at the top so setup does not feel like a guessing game.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={readyForReminders ? "success" : botConfigured ? "warning" : "default"}>
            <BellRing className="mr-1 size-3.5" />
            {readyForReminders ? "Ready" : `${completedSteps}/4 ready`}
          </Badge>
          <Button type="button" variant="secondary" size="sm" onClick={checkStatus} disabled={isCheckingStatus}>
            <RefreshCw className={cn("size-4", isCheckingStatus ? "animate-spin" : "")} />
            {isCheckingStatus ? "Checking..." : "Check status"}
          </Button>
        </div>
      </div>

      <div className={cn("mt-5 rounded-[12px] border px-4 py-4", guidanceToneClass[guidance.tone])}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">{guidance.title}</p>
            <p className="mt-1 text-sm opacity-90">{guidance.description}</p>
          </div>
          <div className="rounded-[10px] bg-white/65 px-3 py-2 text-sm font-semibold">
            Next: {nextStepTitle}
          </div>
        </div>
      </div>

      {statusError && (
        <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statusError}
        </div>
      )}

      {!botTokenStorageReady && (
        <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Database schema is missing <span className="mono">telegram_integrations.bot_token_encrypted</span>. Run
          the latest Supabase schema SQL before saving Telegram settings.
        </div>
      )}
    </div>
  );
}

function getBotApiVal(botConfigured: boolean, status: TelegramStatus | null): string {
  if (!botConfigured) return "Missing token";
  if (status) return status.botReachable ? "Reachable" : "Unavailable";
  return "Not checked";
}

function getBotApiDetail(status: TelegramStatus | null, trimmedBotToken: boolean): string {
  if (status?.botDisplayName) {
    const botUsernamePart = status.botUsername ? ` (${status.botUsername})` : "";
    return `${status.botDisplayName}${botUsernamePart}`;
  }
  if (status?.botError) {
    return status.botError;
  }
  if (trimmedBotToken) {
    return "Save the entered token before checking status.";
  }
  return "Use Check status after saving or replacing the bot token.";
}

function getChatVal(status: TelegramStatus | null, trimmedChatId: boolean): string {
  if (status) {
    if (status.chatConfigured) {
      return status.chatReachable ? "Reachable" : "Needs check";
    }
    return "Missing Chat ID";
  }
  return trimmedChatId ? "Filled in" : "Not configured";
}

interface StatusTileSectionProps {
  botConfigured: boolean;
  status: TelegramStatus | null;
  botVerified: boolean;
  trimmedBotToken: boolean;
  trimmedChatId: boolean;
  chatVerified: boolean;
  deliveryInfrastructureReady: boolean;
  missingDeliveryEnv: string[];
}

function StatusTileSection({
  botConfigured,
  status,
  botVerified,
  trimmedBotToken,
  trimmedChatId,
  chatVerified,
  deliveryInfrastructureReady,
  missingDeliveryEnv,
}: Readonly<StatusTileSectionProps>) {
  const botApiVal = getBotApiVal(botConfigured, status);
  const botApiDetail = getBotApiDetail(status, trimmedBotToken);
  const chatVal = getChatVal(status, trimmedChatId);

  return (
    <div className="px-5 py-5 md:px-6">
      <div className="grid gap-3">
        <StatusTile
          label="Bot API"
          value={botApiVal}
          detail={botApiDetail}
          good={botVerified}
        />
        <StatusTile
          label="Chat target"
          value={chatVal}
          detail={status?.chatDisplayName ?? status?.chatError ?? "Personal IDs are numeric. Group IDs often start with -100."}
          good={chatVerified}
        />
        <StatusTile
          label="Delivery queue"
          value={deliveryInfrastructureReady ? "Ready" : "Needs env"}
          detail={missingDeliveryEnv.join(", ") || "No missing delivery env detected."}
          good={deliveryInfrastructureReady}
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-border bg-[var(--panel-muted)] px-4 py-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="text-sm text-muted">
            <p className="font-medium text-foreground">Quick way to get Chat ID</p>
            <p className="mt-1">Send a message to the bot, then open this with the same token you saved:</p>
            <p className="mono mt-2 break-all rounded-[8px] bg-white px-2 py-2 text-xs text-foreground">
              https://api.telegram.org/bot&lt;BOT_TOKEN&gt;/getUpdates
            </p>
            <p className="mt-2">Use the value at result.message.chat.id.</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--panel-muted)]"
        >
          <ExternalLink className="size-3.5" />
          Open BotFather
        </a>
        <a
          href="https://console.upstash.com/qstash"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--panel-muted)]"
        >
          <ExternalLink className="size-3.5" />
          Open QStash
        </a>
      </div>
    </div>
  );
}

interface EffectiveStatusParams {
  status: TelegramStatus | null;
  botConfigured: boolean;
  appUrlConfigured: boolean;
  qstashConfigured: boolean;
  qstashSigningConfigured: boolean;
  deliveryInfrastructureReady: boolean;
  integrationSaved: boolean;
  remindersEnabled: boolean;
  trimmedChatId: boolean;
}

function getEffectiveStatus({
  status,
  botConfigured,
  appUrlConfigured,
  qstashConfigured,
  qstashSigningConfigured,
  deliveryInfrastructureReady,
  integrationSaved,
  remindersEnabled,
  trimmedChatId,
}: Readonly<EffectiveStatusParams>): TelegramStatus {
  if (status) return status;
  return {
    botConfigured,
    botReachable: false,
    botDisplayName: null,
    botUsername: null,
    appUrlConfigured,
    qstashConfigured,
    qstashSigningConfigured,
    deliveryInfrastructureReady,
    integrationSaved,
    remindersEnabled,
    chatConfigured: trimmedChatId,
    chatReachable: null,
    chatDisplayName: null,
    botError: null,
    chatError: null,
    checkedAt: null,
  };
}

function getGuidance(status: TelegramStatus | null, botConfigured: boolean, effectiveStatus: TelegramStatus) {
  if (status || !botConfigured) {
    return buildTelegramStatusGuidance(effectiveStatus);
  }
  return {
    tone: "warning" as const,
    title: "Check the Telegram setup",
    description:
      "A bot token is saved for this user, but the app has not verified it from this deployment yet.",
    steps: [],
  };
}

function getMissingDeliveryEnv(
  appUrlConfigured: boolean,
  qstashConfigured: boolean,
  qstashSigningConfigured: boolean
): string[] {
  const list: string[] = [];
  if (!appUrlConfigured) list.push("NEXT_PUBLIC_APP_URL");
  if (!qstashConfigured) list.push("QSTASH_TOKEN");
  if (!qstashSigningConfigured) list.push("QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY");
  return list;
}

interface DestinationFormProps {
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  botToken: string;
  setBotToken: (val: string) => void;
  botTokenSaved: boolean;
  chatId: string;
  setChatId: (val: string) => void;
  telegramUsername: string;
  setTelegramUsername: (val: string) => void;
  isEnabled: boolean;
  setIsEnabled: (val: boolean) => void;
  error: string | null;
  message: string | null;
  status: TelegramStatus | null;
  integration: {
    chatId: string;
    telegramUsername: string | null;
    isEnabled: boolean;
  } | null;
  handleDisconnect: () => void;
  isPending: boolean;
}

function DestinationForm({
  handleSubmit,
  botToken,
  setBotToken,
  botTokenSaved,
  chatId,
  setChatId,
  telegramUsername,
  setTelegramUsername,
  isEnabled,
  setIsEnabled,
  error,
  message,
  status,
  integration,
  handleDisconnect,
  isPending,
}: Readonly<DestinationFormProps>) {
  return (
    <form className="border-t border-border px-5 py-5 md:px-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <Send className="size-4 text-accent" />
        <p className="text-sm font-semibold">Save this user&apos;s Telegram destination</p>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium">Bot token</label>
        <Input
          type="password"
          value={botToken}
          onChange={(event) => setBotToken(event.target.value)}
          placeholder={botTokenSaved ? "Saved. Leave blank to keep current token." : "Paste token from BotFather"}
          autoComplete="off"
        />
        <p className="mt-2 text-xs text-muted">
          {botTokenSaved
            ? "Stored encrypted in the database. Fill this only when replacing the user's bot token."
            : "Required for first setup. Each user can save their own bot token."}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">Chat ID</label>
          <Input
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="Example: 123456789 or -1001234567890"
          />
          <p className="mt-2 text-xs text-muted">
            Required. This is where reminders will be sent.
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Telegram username</label>
          <Input
            value={telegramUsername}
            onChange={(event) => setTelegramUsername(event.target.value)}
            placeholder="@yourname"
          />
          <p className="mt-2 text-xs text-muted">Optional label for humans reading the settings.</p>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-[12px] border border-border bg-[var(--panel-muted)] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
          className="size-4 rounded border-border"
        />
        Enable Telegram reminders for this user
      </label>

      {error && (
        <p className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p className="mt-4 rounded-[12px] border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Last check: {status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : "not checked yet"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {integration ? (
            <Button type="button" variant="secondary" onClick={handleDisconnect} disabled={isPending}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}
          <Button type="submit" disabled={isPending}>
            <KeyRound className="size-4" />
            {isPending ? "Saving..." : "Save Telegram"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function TelegramSettingsCard({
  integration,
  botTokenSaved,
  botTokenStorageReady,
  appUrlConfigured,
  qstashConfigured,
  qstashSigningConfigured,
}: TelegramSettingsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState(integration?.chatId ?? "");
  const [telegramUsername, setTelegramUsername] = useState(integration?.telegramUsername ?? "");
  const [isEnabled, setIsEnabled] = useState(integration?.isEnabled ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const trimmedBotToken = botToken.trim();
  const trimmedChatId = chatId.trim();
  const botConfigured = botTokenSaved || Boolean(trimmedBotToken);
  const deliveryInfrastructureReady =
    botConfigured && appUrlConfigured && qstashConfigured && qstashSigningConfigured;

  const effectiveStatus = getEffectiveStatus({
    status,
    botConfigured,
    appUrlConfigured,
    qstashConfigured,
    qstashSigningConfigured,
    deliveryInfrastructureReady,
    integrationSaved: Boolean(integration),
    remindersEnabled: isEnabled,
    trimmedChatId: Boolean(trimmedChatId),
  });

  const guidance = getGuidance(status, botConfigured, effectiveStatus);
  const botVerified = status?.botReachable === true;
  const chatVerified = status?.chatReachable === true;
  const readyForReminders = botVerified && chatVerified && isEnabled && deliveryInfrastructureReady;
  const missingDeliveryEnv = getMissingDeliveryEnv(
    appUrlConfigured,
    qstashConfigured,
    qstashSigningConfigured
  );

  const setupSteps = getSetupSteps({
    botConfigured,
    botVerified,
    chatVerified,
    deliveryInfrastructureReady,
    readyForReminders,
    status,
    trimmedBotToken: Boolean(trimmedBotToken),
    trimmedChatId: Boolean(trimmedChatId),
    missingDeliveryEnv,
  });

  const completedSteps = setupSteps.filter((step) => step.state === "done").length;
  const nextStep = setupSteps.find((step) => step.state !== "done") ?? setupSteps[setupSteps.length - 1];

  async function checkStatus() {
    setStatusError(null);
    setIsCheckingStatus(true);

    try {
      const response = await fetch("/api/integrations/telegram", {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result?.data?.status) {
        setStatusError(result?.error?.message ?? "Could not check Telegram status.");
        return;
      }

      setStatus(result.data.status as TelegramStatus);
    } catch {
      setStatusError("Could not check Telegram status.");
    } finally {
      setIsCheckingStatus(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/integrations/telegram", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          botToken: trimmedBotToken || undefined,
          chatId,
          telegramUsername,
          isEnabled,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error?.message ?? "Could not save Telegram settings.");
        return;
      }

      setBotToken("");
      setMessage("Telegram settings saved.");
      await checkStatus();
      router.refresh();
    });
  }

  function handleDisconnect() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/integrations/telegram", {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error?.message ?? "Could not remove Telegram settings.");
        return;
      }

      setChatId("");
      setBotToken("");
      setTelegramUsername("");
      setIsEnabled(true);
      setStatus(null);
      setMessage("Telegram settings removed.");
      await checkStatus();
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <SetupHeaderSection
        readyForReminders={readyForReminders}
        completedSteps={completedSteps}
        botConfigured={botConfigured}
        checkStatus={checkStatus}
        isCheckingStatus={isCheckingStatus}
        guidance={guidance}
        nextStepTitle={nextStep?.title}
        statusError={statusError}
        botTokenStorageReady={botTokenStorageReady}
      />

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="border-b border-border xl:border-r xl:border-b-0">
          <div className="border-b border-border px-5 py-4 md:px-6">
            <p className="text-sm font-semibold">Setup checklist</p>
            <p className="mt-1 text-xs text-muted">Each row shows what to find and where to put it.</p>
          </div>
          <ol>
            {setupSteps.map((step) => (
              <SetupStepRow key={step.number} step={step} />
            ))}
          </ol>
        </div>

        <StatusTileSection
          botConfigured={botConfigured}
          status={status}
          botVerified={botVerified}
          trimmedBotToken={Boolean(trimmedBotToken)}
          trimmedChatId={Boolean(trimmedChatId)}
          chatVerified={chatVerified}
          deliveryInfrastructureReady={deliveryInfrastructureReady}
          missingDeliveryEnv={missingDeliveryEnv}
        />
      </div>

      <DestinationForm
        handleSubmit={handleSubmit}
        botToken={botToken}
        setBotToken={setBotToken}
        botTokenSaved={botTokenSaved}
        chatId={chatId}
        setChatId={setChatId}
        telegramUsername={telegramUsername}
        setTelegramUsername={setTelegramUsername}
        isEnabled={isEnabled}
        setIsEnabled={setIsEnabled}
        error={error}
        message={message}
        status={status}
        integration={integration}
        handleDisconnect={handleDisconnect}
        isPending={isPending}
      />
    </Card>
  );
}
