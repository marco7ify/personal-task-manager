import { useState, useEffect, useRef } from 'react';

export function PropertyTime({ value, onChange, placeholder = 'Select time...', autoFocus = false }) {
  const [localValue, setLocalValue] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e) => {
    const newValue = e.target.value || null;
    setLocalValue(newValue || '');
    onChange(newValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange(null);
  };

  return (
    <div className="property-time-wrapper">
      <input
        ref={inputRef}
        type="time"
        className="property-time"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
      {localValue && (
        <button 
          className="property-time-clear" 
          onClick={handleClear}
          title="Clear time"
        >
          ×
        </button>
      )}
    </div>
  );
}
