import Roles from "@/app/lib/Roles";
import { z } from "zod";

export const NewUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  role: z.enum(Roles, { message: "Role must be Admin, Staff, or Atty" }),
});
export type NewUserSchema = z.infer<typeof NewUserSchema>;
