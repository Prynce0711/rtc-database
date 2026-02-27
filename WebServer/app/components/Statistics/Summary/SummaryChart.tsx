"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  {
    name: "January",
    "Dataset 1": 10,
    "Dataset 2": -60,
    "Dataset 3": 120,
  },
  {
    name: "February",
    "Dataset 1": 20,
    "Dataset 2": 50,
    "Dataset 3": 80,
  },
  {
    name: "March",
    "Dataset 1": 5,
    "Dataset 2": -40,
    "Dataset 3": 15,
  },
  {
    name: "April",
    "Dataset 1": 8,
    "Dataset 2": -20,
    "Dataset 3": 10,
  },
  {
    name: "May",
    "Dataset 1": -30,
    "Dataset 2": -170,
    "Dataset 3": 50,
  },
  {
    name: "June",
    "Dataset 1": 30,
    "Dataset 2": 90,
    "Dataset 3": -20,
  },
  {
    name: "July",
    "Dataset 1": 0,
    "Dataset 2": 10,
    "Dataset 3": 0,
  },
];

const SummaryChart = () => {
  return (
    <div className="w-full h-full flex justify-center items-center bg-base-100 rounded-lg p-6">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Dataset 1" stackId="a" fill="#FF5B7D" />
          <Bar dataKey="Dataset 2" stackId="a" fill="#3B82F6" />
          <Bar dataKey="Dataset 3" stackId="a" fill="#26D0CE" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SummaryChart;
