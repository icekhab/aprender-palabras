import {
  getSuggestionsFetchErrorCopy,
  type SuggestionsFetchErrorCopy,
} from './suggestions-query'

export function SuggestionsErrorMessage({
  error,
  message,
}: {
  error?: unknown
  message?: string
}) {
  const copy: SuggestionsFetchErrorCopy = message
    ? { title: message }
    : getSuggestionsFetchErrorCopy(error)

  return (
    <div className="px-4 py-3 text-left" role="alert">
      <p className="text-sm font-semibold text-orange-950">{copy.title}</p>
      {copy.description ? (
        <p className="mt-1 text-sm text-orange-900/70">{copy.description}</p>
      ) : null}
    </div>
  )
}
