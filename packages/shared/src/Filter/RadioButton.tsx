"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";

export type RadioButtonOption<T extends string> = {
  label: string;
  value: T;
  description?: string;
  icon?: React.ElementType;
  count?: number;
};

type RadioButtonProps<T extends string> = {
  options: RadioButtonOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export default function RadioButton<T extends string>({
  options,
  value,
  onChange,
  className,
}: RadioButtonProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});

  const activeIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (activeIndex < 0) return;
    const activeTab = tabRefs.current[activeIndex];
    if (!activeTab) return;

    setIndicatorStyle({
      width: activeTab.offsetWidth,
      transform: `translateX(${activeTab.offsetLeft}px)`,
    });
  }, [activeIndex, options]);

  return (
    <div
      className={`relative flex p-1.5 rounded-full bg-base-200 border border-base-200 w-fit ${className ?? ""}`}
    >
      <div
        className="absolute top-1.5 bottom-1.5 rounded-full bg-base-100 shadow-sm transition-all duration-300 ease-out"
        style={indicatorStyle}
      />

      {options.map((option, index) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            onClick={() => onChange(option.value)}
            className={[
              "relative z-10 px-5 py-2.5 rounded-full text-[14px] font-bold transition-colors duration-150 flex items-center gap-2",
              isActive
                ? "text-primary"
                : "text-base-content/40 hover:text-base-content/70",
            ].join(" ")}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span className="text-left leading-tight">
              <span className="block whitespace-nowrap">{option.label}</span>
              {option.description ? (
                <span className="block text-[10px] font-medium opacity-70 whitespace-nowrap">
                  {option.description}
                </span>
              ) : null}
            </span>
            {typeof option.count === "number" ? (
              <span
                className={[
                  "px-1.5 py-0.5 rounded-full text-[15px] font-black min-w-4.5 text-center",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-base-300 text-base-content/40",
                ].join(" ")}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
