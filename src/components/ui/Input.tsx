import React, { useState, forwardRef } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  fullWidth = false,
  inputSize = 'md',
  type = 'text',
  disabled,
  className,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

  const toggleShowPassword = () => setShowPassword(prev => !prev);

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  const paddingClasses = {
    left: leftIcon ? 'pl-10' : 'pl-4',
    right: isPassword || rightIcon ? 'pr-10' : 'pr-4',
  };

  return (
    <div className={clsx('flex flex-col', fullWidth ? 'w-full' : '', className)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          disabled={disabled}
          className={clsx(
            'w-full rounded-lg border transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent',
            sizeClasses[inputSize],
            paddingClasses.left,
            paddingClasses.right,
            error
              ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300 focus:ring-red-500'
              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400',
            disabled && 'cursor-not-allowed bg-gray-100 opacity-75'
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={toggleShowPassword}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {rightIcon && !isPassword && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>

      {(error || helper) && (
        <p className={clsx('mt-1.5 text-xs', error ? 'text-red-600' : 'text-gray-500')}>
          {error || helper}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
