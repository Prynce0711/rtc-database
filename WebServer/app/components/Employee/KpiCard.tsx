// KpiCard.tsx
import React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
  return (
    <div className="bg-base-300  rounded-2xl shadow-lg border border-base-200 p-6 hover:shadow-xl transition-shadow text-center ">
      <p className="text-base font-bold text-base-content/70 mb-3">{title}</p>
      <p className="text-5xl font-bold text-primary">{value}</p>
    </div>
  );
};

export default KpiCard;
