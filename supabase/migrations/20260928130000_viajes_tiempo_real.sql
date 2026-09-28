create table if not exists public.solicitudes_viaje (
  id uuid primary key default gen_random_uuid(),
  pasajero_id uuid not null,
  origen_lat double precision not null,
  origen_lng double precision not null,
  destino_lat double precision not null,
  destino_lng double precision not null,
  precio_inicial numeric(10, 2) not null,
  estado text not null default 'buscando' check (
    estado in (
      'buscando',
      'aceptado',
      'en_ruta_al_pasajero',
      'en_viaje',
      'finalizada',
      'cancelada'
    )
  ),
  conductor_id uuid,
  precio_final numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_solicitudes_viaje_estado on public.solicitudes_viaje (estado);
create index if not exists idx_solicitudes_viaje_pasajero on public.solicitudes_viaje (pasajero_id);

create table if not exists public.ofertas_conductores (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_viaje (id) on delete cascade,
  conductor_id uuid not null,
  precio numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ofertas_conductores_solicitud on public.ofertas_conductores (solicitud_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.solicitudes_viaje, public.ofertas_conductores;
  end if;
exception
  when duplicate_object then null;
end $$;