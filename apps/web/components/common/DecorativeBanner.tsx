import type { ReactNode } from "react";

interface DecorativeBannerProps {
  children: ReactNode;
}

export function DecorativeBanner({ children }: DecorativeBannerProps) {
  return (
    <div
      className="relative flex min-h-[136px] flex-col items-center justify-center overflow-hidden rounded-[20px] p-6"
      style={{
        background:
          "linear-gradient(to bottom, #ffffff 12.683%, #00fea2 111.46%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ width: "796.843px", height: "448px" }}
      >
        <div
          className="flex-none rotate-90"
          style={{ width: "448px", height: "796.843px" }}
        >
          <img
            src="/deco-bg.jpg"
            alt=""
            className="block h-full w-full object-cover"
          />
        </div>
      </div>

      <img
        src="/deco-logo.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2"
        style={{ width: "120px", height: "107.332px" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-3">
        {children}
      </div>
    </div>
  );
}
