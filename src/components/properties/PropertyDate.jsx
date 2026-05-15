import { useState, useEffect, useRef } from 'react';

export function PropertyDate({ value, onChange, placeholder = 'Select date...', autoFocus = false }) {
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
    <div className="property-date-wrapper">
      <input
        ref={inputRef}
        type="date"
        className="property-date"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
      {localValue && (
        <button 
          className="property-date-clear" 
          onClick={handleClear}
          title="Clear date"
        >
          ×
        </button>
      )}
    </div>
  );
}
