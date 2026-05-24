import { useEffect, useState } from 'react'
import { DIAL_CODES, parsePhone } from '../data/locations'

interface PhoneFieldProps {
  label: string
  value: string
  defaultCode: string
  onChange: (combined: string) => void
  required?: boolean
}

// Phone input with a country-code selector. Stores the combined string
// (e.g. "+44 7700 900123") via onChange. Defaults to the user's country
// dial code when the existing value lacks a "+code" prefix.
export default function PhoneField({ label, value, defaultCode, onChange, required }: PhoneFieldProps) {
  const initial = parsePhone(value, defaultCode || '+1')
  const [code, setCode] = useState(initial.code)
  const [number, setNumber] = useState(initial.number)

  // If the parent's defaultCode changes (e.g. user picked a new country) and
  // we haven't started filling in a number yet, follow it.
  useEffect(() => {
    if (!number) setCode(defaultCode || '+1')
  }, [defaultCode]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(nextCode: string, nextNumber: string) {
    setCode(nextCode)
    setNumber(nextNumber)
    const trimmed = nextNumber.trim()
    onChange(trimmed ? `${nextCode} ${trimmed}` : '')
  }

  // De-duplicate dial codes for display, but keep the country label so
  // users can pick the right one when codes are shared (e.g. +1).
  const options = DIAL_CODES.slice().sort((a, b) => a.country.localeCompare(b.country))

  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{
        fontSize: 11, color: '#7c3aed', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'stretch',
      }}>
        <select
          value={`${code}|${options.find(o => o.code === code)?.country || ''}`}
          onChange={e => {
            const [c] = e.target.value.split('|')
            update(c || '+1', number)
          }}
          style={{
            width: 138,
            padding: '10px 30px 10px 12px',
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid #e9d5ff',
            background: '#fff',
            color: '#1a1a2e',
            outline: 'none',
            fontFamily: 'inherit',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%237c3aed' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {options.map(o => (
            <option key={`${o.country}|${o.code}`} value={`${o.code}|${o.country}`}>
              {o.flag} {o.country} ({o.code})
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={number}
          onChange={e => update(code, e.target.value)}
          placeholder="555 123 4567"
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid #e9d5ff',
            background: '#fff',
            color: '#1a1a2e',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </label>
  )
}
