create extension if not exists postgis;

alter table perfiles
  add column if not exists esta_conectado boolean not null default false,
  add column if not exists ubicacion_actual geometry (Point, 4326);

create index if not exists idx_perfiles_ubicacion on perfiles using gist (ubicacion_actual);