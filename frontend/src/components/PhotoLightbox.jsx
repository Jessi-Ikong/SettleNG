import { useEffect, useRef, useState } from 'react'

// Full-screen photo viewer. Renders nothing but its own overlay — the
// caller controls whether it's mounted at all (conditionally rendered
// on an open index), which is also what makes "restore focus to the
// triggering thumbnail on close" work for free: the effect below
// captures document.activeElement on mount and restores it on
// unmount, for every close path (Escape, backdrop click, close
// button, or the parent unmounting us some other way).
export default function PhotoLightbox({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const overlayRef = useRef(null)
  const touchStartXRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  const count = images.length

  const goPrev = () => setIndex((i) => (i - 1 + count) % count)
  const goNext = () => setIndex((i) => (i + 1) % count)

  useEffect(() => {
    setIndex(startIndex)
  }, [startIndex])

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement
    overlayRef.current?.focus()

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus()
      }
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
        return
      }
      if (event.key === 'ArrowRight') {
        goNext()
        return
      }
      if (event.key === 'Tab') {
        const focusables = overlayRef.current?.querySelectorAll('button')
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [count, onClose])

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0].clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current == null) return
    const delta = event.changedTouches[0].clientX - touchStartXRef.current
    touchStartXRef.current = null

    const SWIPE_THRESHOLD = 40
    if (delta > SWIPE_THRESHOLD) goPrev()
    else if (delta < -SWIPE_THRESHOLD) goNext()
  }

  return (
    <div
      className="photo-lightbox-overlay"
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="photo-lightbox-close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>

      {count > 1 && (
        <button
          type="button"
          className="photo-lightbox-arrow photo-lightbox-arrow-left"
          aria-label="Previous photo"
          onClick={goPrev}
        >
          ‹
        </button>
      )}

      <img
        className="photo-lightbox-image"
        src={images[index]}
        alt={`Photo ${index + 1} of ${count}`}
      />

      {count > 1 && (
        <button
          type="button"
          className="photo-lightbox-arrow photo-lightbox-arrow-right"
          aria-label="Next photo"
          onClick={goNext}
        >
          ›
        </button>
      )}

      {count > 1 && (
        <div className="photo-lightbox-counter">
          {index + 1} / {count}
        </div>
      )}
    </div>
  )
}
