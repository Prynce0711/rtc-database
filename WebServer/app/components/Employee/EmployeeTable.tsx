"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import { FiEdit, FiTrash2 } from "react-icons/fi";

interface Props {
  employees: Employee[];
  bloodTypeMap: Record<string, string>;
  onEdit: (emp: Employee) => void;
  onDelete: (id: number) => void;
}

const EmployeeTable: React.FC<Props> = ({
  employees,
  bloodTypeMap,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="flex-1 overflow-x-auto bg-base-100 rounded-xl shadow">
      <table className="table w-full text-sm h-full">
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Employee #</th>
            <th>Position</th>
            <th>Branch / Station</th>
            <th>TIN</th>
            <th>GSIS</th>
            <th>PhilHealth</th>
            <th>Pag-IBIG</th>
            <th>Birthday</th>
            <th>Blood Type</th>
            <th>Allergies</th>
            <th>Height</th>
            <th>Weight</th>
            <th>Contact Person</th>
            <th>Contact Number</th>
            <th>Email</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              {/* Employee Name */}
              <td className="font-semibold">{emp.employeeName || "—"}</td>

              {/* Employee Number */}
              <td>{emp.employeeNumber || "—"}</td>

              {/* Position */}
              <td>{emp.position || "—"}</td>

              {/* Branch */}
              <td>{emp.branch || "—"}</td>

              {/* TIN */}
              <td>{emp.tinNumber || "—"}</td>

              {/* GSIS */}
              <td>{emp.gsisNumber || "—"}</td>

              {/* PhilHealth */}
              <td>{emp.philHealthNumber || "—"}</td>

              {/* Pag-IBIG */}
              <td>{emp.pagIbigNumber || "—"}</td>

              {/* Birthday */}
              <td>
                {emp.birthDate
                  ? new Date(emp.birthDate).toLocaleDateString()
                  : "—"}
              </td>

              {/* Blood Type */}
              <td>{emp.bloodType ? bloodTypeMap[emp.bloodType] : "—"}</td>

              {/* Allergies */}
              <td>
                {emp.allergies &&
                emp.allergies.trim() !== "" &&
                emp.allergies.toLowerCase() !== "n/a"
                  ? emp.allergies
                  : "N/A"}
              </td>

              {/* Height */}
              <td>{emp.height ?? "—"}</td>

              {/* Weight */}
              <td>{emp.weight ?? "—"}</td>

              {/* Contact Person */}
              <td>{emp.contactPerson || "—"}</td>

              {/* Contact Number */}
              <td>{emp.contactNumber || "—"}</td>

              {/* Email */}
              <td>{emp.email || "—"}</td>

              {/* Actions */}
              <td className="text-center flex gap-2 justify-center">
                <button
                  className="btn btn-ghost btn-sm text-primary"
                  onClick={() => onEdit(emp)}
                >
                  <FiEdit />
                </button>

                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => onDelete(emp.id)}
                >
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmployeeTable;
