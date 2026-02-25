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
