import React, { ReactNode } from 'react';

// Extend React.ButtonHTMLAttributes<HTMLButtonElement> to allow all standard button props.
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => {
  const baseClasses = 'font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 transition-colors duration-200';

  const variantClasses: Record<string, string> = {
    primary: 'bg-primary hover:bg-indigo-500 text-white focus:ring-primary',
    secondary: 'bg-secondary hover:bg-pink-500 text-white focus:ring-secondary',
    ghost: 'bg-transparent hover:bg-base-300 text-gray-300 focus:ring-gray-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'py-1 px-3 text-sm',
    md: 'py-2 px-4 text-base',
    lg: 'py-3 px-6 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
