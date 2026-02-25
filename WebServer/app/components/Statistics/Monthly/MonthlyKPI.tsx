"use client";

import { BarChart3, FileText, Gavel, Scale } from "lucide-react";
import React from "react";

interface MonthlyKPIProps {
  totalCriminal: number;
  totalCivil: number;
  grandTotal: number;
  branches: number;
}

const cards = [
  {
    label: "Criminal",
    key: "totalCriminal" as const,
    subtitle: "Total criminal cases",
    icon: Gavel,
    color: "error",
    delay: 0,
  },
  {
    label: "Civil",
    key: "totalCivil" as const,
    subtitle: "Total civil cases",
    icon: Scale,
    color: "info",
    delay: 100,
  },
  {
    label: "Grand Total",
    key: "grandTotal" as const,
    subtitle: "All cases combined",
    icon: BarChart3,
    color: "primary",
    delay: 200,
  },
  {
    label: "Branches",
    key: "branches" as const,
    subtitle: "Active branches",
    icon: FileText,
    color: "success",
    delay: 300,
  },
];

const MonthlyKPI: React.FC<MonthlyKPIProps> = (props) => {
  return (
    <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="card shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 group"
          style={{ transitionDelay: `${card.delay}ms` }}
        >
          <div className="card-body p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <card.icon className="h-full w-full" />
            </div>
            <div className="relative">
              <div className={`badge badge-${card.color} gap-2 mb-3`}>
                <span className="font-bold uppercase text-xs">
                  {card.label}
                </span>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                {props[card.key].toLocaleString()}
              </p>
              <p className="text-sm sm:text-base font-semibold text-base-content/60">
                {card.subtitle}
              </p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default MonthlyKPI;
