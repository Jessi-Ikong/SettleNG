import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'

export default function LocationPicker({ onChange, initialValue }) {
  const [states, setStates] = useState([])
  const [lgas, setLgas] = useState([])
  const [wards, setWards] = useState([])

  const [stateId, setStateId] = useState(initialValue?.stateId || '')
  const [lgaId, setLgaId] = useState(initialValue?.lgaId || '')
  const [wardId, setWardId] = useState(initialValue?.wardId || '')

  const [loadingLgas, setLoadingLgas] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/locations/states`)
      .then((res) => res.json())
      .then((data) => setStates(data.filter((s) => s.active)))
      .catch(() => setStates([]))
  }, [])

  useEffect(() => {
    if (!stateId) {
      setLgas([])
      return
    }
    setLoadingLgas(true)
    fetch(`${API_BASE_URL}/api/locations/states/${stateId}/lgas`)
      .then((res) => res.json())
      .then((data) => setLgas(data))
      .catch(() => setLgas([]))
      .finally(() => setLoadingLgas(false))
  }, [stateId])

  useEffect(() => {
    if (!lgaId) {
      setWards([])
      return
    }
    setLoadingWards(true)
    fetch(`${API_BASE_URL}/api/locations/lgas/${lgaId}/wards`)
      .then((res) => res.json())
      .then((data) => setWards(data))
      .catch(() => setWards([]))
      .finally(() => setLoadingWards(false))
  }, [lgaId])

  const emitChange = (next) => {
    onChange?.({
      stateId: next.stateId || null,
      lgaId: next.lgaId || null,
      wardId: next.wardId || null,
    })
  }

  const handleStateChange = (event) => {
    const value = event.target.value
    setStateId(value)
    setLgaId('')
    setWardId('')
    setWards([])
    emitChange({ stateId: value, lgaId: '', wardId: '' })
  }

  const handleLgaChange = (event) => {
    const value = event.target.value
    setLgaId(value)
    setWardId('')
    emitChange({ stateId, lgaId: value, wardId: '' })
  }

  const handleWardChange = (event) => {
    const value = event.target.value
    setWardId(value)
    emitChange({ stateId, lgaId, wardId: value })
  }

  return (
    <div className="location-picker">
      <div className="signpost-trail">
        <select
          className="signpost-chip"
          value={stateId}
          onChange={handleStateChange}
        >
          <option value="">State</option>
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>

        <select
          className="signpost-chip"
          value={lgaId}
          onChange={handleLgaChange}
          disabled={!stateId || loadingLgas}
        >
          <option value="">{loadingLgas ? 'Loading...' : 'LGA'}</option>
          {lgas.map((lga) => (
            <option key={lga.id} value={lga.id}>
              {lga.name}
            </option>
          ))}
        </select>

        <select
          className="signpost-chip"
          value={wardId}
          onChange={handleWardChange}
          disabled={!lgaId || loadingWards}
        >
          <option value="">{loadingWards ? 'Loading...' : 'Ward'}</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
