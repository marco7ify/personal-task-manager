import { useState, useEffect, useRef } from 'react';

export function PropertyNumber({ value, onChange, placeholder = 'Enter number...', min, max, step = 1, autoFocus = false }) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    let newValue = localValue === '' ? null : Number(localValue);
    
    if (newValue !== null) {
      if (isNaN(newValue)) {
        newValue = null;
      } else {
        if (min !== undefined && newValue < min) newValue = min;
        if (max !== undefined && newValue > max) newValue = max;
      }
    }

    if (newValue !== value) {
      onChange(newValue);
    }
    setLocalValue(newValue ?? '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value ?? '');
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      className="property-number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
    />
  );
}
