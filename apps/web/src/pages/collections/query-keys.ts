export const COLLECTIONS_QUERY_KEY = ['collections'] as const

export function collectionsListQueryKey(q: string) {
  return [...COLLECTIONS_QUERY_KEY, 'list', q] as const
}

export function collectionQueryKey(collectionId: string) {
  return [...COLLECTIONS_QUERY_KEY, 'detail', collectionId] as const
}
