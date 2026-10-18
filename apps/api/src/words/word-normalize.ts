export function normalizeWordKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}
