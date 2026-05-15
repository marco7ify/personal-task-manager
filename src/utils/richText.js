/**
 * Rich-text helpers for the contentEditable block editor.
 * - Block text is stored as HTML so inline formatting (bold/italic/underline/
 *   strikethrough/color/link) can be persisted.
 * - Plain text from older versions is HTML-escaped on load.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function htmlToPlain(html) {
  if (typeof html !== 'string') return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

/** Detects HTML formatting markers so we know whether a string was already HTML. */
export function looksLikeHtml(value) {
  if (typeof value !== 'string') return false;
  if (!value) return false;
  return /<\s*(b|i|u|strong|em|span|a|br|s|strike)/i.test(value) || /&[a-z]+;/i.test(value);
}

/** Used during one-time migration from plain text -> HTML. */
export function ensureHtml(value) {
  if (typeof value !== 'string') return '';
  return looksLikeHtml(value) ? value : escapeHtml(value);
}

/** Caret offset (textContent index) within an element. Useful to detect
 *  "caret at start/end" inside contentEditable, since they don't expose
 *  selectionStart/selectionEnd.
 */
export function getCaretOffset(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  if (!element) return 0;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(element);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

/** Sets caret to a specific offset (textContent index) inside an element. */
export function setCaretOffset(element, offset) {
  if (!element) return;
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  let remaining = offset;
  let placed = false;

  const walk = (node) => {
    if (placed) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.length;
      if (remaining <= len) {
        range.setStart(node, Math.max(0, Math.min(remaining, len)));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        placed = true;
        return;
      }
      remaining -= len;
    } else {
      for (const child of node.childNodes) {
        walk(child);
        if (placed) return;
      }
    }
  };

  walk(element);

  if (!placed) {
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/** Replace current selection with a link wrapping the selected text. */
export function applyLinkToSelection(url) {
  if (!url) return;
  document.execCommand('createLink', false, url);
  // Ensure links open in a new tab.
  const sel = window.getSelection();
  if (sel && sel.anchorNode) {
    let node = sel.anchorNode.parentElement;
    while (node && node.tagName !== 'A') node = node.parentElement;
    if (node && node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/** Returns true when a non-empty selection exists inside an element matching
 *  the given selector tree (e.g. a `.page-view`).
 */
export function getSelectionInsideContainer(container) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container || !container.contains(range.commonAncestorContainer)) return null;
  return { selection: sel, range };
}
