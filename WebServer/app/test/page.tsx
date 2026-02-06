import EmployeeDashboard from "../components/Employee/EmployeeDashboard";
import React from "react";

const page = () => {
  const [showModal, setShowModal] = React.useState(true);

  return (
    <>
      <EmployeeDashboard />
    </>
  );
};

export default page;
