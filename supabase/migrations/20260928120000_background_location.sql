create extension if not exists postgis;

alter table profiles
  add column if not exists esta_conectado boolean not null default false,
  add column if not exists ubicacion_actual geometry (Point, 4326);

create index if not exists idx_profiles_ubicacion on profiles using gist (ubicacion_actual);