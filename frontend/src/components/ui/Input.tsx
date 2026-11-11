import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
  <div className="flex flex-col gap-1">
    {label && <label htmlFor={inputId} className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      ref={ref}
      id={inputId}
      {...props}
      className={clsx(
        'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition',
        error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
        className
      )}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
  );
});
Input.displayName = 'Input';
