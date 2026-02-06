import React from "react";
import AdminDashboard from "@/app/components/Dashboard/AdminDashboard";
import StaffDashboard from "@/app/components/Dashboard/StaffDashboard";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers";
import EmployeeDashboard from "@/app/components/Employee/EmployeeDashboard";

const page = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  if (session.user.role === "admin") return <EmployeeDashboard />;
  else return <div>Unauthorized</div>;
};

export default page;
