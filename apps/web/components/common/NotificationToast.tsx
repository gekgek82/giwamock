"use client";

import toast, { type Toast, type ToastOptions } from "react-hot-toast";

// ---------------------------------------------------------------------------
// NotificationToast — matches Figma "Notification" design spec
// ---------------------------------------------------------------------------
//
//   Desktop (md+)
//     bg-gray-30, dark text, inline row layout
//     px-5 py-2.5, gap-[30px], rounded-[10px]
//     message (16/24 medium) + optional Retry action (16/24 bold) + X dismiss
//
//   Mobile (< md)
//     bg-gray-70, light text, centered/stacked layout
//     px-4 py-2, gap-2.5, rounded-[10px], full-width within page padding
//     message (14/21 medium) + optional Retry action (14/21 bold, brand-green) stacked,
//     X dismiss on right
// ---------------------------------------------------------------------------

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 4L4 12M4 4L12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface NotificationToastProps {
  t: Toast;
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
  retryLabel?: string;
}

export function NotificationToast({
  t,
  message,
  onRetry,
  onClose,
  retryLabel = "Retry",
}: NotificationToastProps) {
  const dismiss = () => toast.dismiss(t.id);
  const handleRetry = () => {
    onRetry?.();
    dismiss();
  };
  const handleClose = () => {
    onClose?.();
    dismiss();
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center rounded-[10px]",
        // Mobile (default): dark pill, full-width, tighter spacing
        "w-full gap-2.5 bg-gray-70 px-4 py-2",
        // Desktop: light pill, auto width, inline spacing
        "md:w-auto md:gap-[30px] md:bg-gray-30 md:px-5 md:py-2.5",
        // Enter/leave animation
        "transition-all duration-200",
        t.visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-2 opacity-0",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1",
          "md:flex-initial md:flex-row md:gap-2",
        )}
      >
        <p
          className={cn(
            "body-14-medium text-center text-gray-10",
            "md:body-16-medium md:whitespace-nowrap md:text-left md:text-gray-100",
          )}
        >
          {message}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            className={cn(
              "inline-flex items-center",
              "body-14-bold text-brand-green",
              "md:body-16-bold md:text-gray-100",
              "transition-opacity hover:opacity-80",
            )}
          >
            <span>{retryLabel}</span>
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Dismiss"
        className={cn(
          "flex shrink-0 items-center justify-center",
          "text-gray-10 md:text-gray-100",
          "transition-opacity hover:opacity-70",
        )}
      >
        <XCloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface ShowToastOptions {
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
  retryLabel?: string;
  duration?: number;
  id?: string;
}

export function showToast({
  message,
  onRetry,
  onClose,
  retryLabel,
  duration,
  id,
}: ShowToastOptions): string {
  const opts: ToastOptions = {};
  if (duration !== undefined) opts.duration = duration;
  if (id !== undefined) opts.id = id;

  return toast.custom(
    (t) => (
      <NotificationToast
        t={t}
        message={message}
        onRetry={onRetry}
        onClose={onClose}
        retryLabel={retryLabel}
      />
    ),
    opts,
  );
}
