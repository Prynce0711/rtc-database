export type FormEntry<T> = T & {
  id: string;
  errors: Record<string, string>;
  saved: boolean;
};

export type ColDef<T extends FormEntry<any>> = {
  key: keyof T;
  label: string;
  placeholder: string;
  type: "text" | "date";
  width: number;
  required?: boolean;
  mono?: boolean;
};
