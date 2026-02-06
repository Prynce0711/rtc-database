import React from "react";

interface KpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, title, value }) => {
  return (
    <div className="stat bg-base-100 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="stat-figure text-primary">{icon}</div>
      <div className="stat-title">{title}</div>
      <div className="stat-value text-primary">{value}</div>
    </div>
  );
};

export default KpiCard;
