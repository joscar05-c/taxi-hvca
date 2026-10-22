-- Migración de alineación integral del esquema y políticas RLS para taxi-hvca
-- Sincroniza la base de datos Supabase con la arquitectura InDrive de la app.

-- 1. Ampliar y alinear tabla public.perfiles
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible', 'en_viaje', 'offline')),
  ADD COLUMN IF NOT EXISTS calificacion_promedio numeric(3, 2) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Corregir y asegurar trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, telefono, nombre)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'rol', 'pasajero'),
    COALESCE(new.phone, new.raw_user_meta_data->>'telefono'),
    new.raw_user_meta_data->>'nombre'
  )
  ON CONFLICT (id) DO UPDATE SET
    rol = COALESCE(EXCLUDED.rol, perfiles.rol),
    nombre = COALESCE(EXCLUDED.nombre, perfiles.nombre),
    telefono = COALESCE(EXCLUDED.telefono, perfiles.telefono);
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 3. Ampliar y alinear tabla public.solicitudes_viaje
ALTER TABLE public.solicitudes_viaje
  ADD COLUMN IF NOT EXISTS origen_lat double precision,
  ADD COLUMN IF NOT EXISTS origen_lng double precision,
  ADD COLUMN IF NOT EXISTS destino_lat double precision,
  ADD COLUMN IF NOT EXISTS destino_lng double precision,
  ADD COLUMN IF NOT EXISTS precio_inicial numeric(10, 2),
  ADD COLUMN IF NOT EXISTS precio_final numeric(10, 2),
  ADD COLUMN IF NOT EXISTS conductor_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.sync_solicitudes_viaje_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NEW.precio_inicial IS NOT NULL AND NEW.precio_ofrecido IS NULL THEN
    NEW.precio_ofrecido := NEW.precio_inicial;
  ELSIF NEW.precio_ofrecido IS NOT NULL AND NEW.precio_inicial IS NULL THEN
    NEW.precio_inicial := NEW.precio_ofrecido;
  END IF;

  IF NEW.conductor_id IS NOT NULL AND NEW.conductor_asignado_id IS NULL THEN
    NEW.conductor_asignado_id := NEW.conductor_id;
  ELSIF NEW.conductor_asignado_id IS NOT NULL AND NEW.conductor_id IS NULL THEN
    NEW.conductor_id := NEW.conductor_asignado_id;
  END IF;

  IF NEW.created_at IS NOT NULL AND NEW.creado_en IS NULL THEN
    NEW.creado_en := NEW.created_at;
  ELSIF NEW.creado_en IS NOT NULL AND NEW.created_at IS NULL THEN
    NEW.created_at := NEW.creado_en;
  END IF;

  IF NEW.origen_lat IS NOT NULL AND NEW.origen_lng IS NOT NULL THEN
    NEW.origen_geom := extensions.st_setsrid(extensions.st_makepoint(NEW.origen_lng, NEW.origen_lat), 4326)::extensions.geography;
  END IF;

  IF NEW.destino_lat IS NOT NULL AND NEW.destino_lng IS NOT NULL THEN
    NEW.destino_geom := extensions.st_setsrid(extensions.st_makepoint(NEW.destino_lng, NEW.destino_lat), 4326)::extensions.geography;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_solicitudes_viaje_cols() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_sync_solicitudes_viaje
  BEFORE INSERT OR UPDATE ON public.solicitudes_viaje
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_solicitudes_viaje_cols();

-- 4. Ampliar y alinear tabla public.ofertas_conductores
ALTER TABLE public.ofertas_conductores
  ADD COLUMN IF NOT EXISTS precio numeric(10, 2),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.sync_ofertas_conductores_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.precio IS NOT NULL AND NEW.precio_propuesto IS NULL THEN
    NEW.precio_propuesto := NEW.precio;
  ELSIF NEW.precio_propuesto IS NOT NULL AND NEW.precio IS NULL THEN
    NEW.precio := NEW.precio_propuesto;
  END IF;

  IF NEW.created_at IS NOT NULL AND NEW.creado_en IS NULL THEN
    NEW.creado_en := NEW.created_at;
  ELSIF NEW.creado_en IS NOT NULL AND NEW.created_at IS NULL THEN
    NEW.created_at := NEW.creado_en;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_ofertas_conductores_cols() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_sync_ofertas_conductores
  BEFORE INSERT OR UPDATE ON public.ofertas_conductores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ofertas_conductores_cols();

-- 5. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitudes_viaje_conductor ON public.solicitudes_viaje (conductor_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_viaje_conductor_asig ON public.solicitudes_viaje (conductor_asignado_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_conductores_conductor ON public.ofertas_conductores (conductor_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_conductores_solicitud ON public.ofertas_conductores (solicitud_id);

-- 6. Políticas RLS
ALTER POLICY "Ver propio perfil" ON public.perfiles TO authenticated USING (true);
ALTER POLICY "Actualizar propio perfil" ON public.perfiles TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perfiles' AND policyname = 'Insertar propio perfil'
  ) THEN
    CREATE POLICY "Insertar propio perfil" ON public.perfiles FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
  END IF;
END $$;

ALTER POLICY "Conductores ven viajes disponibles" ON public.solicitudes_viaje
  TO authenticated
  USING (
    estado = 'buscando'
    OR conductor_id = (SELECT auth.uid())
    OR conductor_asignado_id = (SELECT auth.uid())
    OR pasajero_id = (SELECT auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'solicitudes_viaje' AND policyname = 'Conductores actualizan viajes asignados'
  ) THEN
    CREATE POLICY "Conductores actualizan viajes asignados" ON public.solicitudes_viaje
      FOR UPDATE TO authenticated
      USING (conductor_id = (SELECT auth.uid()) OR conductor_asignado_id = (SELECT auth.uid()) OR estado = 'buscando');
  END IF;
END $$;

ALTER TABLE public.ofertas_conductores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ofertas_conductores' AND policyname = 'Lectura de ofertas'
  ) THEN
    CREATE POLICY "Lectura de ofertas" ON public.ofertas_conductores
      FOR SELECT TO authenticated
      USING (
        conductor_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.solicitudes_viaje sv
          WHERE sv.id = ofertas_conductores.solicitud_id
            AND sv.pasajero_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ofertas_conductores' AND policyname = 'Conductores crean ofertas'
  ) THEN
    CREATE POLICY "Conductores crean ofertas" ON public.ofertas_conductores
      FOR INSERT TO authenticated
      WITH CHECK (conductor_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ofertas_conductores' AND policyname = 'Conductores actualizan ofertas'
  ) THEN
    CREATE POLICY "Conductores actualizan ofertas" ON public.ofertas_conductores
      FOR UPDATE TO authenticated
      USING (conductor_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ofertas_conductores' AND policyname = 'Eliminar ofertas'
  ) THEN
    CREATE POLICY "Eliminar ofertas" ON public.ofertas_conductores
      FOR DELETE TO authenticated
      USING (
        conductor_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.solicitudes_viaje sv
          WHERE sv.id = ofertas_conductores.solicitud_id
            AND sv.pasajero_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- 7. Realtime y Replica Identity
ALTER TABLE public.perfiles REPLICA IDENTITY FULL;
ALTER TABLE public.solicitudes_viaje REPLICA IDENTITY FULL;
ALTER TABLE public.ofertas_conductores REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.perfiles;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
