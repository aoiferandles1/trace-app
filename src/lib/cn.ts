/**
 * Joins class names, skipping falsy values.
 *
 * There is no class merging: a later class does not remove an earlier one.
 * Pass `className` to components for layout (margin, width, grid placement),
 * not to override their colours or type.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
