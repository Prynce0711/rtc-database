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
    color: "black",
    delay: 0,
  },
  {
    label: "Civil",
    key: "totalCivil" as const,
    subtitle: "Total civil cases",
    icon: Scale,
    color: "black",
    delay: 100,
  },
  {
    label: "Grand Total",
    key: "grandTotal" as const,
    subtitle: "All cases combined",
    icon: BarChart3,
    color: "black",
    delay: 200,
  },
  {
    label: "Branches",
    key: "branches" as const,
    subtitle: "Active branches",
    icon: FileText,
    color: "black",
    delay: 300,
  },
];

const MonthlyKPI: React.FC<MonthlyKPIProps> = (props) => {
  return (
    <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="transform hover:scale-105 card surface-card-hover group"
          style={{
            transitionDelay: `${card.delay}ms`,
            transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="card-body relative overflow-hidden"
            style={{ padding: "var(--space-card-padding)" }}
          >
            <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
              <card.icon className="h-full w-full" />
            </div>
            <div className="relative">
              <p className="font-extrabold uppercase text-sm tracking-wide text-base-content mb-3">
                {card.label}
              </p>
            </div>
            <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
              {props[card.key].toLocaleString()}
            </p>
            <p className="text-sm sm:text-base font-semibold text-muted">
              {card.subtitle}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
};

export default MonthlyKPI;
