/**
 * Notion-style pages: hierarchical pages with block-based editor.
 *
 * Page shape:
 * {
 *   id, parentId, title, icon, blocks, createdAt, updatedAt, expanded
 * }
 *
 * Block shape:
 * {
 *   id, type, text,
 *   // optional per-type:
 *   checked, language, emoji, body, collapsed
 * }
 */

export const BLOCK_TYPES = {
  PARAGRAPH: 'paragraph',
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  BULLET: 'bullet',
  NUMBERED: 'numbered',
  TODO: 'todo',
  QUOTE: 'quote',
  DIVIDER: 'divider',
  CODE: 'code',
  CALLOUT: 'callout',
  TOGGLE: 'toggle'
};

export const BLOCK_DEFINITIONS = [
  { type: BLOCK_TYPES.PARAGRAPH, label: 'Text',         icon: '¶',  hint: 'Plain text paragraph' },
  { type: BLOCK_TYPES.H1,        label: 'Heading 1',    icon: 'H1', hint: 'Large heading' },
  { type: BLOCK_TYPES.H2,        label: 'Heading 2',    icon: 'H2', hint: 'Medium heading' },
  { type: BLOCK_TYPES.H3,        label: 'Heading 3',    icon: 'H3', hint: 'Small heading' },
  { type: BLOCK_TYPES.BULLET,    label: 'Bulleted list',icon: '•',  hint: 'Bulleted list item' },
  { type: BLOCK_TYPES.NUMBERED,  label: 'Numbered list',icon: '1.', hint: 'Numbered list item' },
  { type: BLOCK_TYPES.TODO,      label: 'To-do',        icon: '☐',  hint: 'Task with checkbox' },
  { type: BLOCK_TYPES.QUOTE,     label: 'Quote',        icon: '❝',  hint: 'Blockquote' },
  { type: BLOCK_TYPES.CALLOUT,   label: 'Callout',      icon: '💡', hint: 'Highlighted note with icon' },
  { type: BLOCK_TYPES.TOGGLE,    label: 'Toggle',       icon: '▸',  hint: 'Collapsible block with body text' },
  { type: BLOCK_TYPES.CODE,      label: 'Code',         icon: '</>', hint: 'Code block' },
  { type: BLOCK_TYPES.DIVIDER,   label: 'Divider',      icon: '—',  hint: 'Horizontal divider' }
];

export function generatePageId() {
  return 'pg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function generateBlockId() {
  return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function createPage({ parentId = null, title = 'Untitled', icon = '📄' } = {}) {
  const now = Date.now();
  return {
    id: generatePageId(),
    parentId,
    title,
    icon,
    blocks: [createBlock(BLOCK_TYPES.PARAGRAPH)],
    createdAt: now,
    updatedAt: now,
    expanded: true,
    mastery: { level: 'none', reviewCount: 0, lastReviewed: null, nextReview: null }
  };
}

export function createBlock(type = BLOCK_TYPES.PARAGRAPH, text = '') {
  const base = { id: generateBlockId(), type, text };
  if (type === BLOCK_TYPES.TODO) base.checked = false;
  if (type === BLOCK_TYPES.CODE) base.language = 'plaintext';
  if (type === BLOCK_TYPES.CALLOUT) base.emoji = '💡';
  if (type === BLOCK_TYPES.TOGGLE) {
    base.body = '';
    base.collapsed = false;
  }
  return base;
}

/** Returns the direct children of a parent (parentId can be null for top-level). */
export function getChildPages(pages, parentId) {
  return (pages || []).filter((p) => (p.parentId || null) === (parentId || null));
}

/** Returns a tree-friendly map of children indexed by parentId. */
export function getChildrenMap(pages) {
  const map = new Map();
  for (const page of pages || []) {
    const key = page.parentId || '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(page);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  return map;
}

/** Returns the breadcrumb chain (root -> page) for a given page id. */
export function getPageBreadcrumb(pages, pageId) {
  const byId = new Map((pages || []).map((p) => [p.id, p]));
  const chain = [];
  let current = byId.get(pageId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return chain;
}

/** Recursively returns all descendant page ids of a given page id. */
export function getDescendantPageIds(pages, pageId) {
  const ids = [];
  const queue = [pageId];
  const childrenMap = getChildrenMap(pages);
  while (queue.length) {
    const current = queue.shift();
    const children = childrenMap.get(current) || [];
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

/** Detects markdown-style block type at the start of input.
 *  Returns { type, remaining } if matched, otherwise null.
 *  Used for inline shortcut conversion (e.g. typing "# " converts to h1).
 */
export function detectMarkdownShortcut(text) {
  const v = String(text || '');
  const map = [
    { re: /^#\s/,        type: BLOCK_TYPES.H1 },
    { re: /^##\s/,       type: BLOCK_TYPES.H2 },
    { re: /^###\s/,      type: BLOCK_TYPES.H3 },
    { re: /^[*\-•]\s/,   type: BLOCK_TYPES.BULLET },
    { re: /^\d+\.\s/,    type: BLOCK_TYPES.NUMBERED },
    { re: /^\[\s?\]\s/,  type: BLOCK_TYPES.TODO },
    { re: /^\[x\]\s/i,   type: BLOCK_TYPES.TODO },
    { re: /^>\s/,        type: BLOCK_TYPES.QUOTE },
    { re: /^---\s?$/,    type: BLOCK_TYPES.DIVIDER },
    { re: /^```\s?$/,    type: BLOCK_TYPES.CODE }
  ];
  for (const entry of map) {
    if (entry.re.test(v)) {
      return { type: entry.type, remaining: v.replace(entry.re, '') };
    }
  }
  return null;
}
