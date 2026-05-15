import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { htmlToPlain } from '../utils/richText';

/**
 * contentEditable wrapper used by every text-supporting block.
 *
 * - Stores HTML so inline formatting (bold/italic/underline/strikethrough/
 *   color/link) can be persisted.
 * - Avoids resetting innerHTML on every render so the caret never jumps:
 *   we only sync DOM <- prop when the prop diverges from current DOM
 *   (e.g. block type change, slash-menu reset).
 */
export const RichTextInput = forwardRef(function RichTextInput(
  {
    html,
    onChange,
    onKeyDown,
    onFocus,
    onBlur,
    placeholder,
    className,
    autoFocus,
    spellCheck = true,
    multiline = true,
  },
  ref
) {
  const elRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = elRef.current;
      if (!el) return;
      el.focus();
      placeCaretAtEnd(el);
    },
    getElement: () => elRef.current,
  }), []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if ((el.innerHTML || '') !== (html || '')) {
      el.innerHTML = html || '';
    }
  }, [html]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = elRef.current;
    if (!el) return;
    el.focus();
    placeCaretAtEnd(el);
  }, [autoFocus]);

  const handleInput = (e) => {
    onChange?.(e.currentTarget.innerHTML);
  };

  const handleKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    if (text) {
      document.execCommand('insertText', false, text);
    }
  };

  const isEmpty = !html || html === '<br>' || htmlToPlain(html).trim() === '';

  return (
    <div
      ref={elRef}
      className={`${className || ''} richtext-input ${isEmpty ? 'empty' : ''}`}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ''}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={handlePaste}
      spellCheck={spellCheck}
      role="textbox"
    />
  );
});

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}
