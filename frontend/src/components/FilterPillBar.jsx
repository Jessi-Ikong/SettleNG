import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import LocationPicker from './LocationPicker'
import { AMENITIES, PROPERTY_TYPES, FURNISHED_STATUSES } from '../lib/amenities'

const BEDROOM_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4+' },
]

// Independent of LocationPicker's own internal state/fetches (which
// only exist to power its own dropdowns and are never exposed to the
// parent) — this resolves state_id/lga_id into human-readable names
// purely so the Location pill can show "Lagos, Eti-Osa" instead of a
// raw id, including right after a page refresh before the picker
// itself has been touched.
function useLocationLabel(stateId, lgaId) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!stateId) {
      setLabel('')
      return
    }

    async function resolve() {
      const states = await fetch(`${API_BASE_URL}/api/locations/states`)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
      if (cancelled) return
      const stateName = states.find(
        (s) => String(s.id) === String(stateId),
      )?.name

      if (!lgaId) {
        setLabel(stateName || '')
        return
      }

      const lgas = await fetch(
        `${API_BASE_URL}/api/locations/states/${stateId}/lgas`,
      )
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
      if (cancelled) return
      const lgaName = lgas.find((l) => String(l.id) === String(lgaId))?.name

      setLabel(
        stateName && lgaName ? `${stateName}, ${lgaName}` : stateName || '',
      )
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [stateId, lgaId])

  return label
}

function FilterPanel({ anchorRef, onRequestClose, children }) {
  const panelRef = useRef(null)
  // Vertical placement is plain CSS (top: 100% of .filter-bar-outer,
  // which is position:relative) so it's always correct with zero risk
  // of stale-measurement bugs. Only the horizontal offset needs JS —
  // it has to start near whichever pill was clicked, but never push
  // the panel past the viewport's edges regardless of where that pill
  // sits in the horizontally-scrolling bar.
  const [left, setLeft] = useState(null)

  useEffect(() => {
    const outer = panelRef.current?.closest('.filter-bar-outer')
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!outer || !anchor || !panel) return

    const recompute = () => {
      const outerRect = outer.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      const margin = 16
      const panelWidth = panel.offsetWidth
      const rawLeft = anchorRect.left - outerRect.left
      const maxLeft = outerRect.width - panelWidth - margin
      setLeft(Math.max(margin, Math.min(rawLeft, maxLeft)))
    }

    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [anchorRef])

  const style = left === null ? { visibility: 'hidden' } : { left }

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        panelRef.current?.contains(event.target) ||
        anchorRef.current?.contains(event.target)
      ) {
        return
      }
      onRequestClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [anchorRef, onRequestClose])

  return (
    <div ref={panelRef} className="filter-bar-panel" style={style}>
      {children}
    </div>
  )
}

export default function FilterPillBar({ filters, sort, sortOptions, onChange, onSortChange }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [draftLocation, setDraftLocation] = useState({
    stateId: '',
    lgaId: '',
    wardId: '',
    neighborhoodId: '',
  })
  const [draftNeighborhoods, setDraftNeighborhoods] = useState([])

  const locationPillRef = useRef(null)
  const typePillRef = useRef(null)
  const pricePillRef = useRef(null)
  const bedsPillRef = useRef(null)
  const amenitiesPillRef = useRef(null)
  const sortPillRef = useRef(null)
  const barRef = useRef(null)

  const locationLabel = useLocationLabel(filters.state_id, filters.lga_id)

  // Ambient auto-scroll for when the bar doesn't fit its full width
  // (on a wide screen where all 6 pills already fit, scrollWidth ===
  // clientWidth and this is a no-op). setInterval rather than
  // requestAnimationFrame deliberately — this is a slow decorative
  // ticker with no need for paint-cycle sync, and rAF gets throttled
  // or fully suspended in contexts a real device can still hit (a
  // backgrounded tab, certain embedded/iframe views), which would
  // just make the drift silently never run at all. Any real user
  // interaction — touch, drag, or wheel — pauses it INSTANTLY by
  // clearing the interval outright, not by letting the current step
  // finish, so a tap can never land on a pill that's still sliding
  // out from under it. It only resumes after 2s of quiet, and stays
  // paused the whole time any pill's panel is open (drifting the bar
  // out from under an open, fixed-position panel would look broken).
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const STEP_PX = 1 // per tick
    const TICK_MS = 60 // ≈17px/s — slow, ambient, not a jarring slide
    let intervalId = null
    let direction = 1

    const tick = () => {
      const max = bar.scrollWidth - bar.clientWidth
      if (max <= 0) return
      let next = bar.scrollLeft + direction * STEP_PX
      if (next >= max) {
        next = max
        direction = -1
      } else if (next <= 0) {
        next = 0
        direction = 1
      }
      bar.scrollLeft = next
    }

    const startDrift = () => {
      if (intervalId !== null) return
      intervalId = setInterval(tick, TICK_MS)
    }
    const stopDrift = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    if (openPanel === null) startDrift()

    let resumeTimeout = null
    const pauseDrift = () => {
      stopDrift()
      if (resumeTimeout) clearTimeout(resumeTimeout)
    }
    const scheduleResume = () => {
      if (resumeTimeout) clearTimeout(resumeTimeout)
      resumeTimeout = setTimeout(() => {
        if (openPanel === null) startDrift()
      }, 2000)
    }
    const handleInteractionEnd = () => scheduleResume()

    bar.addEventListener('pointerdown', pauseDrift)
    bar.addEventListener('pointerup', handleInteractionEnd)
    bar.addEventListener('pointercancel', handleInteractionEnd)
    bar.addEventListener('wheel', pauseDrift, { passive: true })
    bar.addEventListener('wheel', handleInteractionEnd, { passive: true })

    return () => {
      stopDrift()
      if (resumeTimeout) clearTimeout(resumeTimeout)
      bar.removeEventListener('pointerdown', pauseDrift)
      bar.removeEventListener('pointerup', handleInteractionEnd)
      bar.removeEventListener('pointercancel', handleInteractionEnd)
      bar.removeEventListener('wheel', pauseDrift)
      bar.removeEventListener('wheel', handleInteractionEnd)
    }
  }, [openPanel])

  const openLocationPanel = () => {
    setDraftLocation({
      stateId: filters.state_id || '',
      lgaId: filters.lga_id || '',
      wardId: filters.ward_id || '',
      neighborhoodId: filters.neighborhood_id || '',
    })
    setOpenPanel((current) => (current === 'location' ? null : 'location'))
  }

  const togglePanel = (key) => {
    setOpenPanel((current) => (current === key ? null : key))
  }

  const closePanel = () => setOpenPanel(null)

  useEffect(() => {
    if (!draftLocation.wardId) {
      setDraftNeighborhoods([])
      return
    }
    fetch(
      `${API_BASE_URL}/api/locations/wards/${draftLocation.wardId}/neighborhoods`,
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDraftNeighborhoods(data))
      .catch(() => setDraftNeighborhoods([]))
  }, [draftLocation.wardId])

  const handleLocationPickerChange = (selection) => {
    setDraftLocation({
      stateId: selection.stateId || '',
      lgaId: selection.lgaId || '',
      wardId: selection.wardId || '',
      neighborhoodId: '',
    })
  }

  const applyLocation = () => {
    onChange({
      state_id: draftLocation.stateId || null,
      lga_id: draftLocation.lgaId || null,
      ward_id: draftLocation.wardId || null,
      neighborhood_id: draftLocation.neighborhoodId || null,
    })
    closePanel()
  }

  const clearLocation = () => {
    setDraftLocation({ stateId: '', lgaId: '', wardId: '', neighborhoodId: '' })
    onChange({
      state_id: null,
      lga_id: null,
      ward_id: null,
      neighborhood_id: null,
    })
    closePanel()
  }

  const toggleAmenity = (amenity) => {
    const current = filters.amenities || []
    const next = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity]
    onChange({ amenities: next })
  }

  const locationActive = Boolean(
    filters.state_id || filters.lga_id || filters.ward_id || filters.neighborhood_id,
  )
  const typeActive = Boolean(filters.property_type || filters.furnished)
  const priceActive = Boolean(filters.min_price || filters.max_price)
  const bedsActive = Boolean(filters.bedrooms)
  const amenitiesActive = Boolean((filters.amenities || []).length)
  const sortActive = sort !== 'newest'

  const pillClass = (active) =>
    'filter-pill filter-bar-pill' + (active ? ' filter-pill-active' : '')

  return (
    <div className="filter-bar-outer">
      <div className="filter-bar" ref={barRef}>
        <button
          type="button"
          ref={locationPillRef}
          className={pillClass(locationActive)}
          onClick={openLocationPanel}
        >
          {locationLabel || 'Location'}
        </button>
        {openPanel === 'location' && (
          <FilterPanel anchorRef={locationPillRef} onRequestClose={closePanel}>
            <LocationPicker
              onChange={handleLocationPickerChange}
              initialValue={{
                stateId: draftLocation.stateId,
                lgaId: draftLocation.lgaId,
                wardId: draftLocation.wardId,
              }}
            />
            <div className="filter-panel-field">
              <label htmlFor="filter-neighborhood" className="filter-label">
                Neighborhood
              </label>
              <select
                id="filter-neighborhood"
                value={draftLocation.neighborhoodId}
                onChange={(e) =>
                  setDraftLocation((prev) => ({
                    ...prev,
                    neighborhoodId: e.target.value,
                  }))
                }
                disabled={!draftLocation.wardId}
              >
                <option value="">Any</option>
                {draftNeighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-panel-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={clearLocation}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-primary filter-panel-apply"
                onClick={applyLocation}
              >
                Apply
              </button>
            </div>
          </FilterPanel>
        )}

        <button
          type="button"
          ref={typePillRef}
          className={pillClass(typeActive)}
          onClick={() => togglePanel('type')}
        >
          Property type
        </button>
        {openPanel === 'type' && (
          <FilterPanel anchorRef={typePillRef} onRequestClose={closePanel}>
            <div className="filter-panel-field">
              <label htmlFor="filter-type" className="filter-label">
                Property type
              </label>
              <select
                id="filter-type"
                value={filters.property_type || ''}
                onChange={(e) => {
                  onChange({ property_type: e.target.value || null })
                  closePanel()
                }}
              >
                <option value="">Any</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-panel-field">
              <label htmlFor="filter-furnished" className="filter-label">
                Furnished
              </label>
              <select
                id="filter-furnished"
                value={filters.furnished || ''}
                onChange={(e) => {
                  onChange({ furnished: e.target.value || null })
                  closePanel()
                }}
              >
                <option value="">Any</option>
                {FURNISHED_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </FilterPanel>
        )}

        <button
          type="button"
          ref={pricePillRef}
          className={pillClass(priceActive)}
          onClick={() => togglePanel('price')}
        >
          Price
        </button>
        {openPanel === 'price' && (
          <FilterPanel anchorRef={pricePillRef} onRequestClose={closePanel}>
            <div className="filter-panel-field">
              <span className="filter-label">Rent (₦)</span>
              <div className="filter-price-row">
                <input
                  type="number"
                  min="0"
                  placeholder="Min rent"
                  value={filters.min_price || ''}
                  onChange={(e) =>
                    onChange({ min_price: e.target.value || null })
                  }
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Max rent"
                  value={filters.max_price || ''}
                  onChange={(e) =>
                    onChange({ max_price: e.target.value || null })
                  }
                />
              </div>
            </div>
          </FilterPanel>
        )}

        <button
          type="button"
          ref={bedsPillRef}
          className={pillClass(bedsActive)}
          onClick={() => togglePanel('beds')}
        >
          Beds and baths
        </button>
        {openPanel === 'beds' && (
          <FilterPanel anchorRef={bedsPillRef} onRequestClose={closePanel}>
            <div className="filter-panel-field">
              <span className="filter-label">Bedrooms</span>
              <div className="filter-pill-row">
                {BEDROOM_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      'filter-pill' +
                      ((filters.bedrooms || '') === option.value
                        ? ' filter-pill-active'
                        : '')
                    }
                    onClick={() => {
                      onChange({ bedrooms: option.value || null })
                      closePanel()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </FilterPanel>
        )}

        <button
          type="button"
          ref={amenitiesPillRef}
          className={pillClass(amenitiesActive)}
          onClick={() => togglePanel('amenities')}
        >
          Amenities
        </button>
        {openPanel === 'amenities' && (
          <FilterPanel anchorRef={amenitiesPillRef} onRequestClose={closePanel}>
            <div className="filter-panel-field">
              <span className="filter-label">Amenities</span>
              <div className="filter-amenities-grid">
                {AMENITIES.map((amenity) => (
                  <label key={amenity} className="amenity-checkbox">
                    <input
                      type="checkbox"
                      checked={(filters.amenities || []).includes(amenity)}
                      onChange={() => toggleAmenity(amenity)}
                    />
                    {amenity}
                  </label>
                ))}
              </div>
            </div>
          </FilterPanel>
        )}

        <button
          type="button"
          ref={sortPillRef}
          className={pillClass(sortActive)}
          onClick={() => togglePanel('sort')}
        >
          Sort
        </button>
        {openPanel === 'sort' && (
          <FilterPanel anchorRef={sortPillRef} onRequestClose={closePanel}>
            <div className="filter-panel-field">
              <span className="filter-label">Sort by</span>
              <div className="filter-pill-row filter-pill-row-column">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      'filter-pill' +
                      (sort === option.value ? ' filter-pill-active' : '')
                    }
                    onClick={() => {
                      onSortChange(option.value)
                      closePanel()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </FilterPanel>
        )}
      </div>
    </div>
  )
}
