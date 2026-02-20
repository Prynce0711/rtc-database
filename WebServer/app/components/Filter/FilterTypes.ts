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

export type ExactMatchMap = Record<string, boolean>;

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOption[];
  onApply: (filters: FilterValues, exactMatchMap: ExactMatchMap) => void;
  initialValues?: FilterValues;
  getSuggestions?: (key: string, inputValue: string) => string[];
  requestClose?: () => void;
  initialExactMatchMap?: ExactMatchMap;
}
