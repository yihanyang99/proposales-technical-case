/** Joins class names, skipping falsy values. Used by the UI library to append caller classes. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
