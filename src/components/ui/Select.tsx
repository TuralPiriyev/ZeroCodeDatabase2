import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options: Option[];
  error?: string;
  helper?: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Select: React.FC<SelectProps> = ({
  id,
  label,
  options,
  error,
  helper,
  fullWidth = false,
  size = 'md',
  disabled,
  className,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substring(2, 9)}`;
  
  const sizeClasses = {
    sm: 'h-8 text-xs py-1',
    md: 'h-10 text-sm py-2',
    lg: 'h-12 text-base py-2.5',
  };

  return (
    <div className={clsx('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      {label && (
        <label 
          htmlFor={selectId} 
          className="mb-1.5 text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <select
          id={selectId}
          disabled={disabled}
          className={clsx(
            'block w-full appearance-none rounded-lg pl-4 pr-10',
            'transition-colors border',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent',
            sizeClasses[size],
            error
              ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-500'
              : 'border-gray-300 bg-white text-gray-900',
            disabled && 'cursor-not-allowed bg-gray-100 opacity-75'
          )}
          {...props}
        >
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value} 
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <ChevronDown size={size === 'sm' ? 16 : 20} />
        </div>
      </div>
      
      {(error || helper) && (
        <p 
          className={clsx(
            'mt-1.5 text-xs',
            error ? 'text-red-600' : 'text-gray-500'
          )}
        >
          {error || helper}
        </p>
      )}
    </div>
  );
};