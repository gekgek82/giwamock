import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center h-9 px-2">
      <h2 className="heading-5 text-gray-100 w-full">{children}</h2>
    </div>
  );
}

export function MobileSectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center px-4 pt-2.5 pb-2">
      <h2 className="body-16-bold text-gray-100">{children}</h2>
    </div>
  );
}
