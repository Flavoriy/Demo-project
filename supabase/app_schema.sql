create extension if not exists pgcrypto;

do $$
declare
  v_schema constant text := 'public';
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'TaskStatus'
  ) then
    create type public."TaskStatus" as enum ('TODO', 'IN_PROGRESS', 'DONE');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'TaskPriority'
  ) then
    create type public."TaskPriority" as enum ('LOW', 'MEDIUM', 'HIGH');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'SyncStatus'
  ) then
    create type public."SyncStatus" as enum ('LOCAL_ONLY', 'PENDING_CREATE', 'PENDING_UPDATE', 'PENDING_DELETE', 'SYNCED', 'FAILED'); -- NOSONAR
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'SyncDirection'
  ) then
    create type public."SyncDirection" as enum ('APP_TO_GOOGLE', 'GOOGLE_TO_APP');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'ImportState'
  ) then
    create type public."ImportState" as enum ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'); -- NOSONAR
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'ReminderTargetType'
  ) then
    create type public."ReminderTargetType" as enum ('TASK', 'EVENT');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'ReminderChannel'
  ) then
    create type public."ReminderChannel" as enum ('TELEGRAM');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = v_schema and t.typname = 'ReminderStatus'
  ) then
    create type public."ReminderStatus" as enum ('SCHEDULED', 'SENT', 'FAILED', 'CANCELED'); -- NOSONAR
  end if;
end
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists default_task_reminder_offsets_minutes integer[] not null default '{}',
      add column if not exists default_event_reminder_offsets_minutes integer[] not null default '{}';
  end if;
end
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  status public."TaskStatus" not null,
  priority public."TaskPriority" not null,
  due_date varchar(10),
  due_time varchar(5),
  due_at_utc timestamptz(6),
  completed_at timestamptz(6),
  google_task_id text,
  google_tasklist_id text,
  google_etag text,
  google_updated_at timestamptz(6),
  sync_status public."SyncStatus" not null default 'LOCAL_ONLY', -- NOSONAR
  last_sync_direction public."SyncDirection",
  last_synced_at timestamptz(6),
  sync_error text,
  deleted_at timestamptz(6),
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null
);

alter table public.tasks
  add column if not exists google_task_id text,
  add column if not exists google_tasklist_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz(6),
  add column if not exists sync_status public."SyncStatus" not null default 'LOCAL_ONLY', -- NOSONAR
  add column if not exists last_sync_direction public."SyncDirection",
  add column if not exists last_synced_at timestamptz(6),
  add column if not exists sync_error text,
  add column if not exists deleted_at timestamptz(6);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  color text,
  is_all_day boolean not null default false,
  start_at_utc timestamptz(6),
  end_at_utc timestamptz(6),
  start_date varchar(10),
  end_date varchar(10),
  google_event_id text,
  google_calendar_id text,
  google_etag text,
  google_updated_at timestamptz(6),
  sync_status public."SyncStatus" not null default 'LOCAL_ONLY', -- NOSONAR
  last_sync_direction public."SyncDirection",
  last_synced_at timestamptz(6),
  sync_error text,
  deleted_at timestamptz(6),
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null
);

alter table public.events
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz(6),
  add column if not exists sync_status public."SyncStatus" not null default 'LOCAL_ONLY', -- NOSONAR
  add column if not exists last_sync_direction public."SyncDirection",
  add column if not exists last_synced_at timestamptz(6),
  add column if not exists sync_error text,
  add column if not exists deleted_at timestamptz(6);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  target_type public."ReminderTargetType" not null,
  target_id uuid not null,
  offset_minutes integer not null,
  remind_at_utc timestamptz(6) not null,
  channel public."ReminderChannel" not null,
  status public."ReminderStatus" not null default 'SCHEDULED', -- NOSONAR
  external_job_id text,
  delivery_attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz(6),
  canceled_at timestamptz(6),
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null
);

alter table public.reminders
  add column if not exists external_job_id text,
  add column if not exists delivery_attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists sent_at timestamptz(6),
  add column if not exists canceled_at timestamptz(6);

create table if not exists public.google_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  google_account_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz(6) not null,
  calendar_enabled boolean not null default false,
  tasks_enabled boolean not null default false,
  calendar_id text default 'primary',
  default_tasklist_id text default '@default',
  calendar_import_state public."ImportState" not null default 'NOT_STARTED', -- NOSONAR
  tasks_import_state public."ImportState" not null default 'NOT_STARTED', -- NOSONAR
  calendar_import_summary jsonb,
  tasks_import_summary jsonb,
  calendar_sync_token text,
  calendar_watch_channel_id text,
  calendar_watch_resource_id text,
  calendar_watch_expire_at timestamptz(6),
  last_calendar_sync_at timestamptz(6),
  last_tasks_sync_at timestamptz(6),
  last_error text,
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null
);

create table if not exists public.telegram_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bot_token_encrypted text,
  chat_id text not null,
  telegram_username text,
  is_enabled boolean not null default true,
  connected_at timestamptz(6) not null default now(),
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null
);

alter table public.telegram_integrations
  add column if not exists bot_token_encrypted text;

create table if not exists public.telegram_connection_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  expires_at timestamptz(6) not null,
  used_at timestamptz(6),
  created_at timestamptz(6) not null default now()
);

create index if not exists tasks_user_id_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_id_due_date_idx on public.tasks (user_id, due_date);
create index if not exists tasks_google_task_id_idx on public.tasks (google_task_id);

create index if not exists events_user_id_start_date_idx on public.events (user_id, start_date);
create index if not exists events_user_id_start_at_utc_idx on public.events (user_id, start_at_utc);
create index if not exists events_google_event_id_idx on public.events (google_event_id);

create index if not exists reminders_user_id_target_type_target_id_idx on public.reminders (user_id, target_type, target_id);

create unique index if not exists google_integrations_user_id_key on public.google_integrations (user_id);
create unique index if not exists telegram_integrations_user_id_key on public.telegram_integrations (user_id);
create unique index if not exists telegram_connection_codes_code_key on public.telegram_connection_codes (code);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_user_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_user_id_fkey'
  ) then
    alter table public.events
      add constraint events_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reminders_user_id_fkey'
  ) then
    alter table public.reminders
      add constraint reminders_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'google_integrations_user_id_fkey'
  ) then
    alter table public.google_integrations
      add constraint google_integrations_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'telegram_integrations_user_id_fkey'
  ) then
    alter table public.telegram_integrations
      add constraint telegram_integrations_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'telegram_connection_codes_user_id_fkey'
  ) then
    alter table public.telegram_connection_codes
      add constraint telegram_connection_codes_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade on update cascade;
  end if;
end
$$;
