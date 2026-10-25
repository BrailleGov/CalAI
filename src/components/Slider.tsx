import { useId } from 'react';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled
}: SliderProps) {
  const id = useId();

  return (
    <div className={`slider-field${disabled ? ' is-disabled' : ''}`}>
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
