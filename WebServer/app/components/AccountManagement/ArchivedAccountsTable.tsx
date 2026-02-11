import { User } from "@/app/generated/prisma/browser";
import { formatDate } from "@/app/lib/utils";
import { useState } from "react";

const ArchivedAccountsTable = ({
  allUsers,
  pageSize,
}: {
  allUsers: User[];
  pageSize: number;
}) => {
  const [archivePage, setArchivePage] = useState(1);
  const archivedUsers = allUsers.filter((u) => u.status === "INACTIVE");
  const paginatedArchivedUsers = archivedUsers.slice(
    (archivePage - 1) * pageSize,
    archivePage * pageSize,
  );
  const archiveTotalPages = Math.ceil(archivedUsers.length / pageSize);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Archived Accounts</h3>
        <span className="text-sm text-base-content/60">
          {archivedUsers.length} archived
        </span>
      </div>

      <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
        <table className="table table-zebra text-base md:text-lg">
          <thead>
            <tr>
              <th className="font-medium">Name</th>
              <th className="font-medium">Email</th>
              <th className="font-medium">Role</th>
              <th className="font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {archivedUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-base-content/60">
                  No archived accounts
                </td>
              </tr>
            ) : (
              paginatedArchivedUsers.map((user) => (
                <tr key={`archived-${user.id}`}>
                  <td className="text-base md:text-lg">{user.name}</td>
                  <td className="text-base md:text-lg">{user.email}</td>
                  <td className="text-base md:text-lg">{user.role}</td>
                  <td className="text-base md:text-lg">
                    {formatDate(user.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedAccountsTable;
