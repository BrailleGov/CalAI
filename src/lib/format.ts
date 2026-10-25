const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2
});

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}

export function formatMacro(value: number): string {
  return `${Math.round(value)} g`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

export function kilogramsToPounds(kg: number): number {
  return kg * 2.2046226218;
}

export function poundsToKilograms(lb: number): number {
  return lb / 2.2046226218;
}

export function centimetresToInches(cm: number): number {
  return cm / 2.54;
}

export function inchesToCentimetres(inches: number): number {
  return inches * 2.54;
}

export function formatWeight(kg: number, units: 'metric' | 'imperial'): string {
  return units === 'metric'
    ? `${formatDecimal(Math.round(kg * 10) / 10)} kg`
    : `${formatNumber(kilogramsToPounds(kg))} lb`;
}

export function formatHeight(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'metric') return `${formatNumber(cm)} cm`;

  const totalInches = Math.round(centimetresToInches(cm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}′ ${inches}″`;
}

export function timeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
