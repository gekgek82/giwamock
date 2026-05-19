"use client";

const TICKS = [0, 25, 50, 75, 100];

interface StakeSliderProps {
  percentage: number;
  onPercentageChange?: (pct: number) => void;
  readOnly?: boolean;
}

export function StakeSlider({
  percentage,
  onPercentageChange,
  readOnly = false,
}: StakeSliderProps) {
  const bubbleLeft = `calc(${percentage}% + ${(50 - percentage) * 0.2}px)`;

  return (
    <div>
      <div className="pt-10">
        <div className="relative">
          {/* Percentage bubble */}
          <div
            className="absolute -top-9 px-3 py-1 rounded-full bg-primary-200 text-neutral-1000 body-14-bold whitespace-nowrap select-none pointer-events-none"
            style={{
              left: bubbleLeft,
              transform: "translateX(-50%)",
              transition: "left 0.1s ease-out",
            }}
          >
            {percentage}%
            <span
              className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid var(--color-primary-200)",
              }}
            />
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={100}
            value={percentage}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={
              readOnly
                ? undefined
                : (e) => onPercentageChange?.(parseInt(e.target.value, 10))
            }
            className="withdraw-slider"
            style={{
              background: `linear-gradient(to right, var(--color-primary-200) 0%, var(--color-primary-200) ${percentage}%, var(--color-neutral-200) ${percentage}%, var(--color-neutral-200) 100%)`,
              cursor: readOnly ? "default" : "pointer",
            }}
          />
        </div>

        {/* Tick labels */}
        <div className="relative mt-3 h-5">
          {TICKS.map((tick) => (
            <button
              key={tick}
              type="button"
              disabled={readOnly}
              onClick={() => onPercentageChange?.(tick)}
              className={`absolute body-14-medium -translate-x-1/2 ${
                readOnly
                  ? "text-neutral-700 cursor-default"
                  : "text-neutral-700 hover:text-neutral-1000 transition-colors"
              }`}
              style={{ left: `${tick}%` }}
            >
              {tick}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TokenOutputCardProps {
  symbol: string;
  amount: string;
  usdValue: string;
}

export function TokenOutputCard({
  symbol,
  amount,
  usdValue,
}: TokenOutputCardProps) {
  return (
    <div className="bg-neutral-100 rounded-2xl px-5 py-4 flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="body-16-bold text-neutral-1000">{amount}</span>
        <span className="body-14 text-neutral-700">{symbol}</span>
      </div>
      <span className="body-12 text-neutral-700">{usdValue}</span>
    </div>
  );
}
