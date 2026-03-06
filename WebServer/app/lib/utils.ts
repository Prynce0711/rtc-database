import z from "zod";
import { excelDateToJSDate, isValidDate } from "./excel";

export const formatDate = (date?: Date | string | null) =>
  date
    ? new Date(date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dim";
}

type StringKeys<T> = {
  [K in keyof T]: Extract<T[K], string> extends never ? never : K;
}[keyof T];

export function getTextFields<T extends Record<string, unknown>>(
  obj: T,
  prefix = "",
): { key: StringKeys<T>; label: string }[] {
  const lowerPrefix = prefix.toLowerCase();
  const keys = Object.keys(obj) as (keyof T)[];

  return keys.reduce<{ key: StringKeys<T>; label: string }[]>((acc, key) => {
    const value = obj[key];
    if (
      typeof value === "string" &&
      key.toString().toLowerCase().includes(lowerPrefix)
    ) {
      acc.push({ key: key as StringKeys<T>, label: key.toString() });
    }
    return acc;
  }, []);
}

export function isTextFieldKey<T extends Record<string, unknown>>(
  obj: T,
  key: keyof T,
  prefix = "",
): key is StringKeys<T> {
  const value = obj[key];
  return (
    typeof value === "string" &&
    key.toString().toLowerCase().includes(prefix.toLowerCase())
  );
}

export function enumToText(value: string): string {
  const normalized = value.replace(/_/g, " ").toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getAgeFromDate(date?: Date | string | null): number | null {
  if (!date) return null;
  const birthDate = new Date(date);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function isRetirementEligible(date?: Date | string | null): boolean {
  const age = getAgeFromDate(date);
  return age !== null && age >= 60;
}

const unwrapSchema = (schema: unknown): unknown => {
  let current: unknown = schema;

  while (true) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = (current as unknown as { unwrap: () => unknown }).unwrap();
      continue;
    }
    const removeDefault = (
      current as unknown as { removeDefault?: () => unknown }
    ).removeDefault;
    if (removeDefault) {
      current = removeDefault();
      continue;
    }
    const innerType = (current as unknown as { innerType?: () => unknown })
      .innerType;
    if (innerType) {
      current = innerType();
      continue;
    }
    return current;
  }
};

const collectZodShapes = (schema: z.ZodTypeAny): z.ZodRawShape[] => {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny;

  if (unwrapped instanceof z.ZodObject) {
    return [unwrapped.shape];
  }

  if (unwrapped instanceof z.ZodIntersection) {
    const def = (
      unwrapped as unknown as { _def: { left: unknown; right: unknown } }
    )._def;
    return [
      ...collectZodShapes(def.left as z.ZodTypeAny),
      ...collectZodShapes(def.right as z.ZodTypeAny),
    ];
  }

  return [];
};

const isStringLikeSchema = (schema: z.ZodTypeAny): boolean => {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny;
  return unwrapped instanceof z.ZodString || unwrapped instanceof z.ZodEnum;
};

const isDateLikeSchema = (schema: z.ZodTypeAny): boolean => {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny;
  return unwrapped instanceof z.ZodDate;
};

const isNumberLikeSchema = (schema: z.ZodTypeAny): boolean => {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny;
  return unwrapped instanceof z.ZodNumber;
};

const isEnumLikeSchema = (schema: z.ZodTypeAny): boolean => {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny;
  return unwrapped instanceof z.ZodEnum;
};

export const getSchemaStringKeys = (
  schema: z.ZodTypeAny,
  exclude: string[] = [], // Opt-out list for string-like fields you do not want searchable/filterable.
): string[] => {
  const shapes = collectZodShapes(schema);
  const keys = new Set<string>();

  for (const shape of shapes) {
    for (const [key, value] of Object.entries(shape)) {
      if (exclude.includes(key)) continue;
      if (isStringLikeSchema(value as z.ZodTypeAny)) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys);
};

export const getSchemaDateKeys = (
  schema: z.ZodTypeAny,
  exclude: string[] = [],
): string[] => {
  const shapes = collectZodShapes(schema);
  const keys = new Set<string>();

  for (const shape of shapes) {
    for (const [key, value] of Object.entries(shape)) {
      if (exclude.includes(key)) continue;
      if (isDateLikeSchema(value as z.ZodTypeAny)) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys);
};

export const getSchemaNumberKeys = (
  schema: z.ZodTypeAny,
  exclude: string[] = [],
): string[] => {
  const shapes = collectZodShapes(schema);
  const keys = new Set<string>();

  for (const shape of shapes) {
    for (const [key, value] of Object.entries(shape)) {
      if (exclude.includes(key)) continue;
      if (isNumberLikeSchema(value as z.ZodTypeAny)) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys);
};

export const getSchemaEnumKeys = (
  schema: z.ZodTypeAny,
  exclude: string[] = [],
): string[] => {
  const shapes = collectZodShapes(schema);
  const keys = new Set<string>();

  for (const shape of shapes) {
    for (const [key, value] of Object.entries(shape)) {
      if (exclude.includes(key)) continue;
      if (isEnumLikeSchema(value as z.ZodTypeAny)) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys);
};

type SchemaFieldKeyExcludes = {
  all?: string[];
  stringKeys?: string[];
  dateKeys?: string[];
  numberKeys?: string[];
  enumKeys?: string[];
};

const shouldExcludeKey = (
  key: string,
  exclude: SchemaFieldKeyExcludes | string[],
  category?: keyof SchemaFieldKeyExcludes,
): boolean => {
  if (Array.isArray(exclude)) {
    return exclude.includes(key);
  }

  if (exclude.all?.includes(key)) return true;
  if (!category) return false;
  return exclude[category]?.includes(key) ?? false;
};

export const getSchemaFieldKeys = <T extends z.ZodType>(
  schema: T,
  exclude: SchemaFieldKeyExcludes | string[] = [],
): {
  stringKeys: string[];
  dateKeys: string[];
  numberKeys: string[];
  enumKeys: string[];
} => {
  const shapes = collectZodShapes(schema);
  const stringKeys = new Set<string>();
  const dateKeys = new Set<string>();
  const numberKeys = new Set<string>();
  const enumKeys = new Set<string>();

  for (const shape of shapes) {
    for (const [key, value] of Object.entries(shape)) {
      if (shouldExcludeKey(key, exclude)) continue;
      const schemaValue = value as z.ZodTypeAny;
      if (
        isStringLikeSchema(schemaValue) &&
        !shouldExcludeKey(key, exclude, "stringKeys")
      ) {
        stringKeys.add(key);
      }
      if (
        isDateLikeSchema(schemaValue) &&
        !shouldExcludeKey(key, exclude, "dateKeys")
      ) {
        dateKeys.add(key);
      }
      if (
        isNumberLikeSchema(schemaValue) &&
        !shouldExcludeKey(key, exclude, "numberKeys")
      ) {
        numberKeys.add(key);
      }
      if (
        isEnumLikeSchema(schemaValue) &&
        !shouldExcludeKey(key, exclude, "enumKeys")
      ) {
        enumKeys.add(key);
      }
    }
  }

  return {
    stringKeys: Array.from(stringKeys),
    dateKeys: Array.from(dateKeys),
    numberKeys: Array.from(numberKeys),
    enumKeys: Array.from(enumKeys),
  };
};

export const normalizeValueBySchema = (
  value: unknown,
  schema: unknown,
): unknown => {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodDate) {
    return normalizeDateValue(value);
  }

  if (unwrapped instanceof z.ZodEnum) {
    return normalizeEnumValue(value, unwrapped.options);
  }

  const nativeEnum = (unwrapped as { enum?: unknown }).enum;
  if (
    nativeEnum &&
    typeof nativeEnum === "object" &&
    !Array.isArray(nativeEnum)
  ) {
    const allowed = Object.values(nativeEnum).filter(
      (option): option is string => typeof option === "string",
    );
    return normalizeEnumValue(value, allowed);
  }

  if (unwrapped instanceof z.ZodBoolean) {
    return normalizeBooleanValue(value);
  }

  if (unwrapped instanceof z.ZodString) {
    if (value === undefined || value === null) return value;
    return typeof value === "string" ? value : String(value);
  }

  return value;
};

const normalizeEnumValue = (
  value: unknown,
  allowedValues: Array<string | number>,
): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (raw === "") return undefined;
  const normalized = raw.replace(/\s+/g, "_").toUpperCase();
  const normalizedAllowed = allowedValues.map((option) =>
    String(option).trim(),
  );
  if (normalizedAllowed.includes(normalized)) {
    return normalized;
  }
  const match = normalizedAllowed.find(
    (option) => option.toLowerCase() === raw.toLowerCase(),
  );
  return match;
};

const normalizeBooleanValue = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (raw === "") return undefined;
  if (["yes", "true", "1", "y"].includes(raw)) return true;
  if (["no", "false", "0", "n"].includes(raw)) return false;
  return undefined;
};

const normalizeDateValue = (value: unknown): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    return isValidDate(value) ? value : undefined;
  }
  if (typeof value === "number") {
    const parsed = excelDateToJSDate(value);
    return parsed && isValidDate(parsed) ? parsed : undefined;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && isValidDate(parsed)
      ? parsed
      : undefined;
  }
  return undefined;
};
