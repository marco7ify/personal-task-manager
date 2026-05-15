const BULLET_RE = /^(\s*)(?:[-*•]|\d+\.)\s+(?:\[[ xX]\]\s*)?(.+)$/;
const SECTION_RE = /^#{2,}\s+(.+)$/;

import { BLOCK_TYPES, createBlock, createPage } from './pages';

function cleanMarkdown(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/__+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseHeading(trimmedLine) {
  const match = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    title: cleanMarkdown(match[2])
  };
}

function parseProjectName(trimmedLine) {
  const normalized = cleanMarkdown(trimmedLine);
  if (!normalized) return null;

  const markdownMatch = normalized.match(/^#+\s*Project(?:\s+\d+)?\s*:\s*(.+)$/i);
  if (markdownMatch) return cleanMarkdown(markdownMatch[1]);

  const plainMatch = normalized.match(/^Project(?:\s+\d+)?\s*:\s*(.+)$/i);
  if (plainMatch) return cleanMarkdown(plainMatch[1]);

  return null;
}

function parseNotebookName(trimmedLine) {
  const normalized = cleanMarkdown(trimmedLine);
  if (!normalized) return null;

  const markdownMatch = normalized.match(/^#+\s*Notebook(?:\s+\d+)?\s*:\s*(.+)$/i);
  if (markdownMatch) return cleanMarkdown(markdownMatch[1]);

  const plainMatch = normalized.match(/^Notebook(?:\s+\d+)?\s*:\s*(.+)$/i);
  if (plainMatch) return cleanMarkdown(plainMatch[1]);

  return null;
}

function parsePageHeading(trimmedLine) {
  const heading = parseHeading(trimmedLine);
  if (!heading || heading.level < 2) return null;
  const pageMatch = heading.title.match(/^Page(?:\s+\d+)?\s*:\s*(.+)$/i);
  return {
    level: heading.level,
    title: pageMatch ? cleanMarkdown(pageMatch[1]) : heading.title
  };
}

function formatTaskText(section, task) {
  const base = task.title;
  return base;
}

function createNoteBlockFromLine(rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed || /^Text\s*:\s*$/i.test(trimmed)) return null;

  const bulletMatch = rawLine.match(BULLET_RE);
  if (bulletMatch) {
    return {
      type: BLOCK_TYPES.BULLET,
      text: escapeHtml(cleanMarkdown(bulletMatch[2]))
    };
  }

  const heading = parseHeading(trimmed);
  if (heading) {
    const type = heading.level === 2
      ? BLOCK_TYPES.H2
      : heading.level === 3
        ? BLOCK_TYPES.H3
        : BLOCK_TYPES.PARAGRAPH;
    return {
      type,
      text: escapeHtml(heading.title)
    };
  }

  return {
    type: BLOCK_TYPES.PARAGRAPH,
    text: escapeHtml(trimmed)
  };
}

export function parseImportedTaskText(input) {
  const projects = [];
  const notebooks = [];
  const lines = String(input || '').replace(/\r\n?/g, '\n').split('\n');
  let currentProject = null;
  let currentSection = '';
  let lastTask = null;
  let currentNotebook = null;
  let currentNotePage = null;
  let notePageStack = [];
  let mode = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const projectName = parseProjectName(trimmed);
    if (projectName) {
      mode = 'project';
      currentProject = {
        name: projectName,
        tasks: []
      };
      projects.push(currentProject);
      currentSection = '';
      lastTask = null;
      currentNotebook = null;
      currentNotePage = null;
      notePageStack = [];
      continue;
    }

    const notebookName = parseNotebookName(trimmed);
    if (notebookName) {
      mode = 'notebook';
      currentNotebook = {
        name: notebookName,
        blocks: [],
        pages: []
      };
      notebooks.push(currentNotebook);
      currentProject = null;
      currentSection = '';
      lastTask = null;
      currentNotePage = null;
      notePageStack = [];
      continue;
    }

    if (mode === 'notebook' && currentNotebook) {
      const pageHeading = parsePageHeading(trimmed);
      if (pageHeading) {
        const page = {
          title: pageHeading.title,
          level: pageHeading.level,
          blocks: [],
          pages: []
        };
        while (
          notePageStack.length > 0 &&
          notePageStack[notePageStack.length - 1].level >= pageHeading.level
        ) {
          notePageStack.pop();
        }
        const parent = notePageStack[notePageStack.length - 1];
        if (parent) parent.pages.push(page);
        else currentNotebook.pages.push(page);
        notePageStack.push(page);
        currentNotePage = page;
        continue;
      }

      const block = createNoteBlockFromLine(rawLine);
      if (block) {
        if (currentNotePage) currentNotePage.blocks.push(block);
        else currentNotebook.blocks.push(block);
      }
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_RE);
    if (mode === 'project' && sectionMatch && currentProject) {
      currentSection = cleanMarkdown(sectionMatch[1]);
      lastTask = null;
      continue;
    }

    const bulletMatch = rawLine.match(BULLET_RE);
    if (!bulletMatch || mode !== 'project' || !currentProject) continue;

    const indent = bulletMatch[1].length;
    const text = cleanMarkdown(bulletMatch[2]);
    if (!text) continue;

    if (indent > 0 && lastTask) {
      lastTask.details.push(text);
      continue;
    }

    lastTask = {
      title: text,
      section: currentSection,
      details: []
    };
    currentProject.tasks.push(lastTask);
  }

  const normalizedProjects = projects
    .map((project) => ({
      name: project.name,
      tasks: project.tasks.map((task) => ({
        text: formatTaskText(task.section, task),
        subfolder: task.section || null,
        subtasks: task.details.map((detail) => ({ text: detail, done: false }))
      }))
    }))
    .filter((project) => project.name && project.tasks.length > 0);

  const normalizeNotePage = (page) => ({
    title: page.title || 'Untitled Page',
    blocks: page.blocks,
    pages: (page.pages || []).map(normalizeNotePage)
  });

  const normalizedNotebooks = notebooks
    .map((notebook) => ({
      name: notebook.name,
      blocks: notebook.blocks,
      pages: (notebook.pages || []).map(normalizeNotePage)
    }))
    .filter(
      (notebook) =>
        notebook.name &&
        (notebook.blocks.length > 0 || notebook.pages.length > 0)
    );

  const pageCountFor = (pages = []) =>
    pages.reduce((total, page) => total + 1 + pageCountFor(page.pages), 0);
  const blockCountFor = (pages = []) =>
    pages.reduce((total, page) => total + page.blocks.length + blockCountFor(page.pages), 0);

  const errors = [];
  if (normalizedProjects.length === 0 && normalizedNotebooks.length === 0) {
    errors.push('No importable projects or notebooks were found. Use "# Project: Name" for tasks or "# Notebook: Name" for notes.');
  }

  return {
    projects: normalizedProjects,
    notebooks: normalizedNotebooks,
    errors,
    projectCount: normalizedProjects.length,
    taskCount: normalizedProjects.reduce((total, project) => total + project.tasks.length, 0),
    notebookCount: normalizedNotebooks.length,
    pageCount: normalizedNotebooks.reduce((total, notebook) => total + pageCountFor(notebook.pages), 0),
    noteBlockCount: normalizedNotebooks.reduce(
      (total, notebook) => total + notebook.blocks.length + blockCountFor(notebook.pages),
      0
    )
  };
}

export function mergeImportedTasks(store, parsedImport) {
  const now = Date.now();
  let sequence = 0;
  let projectsCreated = 0;
  let projectsReused = 0;
  let tasksAdded = 0;
  let notebooksCreated = 0;
  let pagesCreated = 0;

  for (const importedProject of parsedImport.projects) {
    const existingProject = store.projects.find(
      (project) => project.name.trim().toLowerCase() === importedProject.name.trim().toLowerCase()
    );

    const project = existingProject || {
      id: `p${now + sequence++}`,
      name: importedProject.name,
      icon: '📁',
      color: '#2383E2',
      customProps: {},
      showInboxBadge: store.settings.defaultShowInboxBadge !== false,
      showTodayBadge: store.settings.defaultShowTodayBadge !== false
    };

    if (existingProject) {
      projectsReused += 1;
    } else {
      store.projects.push(project);
      projectsCreated += 1;
    }

    for (const importedTask of importedProject.tasks) {
      store.items.push({
        id: now + sequence++,
        text: importedTask.text,
        type: 'task',
        priority: 'low',
        pid: project.id,
        subfolder: importedTask.subfolder || null,
        subtasks: Array.isArray(importedTask.subtasks) ? importedTask.subtasks : [],
        date: null,
        time: null,
        recurrence: 'none',
        recurDetails: null,
        done: false,
        archived: false,
        reschedule: false,
        createdAt: now + sequence++,
        customProps: {}
      });
      tasksAdded += 1;
    }
  }

  const buildBlocks = (blocks) => {
    const normalized = (blocks || [])
      .map((block) => createBlock(block.type || BLOCK_TYPES.PARAGRAPH, block.text || ''))
      .filter(Boolean);
    return normalized.length > 0 ? normalized : [createBlock(BLOCK_TYPES.PARAGRAPH)];
  };

  const addImportedPage = (importedPage, parentId, icon = '📄') => {
    const page = createPage({
      parentId,
      title: importedPage.title || 'Untitled Page',
      icon
    });
    page.blocks = buildBlocks(importedPage.blocks);
    page.createdAt = now + sequence++;
    page.updatedAt = page.createdAt;
    store.pages.push(page);
    pagesCreated += 1;

    for (const child of importedPage.pages || []) {
      addImportedPage(child, page.id);
    }

    return page;
  };

  if (!Array.isArray(store.pages)) store.pages = [];
  for (const importedNotebook of parsedImport.notebooks || []) {
    const notebook = createPage({
      title: importedNotebook.name || 'Untitled Notebook',
      icon: '📓'
    });
    notebook.blocks = buildBlocks(importedNotebook.blocks);
    notebook.createdAt = now + sequence++;
    notebook.updatedAt = notebook.createdAt;
    store.pages.push(notebook);
    notebooksCreated += 1;

    for (const page of importedNotebook.pages || []) {
      addImportedPage(page, notebook.id);
    }
  }

  store.save();

  return {
    projectsCreated,
    projectsReused,
    tasksAdded,
    notebooksCreated,
    pagesCreated
  };
}
