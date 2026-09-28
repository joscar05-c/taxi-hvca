/**
 * Lógica de negocio pura: cálculo de tarifas.
 * No depende de Supabase, React ni React Native — puede testearse en aislamiento.
 */

export interface TarifaInput {
  distanciaKm: number;
  duracionMin: number;
  tarifaBase: number;
  tarifaPorKm: number;
  tarifaPorMin: number;
  /** Multiplicador en horas pico o alta demanda (ej. 1.5 = +50%). */
  multiplicadorDemanda?: number;
  /** Tarifa mínima garantizada (ej. 35 MXN). */
  tarifaMinima?: number;
}

export interface TarifaDesglose {
  base: number;
  porKm: number;
  porMin: number;
  subtotal: number;
  multiplicadorDemanda: number;
  total: number;
}

const redondear = (valor: number): number => Math.round(valor * 100) / 100;

export function calcularTarifa(input: TarifaInput): TarifaDesglose {
  const { distanciaKm, duracionMin } = input;
  if (distanciaKm < 0 || duracionMin < 0) {
    throw new Error('Distancia y duración no pueden ser negativas.');
  }

  const multiplicador = input.multiplicadorDemanda ?? 1;
  if (multiplicador < 1) {
    throw new Error('El multiplicador de demanda debe ser >= 1.');
  }

  const base = input.tarifaBase;
  const porKm = redondear(distanciaKm * input.tarifaPorKm);
  const porMin = redondear(duracionMin * input.tarifaPorMin);
  const subtotal = redondear(base + porKm + porMin);
  const total = redondear(subtotal * multiplicador);
  const minimo = input.tarifaMinima;

  return {
    base,
    porKm,
    porMin,
    subtotal,
    multiplicadorDemanda: multiplicador,
    total: minimo !== undefined ? Math.max(total, minimo) : total,
  };
}