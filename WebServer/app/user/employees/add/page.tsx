"use client";

import EmployeeDrawer, {
  EmployeeDrawerType,
} from "@/app/components/Employee/EmployeeDrawer";
import { useRouter } from "next/navigation";

const EmployeeAddPage = () => {
  const router = useRouter();

  return (
    <EmployeeDrawer
      type={EmployeeDrawerType.ADD}
      onClose={() => router.push("/user/employees")}
    />
  );
};

export default EmployeeAddPage;
