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
