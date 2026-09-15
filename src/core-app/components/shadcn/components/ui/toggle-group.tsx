type ToggleType = 'single' | 'multiple';

type ToggleGroupProps = {
  type?: ToggleType;
  options: { label: string; value: string }[];
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  className?: string;
};

export function ToggleGroup({
  type = 'multiple',
  options,
  value,
  onChange,
  className = '',
}: ToggleGroupProps) {
  const isActive = (val: string) => {
    if (type === 'multiple') {
      return Array.isArray(value) && value.includes(val);
    }
    return value === val;
  };

  const handleToggle = (val: string) => {
    if (type === 'multiple') {
      const current = Array.isArray(value) ? value : [];

      if (current.includes(val)) {
        onChange(current.filter((v) => v !== val));
      } else {
        onChange([...current, val]);
      }
    } else {
      onChange(value === val ? null : val);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((option) => {
        const active = isActive(option.value);

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => handleToggle(option.value)}
            className={`
              px-5 py-1.5 rounded-md border text-xs transition
              ${
                active
                  ? 'bg-primary/10 border-orange-300 text-primary'
                  : 'bg-toggleGroupBaseColor text-gray-500 hover:bg-gray-100'
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
