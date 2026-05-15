import { forwardRef, useEffect, useRef } from 'react';
import { BLOCK_TYPES } from '../utils/pages';
import { RichTextInput } from './RichTextInput';

/**
 * One editable block. Text-supporting blocks (paragraph, headings, lists,
 * todo, quote, callout, toggle title) use a contentEditable input so inline
 * formatting (bold/italic/underline/strike/color/link) can be applied via
 * the floating toolbar. Code blocks and toggle bodies stay as textareas.
 */
export const Block = forwardRef(function Block(
  {
    block,
    onChange,
    onKeyDown,
    onFocus,
    placeholder,
    autoFocus,
    onUpdateField
  },
  ref
) {
  const inputRef = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    if (block.type === BLOCK_TYPES.CODE) autoResize(codeRef.current);
  });

  const setRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  if (block.type === BLOCK_TYPES.DIVIDER) {
    return (
      <div
        className="block block-divider"
        tabIndex={0}
        onKeyDown={(e) => onKeyDown?.(e, block)}
        onFocus={onFocus}
        ref={setRef}
      >
        <hr />
      </div>
    );
  }

  const richInput = (
    <RichTextInput
      ref={setRef}
      className={`block-input block-input-${block.type}`}
      html={block.text || ''}
      placeholder={placeholder || getPlaceholder(block.type)}
      onChange={onChange}
      onKeyDown={(e) => onKeyDown?.(e, block)}
      onFocus={onFocus}
      autoFocus={autoFocus}
    />
  );

  if (block.type === BLOCK_TYPES.TODO) {
    return (
      <div className={`block block-todo ${block.checked ? 'checked' : ''}`}>
        <input
          type="checkbox"
          className="block-todo-checkbox"
          checked={!!block.checked}
          onChange={(e) => onUpdateField?.('checked', e.target.checked)}
        />
        {richInput}
      </div>
    );
  }

  if (block.type === BLOCK_TYPES.BULLET) {
    return (
      <div className="block block-bullet">
        <span className="block-bullet-marker">•</span>
        {richInput}
      </div>
    );
  }

  if (block.type === BLOCK_TYPES.NUMBERED) {
    return (
      <div className="block block-numbered">
        <span className="block-numbered-marker">{block.__index || 1}.</span>
        {richInput}
      </div>
    );
  }

  if (block.type === BLOCK_TYPES.QUOTE) {
    return <div className="block block-quote">{richInput}</div>;
  }

  if (block.type === BLOCK_TYPES.CODE) {
    return (
      <div className="block block-code">
        <div className="block-code-header">
          <input
            type="text"
            className="block-code-language"
            value={block.language || 'plaintext'}
            onChange={(e) => onUpdateField?.('language', e.target.value)}
            placeholder="language"
          />
        </div>
        <textarea
          ref={(el) => { codeRef.current = el; setRef(el); }}
          className="block-input block-input-code"
          value={block.text || ''}
          placeholder="// code"
          rows={3}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={(e) => onKeyDown?.(e, block)}
          onFocus={onFocus}
          spellCheck={false}
        />
      </div>
    );
  }

  if (block.type === BLOCK_TYPES.CALLOUT) {
    return (
      <div className="block block-callout">
        <input
          type="text"
          className="block-callout-emoji"
          value={block.emoji || '💡'}
          onChange={(e) => onUpdateField?.('emoji', e.target.value)}
          maxLength={3}
          aria-label="Callout icon"
        />
        {richInput}
      </div>
    );
  }

  if (block.type === BLOCK_TYPES.TOGGLE) {
    const collapsed = !!block.collapsed;
    return (
      <div className={`block block-toggle ${collapsed ? 'collapsed' : ''}`}>
        <div className="block-toggle-row">
          <button
            type="button"
            className="block-toggle-arrow"
            onClick={() => onUpdateField?.('collapsed', !collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          {richInput}
        </div>
        {!collapsed && (
          <textarea
            className="block-toggle-body"
            value={block.body || ''}
            placeholder="Toggle body... (collapsible)"
            rows={2}
            onChange={(e) => {
              onUpdateField?.('body', e.target.value);
              autoResize(e.target);
            }}
            ref={(el) => autoResize(el)}
          />
        )}
      </div>
    );
  }

  if (
    block.type === BLOCK_TYPES.H1 ||
    block.type === BLOCK_TYPES.H2 ||
    block.type === BLOCK_TYPES.H3
  ) {
    return <div className={`block block-${block.type}`}>{richInput}</div>;
  }

  return <div className="block block-paragraph">{richInput}</div>;
});

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function getPlaceholder(type) {
  switch (type) {
    case BLOCK_TYPES.H1:       return 'Heading 1';
    case BLOCK_TYPES.H2:       return 'Heading 2';
    case BLOCK_TYPES.H3:       return 'Heading 3';
    case BLOCK_TYPES.BULLET:   return 'List item';
    case BLOCK_TYPES.NUMBERED: return 'List item';
    case BLOCK_TYPES.TODO:     return 'To-do';
    case BLOCK_TYPES.QUOTE:    return 'Quote';
    case BLOCK_TYPES.CALLOUT:  return 'Callout text';
    case BLOCK_TYPES.TOGGLE:   return 'Toggle title';
    case BLOCK_TYPES.CODE:     return '// code';
    default:                   return "Type '/' for commands";
  }
}
