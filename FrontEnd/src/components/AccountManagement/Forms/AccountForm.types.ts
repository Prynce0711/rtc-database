export interface AccountFormData {
  name: string;
  email: string;
  password?: string;
  role: "STAFF" | "ADMIN" | "SUPERADMIN";
  banned: boolean;
  banReason?: string;
  banExpires?: Date;
}

export const initialAccountFormData: AccountFormData = {
  name: "",
  email: "",
  password: "",
  role: "STAFF",
  banned: false,
  banReason: undefined,
  banExpires: undefined,
};

export const validateAccountForm = (
  data: AccountFormData,
  isEdit: boolean = false,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.name.trim()) {
    errors.name = "Name is required";
  }

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Invalid email format";
  }

  if (!isEdit && !data.password) {
    errors.password = "Password is required for new accounts";
  }

  if (data.password && data.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (!data.role) {
    errors.role = "Role is required";
  }

  if (data.banned && !data.banReason?.trim()) {
    errors.banReason = "Ban reason is required when account is banned";
  }

  return errors;
};
