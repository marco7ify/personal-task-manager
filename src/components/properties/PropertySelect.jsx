import { useState, useEffect, useRef } from 'react';

export function PropertySelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select...', 
  allowClear = true,
  autoFocus = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      setIsOpen(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.id === value || opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange(option.id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
    if (e.key === 'Enter' && filteredOptions.length === 1) {
      handleSelect(filteredOptions[0]);
    }
  };

  return (
    <div className="property-select-wrapper" ref={wrapperRef}>
      <div 
        className={`property-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? (
          <span 
            className="property-select-value"
            style={{ 
              backgroundColor: selectedOption.color ? `${selectedOption.color}20` : undefined,
              color: selectedOption.color || undefined
            }}
          >
            {selectedOption.value}
          </span>
        ) : (
          <span className="property-select-placeholder">{placeholder}</span>
        )}
        <div className="property-select-actions">
          {allowClear && selectedOption && (
            <button className="property-select-clear" onClick={handleClear}>×</button>
          )}
          <span className="property-select-arrow">▼</span>
        </div>
      </div>

      {isOpen && (
        <div className="property-select-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="property-select-search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="property-select-options">
            {filteredOptions.length === 0 ? (
              <div className="property-select-empty">No options found</div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.id}
                  className={`property-select-option ${option.id === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  <span 
                    className="property-select-option-badge"
                    style={{ 
                      backgroundColor: option.color ? `${option.color}20` : undefined,
                      color: option.color || undefined
                    }}
                  >
                    {option.value}
                  </span>
                  {option.id === value && <span className="property-select-check">✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
