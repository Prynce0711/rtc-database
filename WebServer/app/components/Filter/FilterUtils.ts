type DateRange = {
  start?: string;
  end?: string;
};

export type ConvertToFilter<T> = {
  [K in keyof T]?: Extract<T[K], Date> extends never ? T[K] : DateRange;
};

export type FilterOptions<T> = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  filters?: ConvertToFilter<T>;
  sortKey?: keyof T;
  sortOrder?: "asc" | "desc";
  exactMatchMap?: Record<string, boolean>;
};
