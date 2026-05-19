"use client";

import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-ds-gray-1000 text-ds-background-100 border border-ds-gray-1000 hover:bg-ds-gray-900 hover:border-ds-gray-900",
  secondary:
    "bg-ds-gray-200 text-ds-gray-900 border border-ds-gray-400 hover:bg-ds-gray-300 hover:border-ds-gray-500",
  outline:
    "bg-transparent text-ds-gray-900 border border-ds-gray-400 hover:bg-ds-gray-200 hover:border-ds-gray-500",
  ghost:
    "bg-transparent text-ds-gray-700 border border-transparent hover:bg-ds-gray-200 hover:text-ds-gray-900",
  danger:
    "bg-transparent text-ds-red-400 border border-ds-red-700/40 hover:bg-ds-red-700/10 hover:border-ds-red-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-md",
  lg: "h-10 px-5 text-sm gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
