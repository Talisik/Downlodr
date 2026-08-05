import React from 'react';

export interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-1 cursor-pointer"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="cursor-pointer accent-orange-500 border-gray-300"
          />
          <span className="text-xs">{option.label}</span>
        </label>
      ))}
    </div>
  );
};

export default RadioGroup;
