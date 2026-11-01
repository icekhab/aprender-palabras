/** Safe in-app return path from `?returnTo=`. Rejects absolute URLs / protocol-relative. */
export function readReturnTo(
  searchParams: URLSearchParams | { get(name: string): string | null },
): string | null {
  const raw = searchParams.get('returnTo')?.trim()
  if (!raw) {
    return null
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  return raw
}

export function withReturnTo(path: string, returnTo: string): string {
  const params = new URLSearchParams({ returnTo })
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${params.toString()}`
}
