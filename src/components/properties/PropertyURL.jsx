import { useState, useEffect, useRef } from 'react';

export function PropertyURL({ value, onChange, placeholder = 'https://...', autoFocus = false }) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      // Basic URL validation/normalization
      let normalizedUrl = localValue.trim();
      if (normalizedUrl && !normalizedUrl.match(/^https?:\/\//)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      onChange(normalizedUrl || null);
      setLocalValue(normalizedUrl);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value || '');
      setIsEditing(false);
    }
  };

  const getDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getFavicon = (url) => {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } catch {
      return null;
    }
  };

  if (isEditing || !value) {
    return (
      <div className="property-url-wrapper">
        <input
          ref={inputRef}
          type="url"
          className="property-url-input"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </div>
    );
  }

  const favicon = getFavicon(value);
  const domain = getDomain(value);

  return (
    <div className="property-url-wrapper property-url-display">
      <a 
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="property-url-link"
        onClick={(e) => e.stopPropagation()}
      >
        {favicon && (
          <img 
            src={favicon} 
            alt="" 
            className="property-url-favicon"
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        <span className="property-url-domain">{domain}</span>
        <span className="property-url-icon">↗</span>
      </a>
      <button 
        className="property-url-edit"
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        title="Edit URL"
      >
        ✏️
      </button>
      <button 
        className="property-url-clear"
        onClick={(e) => { e.stopPropagation(); onChange(null); }}
        title="Clear URL"
      >
        ×
      </button>
    </div>
  );
}
