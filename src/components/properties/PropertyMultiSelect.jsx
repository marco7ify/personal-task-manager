import { useState, useEffect, useRef } from 'react';

export function PropertyMultiSelect({ 
  value = [], 
  onChange, 
  options = [], 
  placeholder = 'Select...', 
  autoFocus = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedValues = Array.isArray(value) ? value : [];

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

  const selectedOptions = options.filter(opt => 
    selectedValues.includes(opt.id) || selectedValues.includes(opt.value)
  );

  const filteredOptions = options.filter(opt =>
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (option) => {
    const isSelected = selectedValues.includes(option.id) || selectedValues.includes(option.value);
    let newValues;
    
    if (isSelected) {
      newValues = selectedValues.filter(v => v !== option.id && v !== option.value);
    } else {
      newValues = [...selectedValues, option.id];
    }
    
    onChange(newValues);
  };

  const handleRemove = (e, optionId) => {
    e.stopPropagation();
    const newValues = selectedValues.filter(v => v !== optionId);
    onChange(newValues);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
    if (e.key === 'Backspace' && searchTerm === '' && selectedValues.length > 0) {
      // Remove last selected item
      const newValues = selectedValues.slice(0, -1);
      onChange(newValues);
    }
  };

  return (
    <div className="property-multiselect-wrapper" ref={wrapperRef}>
      <div 
        className={`property-multiselect-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <div className="property-multiselect-values">
          {selectedOptions.length === 0 ? (
            <span className="property-multiselect-placeholder">{placeholder}</span>
          ) : (
            selectedOptions.map(option => (
              <span 
                key={option.id}
                className="property-multiselect-tag"
                style={{ 
                  backgroundColor: option.color ? `${option.color}20` : undefined,
                  color: option.color || undefined
                }}
              >
                {option.value}
                <button 
                  className="property-multiselect-tag-remove"
                  onClick={(e) => handleRemove(e, option.id)}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <span className="property-multiselect-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="property-multiselect-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="property-multiselect-search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="property-multiselect-options">
            {filteredOptions.length === 0 ? (
              <div className="property-multiselect-empty">No options found</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = selectedValues.includes(option.id) || selectedValues.includes(option.value);
                return (
                  <div
                    key={option.id}
                    className={`property-multiselect-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggle(option)}
                  >
                    <span className="property-multiselect-checkbox">
                      {isSelected ? '✓' : ''}
                    </span>
                    <span 
                      className="property-multiselect-option-badge"
                      style={{ 
                        backgroundColor: option.color ? `${option.color}20` : undefined,
                        color: option.color || undefined
                      }}
                    >
                      {option.value}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
