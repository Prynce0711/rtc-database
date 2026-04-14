"use client";

import {
  getEmployeeById,
  getEmployeesByIds,
} from "@/app/components/Employee/EmployeeActions";
import EmployeeDrawer, {
  EmployeeDrawerType,
} from "@/app/components/Employee/EmployeeDrawer";
import { Employee } from "@rtc-database/shared/prisma/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const EmployeeEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idParam = searchParams.get("id");
    const idsParam = searchParams.get("ids");

    const ids = idsParam
      ? Array.from(
          new Set(
            idsParam
              .split(",")
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isInteger(value) && value > 0),
          ),
        )
      : [];

    if (ids.length === 0 && !idParam) {
      setError("Missing employee id");
      setLoading(false);
      return;
    }

    const loadEmployee = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const result = await getEmployeesByIds(ids);
        if (!result.success || !result.result) {
          const message =
            !result.success && "error" in result
              ? result.error || "Failed to load employee"
              : "Failed to load employee";
          setError(message);
          setLoading(false);
          return;
        }

        const loadedEmployees = result.result;

        setSelectedEmployees(loadedEmployees);
        setSelectedEmployee(loadedEmployees[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const parsedId = Number(idParam);
      const result = await getEmployeeById(parsedId);

      if (!result.success || !result.result) {
        const message =
          !result.success && "error" in result
            ? result.error || "Failed to load employee"
            : "Failed to load employee";
        setError(message);
        setLoading(false);
        return;
      }

      setSelectedEmployee(result.result);
      setSelectedEmployees([result.result]);
      setError(null);
      setLoading(false);
    };

    void loadEmployee();
  }, [searchParams]);

  const goBack = () => router.push("/user/employees");

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading employee...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedEmployee || selectedEmployees.length === 0) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Employee not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBack}>
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <EmployeeDrawer
      type={EmployeeDrawerType.EDIT}
      selectedEmployee={selectedEmployee}
      selectedEmployees={selectedEmployees}
      onClose={goBack}
    />
  );
};

export default EmployeeEditPage;
