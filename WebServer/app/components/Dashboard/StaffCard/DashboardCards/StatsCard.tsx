import React from "react";

interface StatsCardProps {
  title: string;
  value: number;
  borderColor: "primary" | "warning" | "success" | "error";
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, borderColor }) => {
  return (
    <div
      className={`card bg-base-100 shadow-xl border-l-4 border-${borderColor}`}
    >
      <div className="card-body">
        <h3 className="opacity-70 text-sm font-semibold">{title}</h3>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </div>
  );
};

export default StatsCard;
