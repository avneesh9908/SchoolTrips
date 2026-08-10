export function Loading({ message = 'Loading…' }) {
  return (
    <div className="state">
      <div className="spinner" />
      {message}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      <p style={{ margin: '0 0 14px' }}>{message}</p>
      {onRetry && (
        <button className="linkbtn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, message }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  )
}
