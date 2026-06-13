"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildEventDateKeys,
  formatEventHeading,
  toHumanAnchorLabel,
  type CalendarView,
} from "@/lib/dates/taskflow-dates";
import { cn } from "@/lib/utils/cn";

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  startAtUtc: string | null;
  endAtUtc: string | null;
  startDate: string | null;
  endDate: string | null;
};

type EventFormState = {
  title: string;
  description: string;
  color: string;
  isAllDay: boolean;
  startLocal: string;
  endLocal: string;
  startDate: string;
  endDate: string;
};

type CalendarBoardProps = {
  events: EventRecord[];
  timezone: string;
  todayKey: string;
  view: CalendarView;
  anchorDate: string;
  previousDate: string;
  nextDate: string;
  range: {
    start: string;
    end: string;
    days: string[];
  };
};

const colors = ["teal", "amber", "rose", "indigo"];
const weekStartHour = 6;
const weekEndHour = 22;
const weekHours = Array.from({ length: weekEndHour - weekStartHour }, (_, index) => weekStartHour + index);
const weekTotalMinutes = (weekEndHour - weekStartHour) * 60;

function toEventLike(event: EventRecord) {
  return {
    deletedAt: null,
    isAllDay: event.isAllDay,
    startDate: event.startDate,
    endDate: event.endDate,
    startAtUtc: event.startAtUtc ? new Date(event.startAtUtc) : null,
    endAtUtc: event.endAtUtc ? new Date(event.endAtUtc) : null,
  };
}

function eventToForm(event: EventRecord, timezone: string): EventFormState {
  if (event.isAllDay) {
    return {
      title: event.title,
      description: event.description ?? "",
      color: event.color ?? "teal",
      isAllDay: true,
      startLocal: "",
      endLocal: "",
      startDate: event.startDate ?? "",
      endDate: event.endDate ?? "",
    };
  }

  return {
    title: event.title,
    description: event.description ?? "",
    color: event.color ?? "teal",
    isAllDay: false,
    startLocal: event.startAtUtc ? formatInTimeZone(event.startAtUtc, timezone, "yyyy-MM-dd'T'HH:mm") : "",
    endLocal: event.endAtUtc ? formatInTimeZone(event.endAtUtc, timezone, "yyyy-MM-dd'T'HH:mm") : "",
    startDate: "",
    endDate: "",
  };
}

function getEmptyEvent(dateKey: string): EventFormState {
  return {
    title: "",
    description: "",
    color: "teal",
    isAllDay: false,
    startLocal: `${dateKey}T09:00`,
    endLocal: `${dateKey}T10:00`,
    startDate: dateKey,
    endDate: dateKey,
  };
}

function toneForColor(color?: string | null) {
  const map: Record<string, string> = {
    teal: "bg-[#ecfeff] text-[#155e75]",
    amber: "bg-[#fef3c7] text-[#92400e]",
    rose: "bg-[#fee2e2] text-[#991b1b]",
    indigo: "bg-[#e0e7ff] text-[#3730a3]",
  };

  return map[color ?? "teal"] ?? map.teal;
}

function formatDayLabel(day: string, view: CalendarView) {
  return view === "day" ? format(parseISO(day), "EEEE") : format(parseISO(day), "EEE");
}

function formatDayNumber(day: string) {
  return format(parseISO(day), "d");
}

function getLocalDateKey(value: string, timezone: string) {
  return formatInTimeZone(value, timezone, "yyyy-MM-dd");
}

function getLocalMinutes(value: string, timezone: string) {
  const [hours, minutes] = formatInTimeZone(value, timezone, "HH:mm").split(":").map(Number);
  return hours * 60 + minutes;
}

function getWeekEventPosition(event: EventRecord, day: string, timezone: string) {
  if (!event.startAtUtc || !event.endAtUtc) {
    return null;
  }

  const visibleStart = weekStartHour * 60;
  const visibleEnd = weekEndHour * 60;
  const startDay = getLocalDateKey(event.startAtUtc, timezone);
  const endDay = getLocalDateKey(event.endAtUtc, timezone);
  const rawStart = startDay < day ? visibleStart : getLocalMinutes(event.startAtUtc, timezone);
  const rawEnd = endDay > day ? visibleEnd : getLocalMinutes(event.endAtUtc, timezone);

  if (rawEnd <= visibleStart) {
    return {
      top: "0%",
      height: "2.5rem",
    };
  }

  if (rawStart >= visibleEnd) {
    return {
      top: `calc(100% - 2.75rem)`,
      height: "2.5rem",
    };
  }

  const start = Math.max(visibleStart, Math.min(visibleEnd, rawStart));
  const end = Math.max(start + 30, Math.min(visibleEnd, rawEnd));
  const top = ((start - visibleStart) / weekTotalMinutes) * 100;
  const height = ((end - start) / weekTotalMinutes) * 100;

  return {
    top: `${top}%`,
    height: `max(2.5rem, ${height}%)`,
  };
}

interface WeekViewProps {
  range: { days: string[] };
  todayKey: string;
  view: CalendarView;
  timezone: string;
  openCreateModal: (day: string) => void;
  openEditModal: (event: EventRecord) => void;
  eventsByDay: Record<string, EventRecord[]>;
}

function WeekView({
  range,
  todayKey,
  view,
  timezone,
  openCreateModal,
  openEditModal,
  eventsByDay,
}: Readonly<WeekViewProps>) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-border bg-white shadow-[0_8px_24px_rgba(25,37,55,0.04)]">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border">
          <div className="bg-[var(--panel-muted)] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Week
          </div>
          {range.days.map((day) => (
            <div
              key={day}
              className={cn(
                "border-l border-border px-3 py-3",
                day === todayKey && "bg-[#eff6ff] text-[#1d4ed8]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {formatDayLabel(day, view)}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{format(parseISO(day), "MMM d")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateModal(day)}
                  className="rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-medium text-muted hover:bg-[var(--panel-muted)]"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border bg-[#fafafa]">
          <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            All day
          </div>
          {range.days.map((day) => {
            const allDayEvents = (eventsByDay[day] ?? []).filter((event) => event.isAllDay);

            return (
              <div key={day} className="min-h-14 border-l border-border px-2 py-2">
                {allDayEvents.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted">-</p>
                ) : (
                  <div className="space-y-1.5">
                    {allDayEvents.map((event) => (
                      <button
                        key={`${day}-${event.id}-all-day`}
                        type="button"
                        onClick={() => openEditModal(event)}
                        className={cn(
                          "block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold",
                          toneForColor(event.color),
                        )}
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="bg-[var(--panel-muted)]">
            {weekHours.map((hour) => (
              <div key={hour} className="h-16 border-b border-border px-2 pt-1 text-right text-[11px] text-muted">
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {range.days.map((day) => {
            const timedEvents = (eventsByDay[day] ?? []).filter((event) => !event.isAllDay);

            return (
              <div
                key={day}
                className={cn(
                  "relative h-[1024px] border-l border-border bg-white",
                  day === todayKey && "bg-[#f8fbff]",
                )}
              >
                {weekHours.map((hour) => (
                  <div key={hour} className="h-16 border-b border-border/70" />
                ))}
                {timedEvents.length === 0 ? (
                  <p className="absolute left-3 top-3 text-xs text-muted">No timed events</p>
                ) : null}
                {timedEvents.map((event) => {
                  const position = getWeekEventPosition(event, day, timezone);

                  if (!position) {
                    return null;
                  }

                  return (
                    <button
                      key={`${day}-${event.id}-timed`}
                      type="button"
                      onClick={() => openEditModal(event)}
                      className={cn(
                        "absolute left-2 right-2 overflow-hidden rounded-xl px-2.5 py-2 text-left text-xs leading-4 shadow-[0_10px_22px_rgba(15,23,42,0.10)] ring-1 ring-white/60",
                        toneForColor(event.color),
                      )}
                      style={position}
                    >
                      <span className="block truncate font-semibold">{event.title}</span>
                      <span className="mt-0.5 block truncate opacity-80">
                        {event.startAtUtc
                          ? formatInTimeZone(event.startAtUtc, timezone, "HH:mm")
                          : "Time TBD"}
                        {event.endAtUtc ? ` - ${formatInTimeZone(event.endAtUtc, timezone, "HH:mm")}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface OtherViewsProps {
  range: { days: string[] };
  todayKey: string;
  view: CalendarView;
  timezone: string;
  openCreateModal: (day: string) => void;
  openEditModal: (event: EventRecord) => void;
  deleteEvent: (id: string) => void;
  eventsByDay: Record<string, EventRecord[]>;
}

function OtherViews({
  range,
  todayKey,
  view,
  timezone,
  openCreateModal,
  openEditModal,
  deleteEvent,
  eventsByDay,
}: Readonly<OtherViewsProps>) {
  return (
    <div className={cn("grid gap-3", view === "month" ? "md:grid-cols-7" : "grid-cols-1")}>
      {range.days.map((day) => (
        <div
          key={day}
          className={cn(
            "surface-panel min-h-44 rounded-[1.35rem] p-3",
            day === todayKey ? "border-[rgba(40,86,216,0.32)] shadow-[0_20px_40px_rgba(40,86,216,0.12)]" : "",
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{formatDayLabel(day, view)}</p>
              <p className="mt-1 text-xl font-semibold">{formatDayNumber(day)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{eventsByDay[day]?.length ?? 0} items</span>
              <button
                type="button"
                onClick={() => openCreateModal(day)}
                className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-medium text-muted"
              >
                Add
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {(eventsByDay[day] ?? []).map((event) => (
              <div
                key={`${day}-${event.id}`}
                className={cn("rounded-xl px-3 py-2.5 text-xs leading-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]", toneForColor(event.color))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{event.title}</p>
                    <p className="mt-1 opacity-80">
                      {event.isAllDay
                        ? "All day"
                        : event.startAtUtc
                          ? formatInTimeZone(event.startAtUtc, timezone, "HH:mm")
                          : "Time TBD"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        openEditModal(event);
                      }}
                      className="rounded-lg bg-white/72 p-1"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        deleteEvent(event.id);
                      }}
                      className="rounded-lg bg-white/72 p-1"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface AgendaListProps {
  events: EventRecord[];
  timezone: string;
  openEditModal: (event: EventRecord) => void;
  deleteEvent: (id: string) => void;
}

function AgendaList({ events, timezone, openEditModal, deleteEvent }: Readonly<AgendaListProps>) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Agenda</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Events in this range</h3>
        </div>
        <p className="text-sm text-muted">{events.length} item{events.length === 1 ? "" : "s"}</p>
      </div>
      {events.length === 0 ? (
        <div className="panel-muted rounded-[1.3rem] border-dashed px-5 py-8 text-center text-sm text-muted">
          No events fall inside this range.
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="rounded-[1.25rem] border border-border bg-white p-4 shadow-[0_8px_24px_rgba(25,37,55,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", toneForColor(event.color))}>
                    {event.color ?? "teal"}
                  </span>
                  <h4 className="text-base font-semibold">{event.title}</h4>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatEventHeading(toEventLike(event), timezone)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEditModal(event)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteEvent(event.id)}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

interface EventFormModalProps {
  isOpen: boolean;
  closeModal: () => void;
  editing: EventRecord | null;
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  error: string | null;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

function EventFormModal({
  isOpen,
  closeModal,
  editing,
  form,
  setForm,
  error,
  isPending,
  handleSubmit,
}: Readonly<EventFormModalProps>) {
  return (
    <Modal open={isOpen} onClose={closeModal} title={editing ? "Edit event" : "Create event"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Title</label>
            <Input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Description</label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Event type</label>
            <Select
              value={form.isAllDay ? "all-day" : "timed"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isAllDay: event.target.value === "all-day",
                }))
              }
            >
              <option value="timed">Timed</option>
              <option value="all-day">All day</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Color</label>
            <Select
              value={form.color}
              onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
            >
              {colors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </Select>
          </div>
          {form.isAllDay ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Start date</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">End date</label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">Start</label>
                <Input
                  type="datetime-local"
                  value={form.startLocal}
                  onChange={(event) => setForm((current) => ({ ...current, startLocal: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">End</label>
                <Input
                  type="datetime-local"
                  value={form.endLocal}
                  onChange={(event) => setForm((current) => ({ ...current, endLocal: event.target.value }))}
                />
              </div>
            </>
          )}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : editing ? "Save changes" : "Create event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CalendarBoard({
  events,
  timezone,
  todayKey,
  view,
  anchorDate,
  previousDate,
  nextDate,
  range,
}: CalendarBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<EventFormState>(getEmptyEvent(anchorDate));
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const eventsByDay = range.days.reduce<Record<string, EventRecord[]>>((accumulator, day) => {
    accumulator[day] = [];
    return accumulator;
  }, {});

  for (const event of events) {
    for (const dateKey of buildEventDateKeys(toEventLike(event), timezone)) {
      if (eventsByDay[dateKey]) {
        eventsByDay[dateKey].push(event);
      }
    }
  }

  function openCreateModal(dateKey = anchorDate) {
    setEditing(null);
    setForm(getEmptyEvent(dateKey));
    setError(null);
    setActionError(null);
    setIsOpen(true);
  }

  function openEditModal(event: EventRecord) {
    setEditing(event);
    setForm(eventToForm(event, timezone));
    setError(null);
    setActionError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditing(null);
    setError(null);
    setActionError(null);
  }

  async function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError(null);
    setActionError(null);

    const payload = {
      title: form.title,
      description: form.description,
      color: form.color,
      isAllDay: form.isAllDay,
      startLocal: form.isAllDay ? undefined : form.startLocal,
      endLocal: form.isAllDay ? undefined : form.endLocal,
      startDate: form.isAllDay ? form.startDate : undefined,
      endDate: form.isAllDay ? form.endDate : undefined,
    };

    startTransition(async () => {
      const response = await fetch(editing ? `/api/events/${editing.id}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? "Could not save event.");
        return;
      }

      closeModal();
      router.refresh();
    });
  }

  function deleteEvent(id: string) {
    startTransition(async () => {
      setActionError(null);
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setActionError(result?.error?.message ?? "Could not delete event.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(242,238,229,0.86))]">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-label">Calendar</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{toHumanAnchorLabel(anchorDate)}</h2>
            <p className="mt-2 text-sm text-muted">Place events, scan the range, and keep the week readable.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => openCreateModal()}>
              <Plus className="size-4" />
              New event
            </Button>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
              <Link className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--panel-muted)]" href={`/calendar?view=${view}&date=${previousDate}`}>
                <ChevronLeft className="size-4" />
              </Link>
              <Link className="rounded-lg px-3 py-2 text-sm hover:bg-[var(--panel-muted)]" href={`/calendar?view=${view}&date=${nextDate}`}>
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
              {(["week", "day", "month"] as const).map((option) => (
                <Link
                  key={option}
                  href={`/calendar?view=${option}&date=${anchorDate}`}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm capitalize",
                    option === view ? "bg-accent text-white" : "text-muted hover:bg-[var(--panel-muted)]",
                  )}
                >
                  {option}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {actionError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}

        {view === "week" ? (
          <WeekView
            range={range}
            todayKey={todayKey}
            view={view}
            timezone={timezone}
            openCreateModal={openCreateModal}
            openEditModal={openEditModal}
            eventsByDay={eventsByDay}
          />
        ) : (
          <OtherViews
            range={range}
            todayKey={todayKey}
            view={view}
            timezone={timezone}
            openCreateModal={openCreateModal}
            openEditModal={openEditModal}
            deleteEvent={deleteEvent}
            eventsByDay={eventsByDay}
          />
        )}

        <AgendaList
          events={events}
          timezone={timezone}
          openEditModal={openEditModal}
          deleteEvent={deleteEvent}
        />
      </Card>

      <EventFormModal
        isOpen={isOpen}
        closeModal={closeModal}
        editing={editing}
        form={form}
        setForm={setForm}
        error={error}
        isPending={isPending}
        handleSubmit={handleSubmit}
      />
    </>
  );
}
