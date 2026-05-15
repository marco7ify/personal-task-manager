import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_DEFINITIONS } from '../utils/pages';

export function SlashMenu({ query, onPick, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    if (!q) return BLOCK_DEFINITIONS;
    return BLOCK_DEFINITIONS.filter(
      (b) => b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = filtered[activeIndex];
        if (pick) onPick(pick.type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [filtered, activeIndex, onPick, onClose]);

  if (filtered.length === 0) {
    return (
      <div className="slash-menu" ref={containerRef}>
        <div className="slash-menu-empty">No matching blocks</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" ref={containerRef} role="listbox">
      {filtered.map((b, idx) => (
        <button
          type="button"
          key={b.type}
          className={`slash-menu-item ${idx === activeIndex ? 'active' : ''}`}
          onMouseEnter={() => setActiveIndex(idx)}
          onClick={() => onPick(b.type)}
        >
          <span className="slash-menu-icon">{b.icon}</span>
          <span className="slash-menu-label">
            <span className="slash-menu-title">{b.label}</span>
            <span className="slash-menu-hint">{b.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
