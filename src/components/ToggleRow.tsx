import { useId } from 'react';

type ToggleRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled
}: ToggleRowProps) {
  const id = useId();

  return (
    <div className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <label htmlFor={id} className="toggle-copy">
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-description">{description}</span> : null}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
