-- Platform Foundation — core schema (illustrative)
--
-- Multi-tenant, shared-schema, row-level security. Client-shaped record payloads
-- live in JSONB inside a fixed relational skeleton (architecture note, Q4 & Q6).
-- Every application connection first runs:  SET app.tenant_id = '<uuid>';
-- set from the authenticated session, never from client input (Q4).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table users (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  email        citext not null,
  external_id  text,                    -- identity from Clerk; auth is not ours to own
  created_at   timestamptz not null default now(),
  unique (tenant_id, email)
);

create table roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id),
  name        text not null,            -- 'operator', 'department_head', 'triage_nurse'
  grants      jsonb not null default '{}'::jsonb,   -- record-type / transition / field-level grants
  unique (tenant_id, name)
);

-- The Part B format, versioned and immutable once published.
create table record_definitions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  record_type   text not null,          -- 'maintenance_report', 'patient_referral'
  version       int  not null,
  status        text not null default 'draft'
                  check (status in ('draft','published','retired')),
  fields        jsonb not null,         -- the fields[] array validateRecord reads
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (tenant_id, record_type, version)
);

-- Submitted records: documents, tagged with the definition version that
-- validated them, so old records keep their original meaning (Q2).
create table records (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id),
  definition_id  uuid not null references record_definitions(id),
  record_type    text not null,
  status         text not null,
  data           jsonb not null,        -- validated against definition_id's fields
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Queue reads are the hottest path (Q5). Indexes are generated from each
-- definition's filterable/sortable fields at publish time. Baseline:
create index records_tenant_type_status on records (tenant_id, record_type, status);
-- Example generated expression index on a client-defined filter field
-- (Client C's queue: by specialty, open referrals only) — created by the
-- publish step, not hand-written per client:
--   create index records_c_specialty on records ((data->>'specialty'))
--     where record_type = 'patient_referral' and status <> 'closed';

create table workflows (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  record_type  text not null,
  statuses     jsonb not null,          -- ordered status list
  unique (tenant_id, record_type)
);

create table transitions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  workflow_id  uuid not null references workflows(id),
  from_status  text not null,
  to_status    text not null,
  role         text not null            -- which role may perform this move
);

create table notification_rules (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  record_type  text not null,
  trigger      jsonb not null,          -- {on:'status_enter',status:'resolved'} | {on:'timeout',after:'4 hours'}
  channel      text not null check (channel in ('email','sms')),
  template_id  uuid,
  recipient    text not null,           -- 'reporter' | 'referring_physician'
  delay        interval                 -- e.g. '14 days' for Client B's second email
);

create table templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  name         text not null,
  channel      text not null,
  body         text not null            -- placeholders resolved from record fields
);

create table views (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  record_type  text not null,
  name         text not null,
  filters      jsonb not null,
  sort         jsonb not null
);

-- Append-only. Every record and config change, with actor (Q7, principle 5).
create table audit_log (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id),
  actor_id     uuid,
  entity       text not null,           -- 'record' | 'record_definition' | 'notification_rule' ...
  entity_id    uuid,
  action       text not null,           -- 'create' | 'update' | 'transition' | 'publish'
  before       jsonb,
  after        jsonb,
  at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security: the tenancy guarantee (Q4).
-- The same policy pattern is applied to EVERY tenant-scoped table above; the
-- records table is shown as the example. A query that forgets a tenant filter
-- returns zero rows, not another tenant's data.
-- ---------------------------------------------------------------------------
alter table records enable row level security;

create policy records_tenant_isolation on records
  using      (tenant_id = current_setting('app.tenant_id')::uuid)
  with check (tenant_id = current_setting('app.tenant_id')::uuid);

-- Repeat for tenants' child tables: users, roles, record_definitions,
-- workflows, transitions, notification_rules, templates, views, audit_log.
