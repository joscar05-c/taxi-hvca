alter table public.solicitudes_viaje
  drop constraint if exists solicitudes_viaje_estado_check;

alter table public.solicitudes_viaje
  add constraint solicitudes_viaje_estado_check check (
    estado in (
      'buscando',
      'aceptado',
      'en_camino_origen',
      'en_curso',
      'completado',
      'cancelada'
    )
  );