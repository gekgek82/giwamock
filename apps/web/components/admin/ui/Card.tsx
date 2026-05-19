import { forwardRef } from "react";

/* ── Card ── */
export const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`rounded-lg border border-ds-gray-400 bg-ds-background-200 ${className}`}
    {...props}
  />
));
Card.displayName = "Card";

/* ── CardHeader ── */
export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`px-6 py-4 border-b border-ds-gray-400 ${className}`}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/* ── CardTitle ── */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-sm font-semibold text-ds-gray-1000 ${className}`}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/* ── CardDescription ── */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-ds-gray-700 mt-1 ${className}`}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/* ── CardContent ── */
export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div ref={ref} className={`px-6 py-4 ${className}`} {...props} />
));
CardContent.displayName = "CardContent";

/* ── CardFooter ── */
export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`px-6 py-3 border-t border-ds-gray-400 flex items-center ${className}`}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
