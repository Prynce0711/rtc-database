import React from "react";
import Sidebar from "../components/Sidebar/Sidebar";

const layout = ({ children }: { children: React.ReactNode }) => {
  return <Sidebar>{children}</Sidebar>;
};

export default layout;
