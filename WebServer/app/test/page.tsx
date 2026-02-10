"use client";

import { useEffect, useState } from "react";
import { usePopup } from "../components/Popup/PopupProvider";
import { authClient, User } from "../lib/authClient";

const page = () => {
  const statusPopup = usePopup();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: users, error } = await authClient.admin.listUsers({
        query: {
          sortBy: "name",
          sortDirection: "desc",
        },
      });
      if (error) {
        statusPopup.showError("Error fetching users", "error");
      } else {
        setUsers(users.users as User[]);
      }
    };
    fetchUsers();

    console.log("Users:", users);
  }, []);

  return (
    <>
      <div>{JSON.stringify(users)}</div>
    </>
  );
};

export default page;
