export type FilterTypeName =
  | "text"
  | "number"
  | "checkbox"
  | "range"
  | "daterange";

export interface FilterOption {
  key: string;
  label: string;
  type: FilterTypeName;
}

export type FilterValues = Record<string, any>;

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOption[];
  onApply: (filters: FilterValues) => void;
  initialValues?: FilterValues;
  getSuggestions?: (key: string, inputValue: string) => string[];
  requestClose?: () => void;
}
