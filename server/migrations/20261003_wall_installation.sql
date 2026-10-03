create table if not exists public.wall_installations (
  id bigint generated always as identity primary key,
  wall_id bigint not null unique,
  wall_name text not null default '',
  site text not null default '',
  panel text not null default '',
  pitch text not null default '',
  size_label text not null default '',
  cabinet_count text not null default '',
  columns text not null default '',
  rows text not null default '',
  controller text not null default '',
  wire_json text not null default '[]',
  steps_json text not null default '[]',
  checklist_json text not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wall_installation_files (
  id bigint generated always as identity primary key,
  install_id bigint not null,
  name text not null default '',
  url text not null default '',
  kind text not null default 'file',
  created_at timestamptz not null default now()
);

create index if not exists wall_installation_files_install_idx on public.wall_installation_files (install_id);

alter table public.wall_installations enable row level security;
alter table public.wall_installation_files enable row level security;
