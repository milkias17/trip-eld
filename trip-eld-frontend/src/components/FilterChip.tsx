import React from "react";
import { Coffee, Moon, Wrench, Droplet } from "lucide-react";

export type StopTypes = "break" | "rest" | "service" | "fuel";

export type FilterChipProps = {
  value: StopTypes;
  label?: string;
  count?: number;
  selected?: boolean;
  onToggle?: (value: StopTypes, next: boolean) => void;
  className?: string;
  size?: "sm" | "md";
};

const ICONS: Record<StopTypes, React.ComponentType<{ className?: string }>> = {
  break: Coffee,
  rest: Moon,
  service: Wrench,
  fuel: Droplet,
};

export default function FilterChip({
  value,
  label,
  count,
  selected = false,
  onToggle,
  className = "",
  size = "sm",
}: FilterChipProps) {
  const Icon = ICONS[value];

  const displayLabel = label ?? value[0].toUpperCase() + value.slice(1);

  function handleToggle() {
    onToggle?.(value, !selected);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  }

  const sizes = {
    sm: {
      wrapper: "px-2 py-1 gap-2",
      iconWrap: "h-6 w-6",
      icon: "h-3 w-3",
      label: "text-xs",
      badge: "min-w-[22px] px-1 text-xs",
      radius: "rounded-full",
    },
    md: {
      wrapper: "px-3 py-1.5 gap-3",
      iconWrap: "h-8 w-8",
      icon: "h-4 w-4",
      label: "text-sm",
      badge: "min-w-[28px] px-2 text-xs",
      radius: "rounded-full",
    },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={handleToggle}
      onKeyDown={onKeyDown}
      className={`
        inline-flex items-center ${s.wrapper} ${s.radius} select-none
        transition-all duration-150 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-indigo-400 focus-visible:ring-opacity-60
        ${selected ? "bg-indigo-600 text-white shadow" : "bg-gray-800 text-gray-200 hover:bg-gray-700"}
        ${className}
      `}
    >
      <span
        className={`
          inline-flex items-center justify-center ${s.iconWrap} shrink-0 ${selected ? "bg-white/20" : "bg-white/5"} rounded-full
        `}
        aria-hidden
      >
        <Icon className={`${s.icon} ${selected ? "text-white" : "text-gray-200"}`} />
      </span>

      <span className={`${s.label} font-medium leading-tight`}>{displayLabel}</span>

      {typeof count === "number" && (
        <span
          className={`ml-2 inline-flex items-center justify-center ${s.badge} py-0.5 font-semibold rounded-full
            ${selected ? "bg-white/25 text-white" : "bg-gray-700 text-gray-200"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
