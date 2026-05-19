"use client";

import { forwardRef } from "react";

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button — matches Figma "Button" design spec
// ---------------------------------------------------------------------------
//
//   Sizes
//     lg : Desktop large CTA   — 20/30 bold, rounded-[20px], py-4 px-5
//     md : Mobile large / modal CTA — 16/24 bold, rounded-[20px], py-2.5 px-5
//     sm : Small action button — 14/21 bold, rounded-[10px], py-1.5 px-2.5
//
//   Variants
//     primary   : brand-green background, dark ink
//     secondary : slate background, light ink
//     neutral   : light slate background (a.k.a. Figma "unselected"/tertiary)
//     danger    : red accent, outline-on-tint
//
//   States
//     disabled  : muted palette per Figma
//     loading   : swaps text for a spinner, keeps enabled background
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "neutral" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

// Enabled / disabled palette per Figma spec.
// The secondary slate tone is slightly darker at sm per Figma (gray-80 vs gray-70).
const variantClasses: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: {
    lg: "bg-brand-green text-gray-100 hover:bg-green-10 disabled:bg-green-10 disabled:text-green-30",
    md: "bg-brand-green text-gray-100 hover:bg-green-10 disabled:bg-green-10 disabled:text-green-30",
    sm: "bg-brand-green text-gray-100 hover:bg-green-10 disabled:bg-green-10 disabled:text-green-30",
  },
  secondary: {
    lg: "bg-gray-70 text-gray-10 hover:bg-gray-80 disabled:bg-gray-30 disabled:text-gray-50",
    md: "bg-gray-70 text-gray-10 hover:bg-gray-80 disabled:bg-gray-30 disabled:text-gray-50",
    sm: "bg-gray-80 text-gray-10 hover:bg-gray-90 disabled:bg-gray-30 disabled:text-gray-50",
  },
  neutral: {
    lg: "bg-gray-20 text-gray-80 hover:bg-gray-30 disabled:bg-gray-20 disabled:text-gray-50",
    md: "bg-gray-20 text-gray-80 hover:bg-gray-30 disabled:bg-gray-20 disabled:text-gray-50",
    sm: "bg-gray-20 text-gray-80 hover:bg-gray-30 disabled:bg-gray-20 disabled:text-gray-50",
  },
  danger: {
    lg: "bg-red-10 text-red-30 border border-red-30/20 hover:bg-red-20/20 disabled:opacity-50",
    md: "bg-red-10 text-red-30 border border-red-30/20 hover:bg-red-20/20 disabled:opacity-50",
    sm: "bg-red-10 text-red-30 border border-red-30/20 hover:bg-red-20/20 disabled:opacity-50",
  },
};

// Neutral uses Medium weight to match Figma "unselected" state.
// `lg` and `sm` are responsive: mobile sizing on small viewports, desktop sizing from md: up.
const sizeClasses: Record<ButtonSize, string> = {
  lg: "px-5 py-2.5 rounded-[20px] body-16-bold md:py-4 md:text-[20px] md:leading-[30px]",
  md: "px-5 py-2.5 rounded-[20px] body-16-bold",
  sm: "px-2 py-1.5 rounded-[10px] body-12-bold md:px-2.5 md:text-[14px] md:leading-[21px]",
};

const neutralSizeClasses: Record<ButtonSize, string> = {
  lg: "px-5 py-2.5 rounded-[20px] body-16-medium md:py-4 md:text-[20px] md:leading-[30px]",
  md: "px-5 py-2.5 rounded-[20px] body-16-medium",
  sm: "px-2 py-1.5 rounded-[10px] text-[12px] leading-[18px] font-medium md:px-2.5 md:text-[14px] md:leading-[21px]",
};

const spinnerSize: Record<ButtonSize, string> = {
  lg: "h-5 w-5 md:h-8 md:w-8",
  md: "h-5 w-5",
  sm: "h-4 w-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const typography =
      variant === "neutral" ? neutralSizeClasses[size] : sizeClasses[size];
    // Desktop-large CTAs ship full width by default to preserve prior layout.
    const widthClass = fullWidth || size === "lg" ? "w-full" : undefined;

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed",
          typography,
          variantClasses[variant][size],
          widthClass,
          className,
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Spinner className={spinnerSize[size]} />
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
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
  );
}

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------

type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
}

const iconSizeStyles: Record<IconButtonSize, string> = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-9 h-9",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-full hover:bg-gray-20 transition-colors text-gray-70 disabled:opacity-50 disabled:cursor-not-allowed",
          iconSizeStyles[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
