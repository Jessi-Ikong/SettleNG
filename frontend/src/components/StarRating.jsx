const STAR_VALUES = [1, 2, 3, 4, 5]

// Renders 5 stars. Pass `value` + `onChange` for an interactive
// picker (ReviewForm), or just `value` for a read-only display
// (ReviewsList) — fractional values round to the nearest whole star
// for the fill.
export default function StarRating({ value, onChange, label }) {
  const interactive = typeof onChange === 'function'
  const rounded = value != null ? Math.round(value) : 0

  return (
    <span
      className={'star-rating' + (interactive ? ' star-rating-interactive' : '')}
      role={interactive ? 'radiogroup' : undefined}
      aria-label={label}
    >
      {STAR_VALUES.map((n) => (
        <button
          key={n}
          type={interactive ? 'button' : undefined}
          className={
            'star' + (n <= rounded ? ' star-filled' : '') + (interactive ? '' : ' star-static')
          }
          onClick={interactive ? () => onChange(n) : undefined}
          disabled={!interactive}
          aria-label={interactive ? `${n} star${n > 1 ? 's' : ''}` : undefined}
        >
          ★
        </button>
      ))}
    </span>
  )
}
