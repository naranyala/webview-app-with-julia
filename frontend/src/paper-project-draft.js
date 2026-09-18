function firstSection(project) {
  if (Array.isArray(project.sections) && project.sections.length > 0) {
    return project.sections[0];
  }
  return { id: 'introduction', title: 'Introduction', body: '' };
}

export function createPaperProjectDraft() {
  return {
    schemaVersion: 1,
    id: `paper-${Date.now()}`,
    title: 'Untitled paper',
    status: 'draft',
    authors: [{ name: 'Author' }],
    abstract: '',
    sections: [firstSection({})],
    references: [],
    tableOfContents: {
      schemaVersion: 1,
      mode: 'derived',
      entries: [
        {
          id: 'toc-introduction',
          sectionId: 'introduction',
          title: 'Introduction',
          level: 1,
          order: 1,
          visible: true,
        },
      ],
    },
    template: { id: 'default', version: '1' },
    exportProfiles: [],
    layout: {
      columns: 2,
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      fonts: {
        title: 'Helvetica',
        heading: 'Helvetica-Bold',
        body: 'Helvetica',
      },
    },
    source: { importedFrom: '', importedAt: '' },
  };
}

export function updatePaperField(project, field, value) {
  return { ...project, [field]: value };
}

export function updateFirstSection(project, field, value) {
  const sections = Array.isArray(project.sections) ? project.sections : [];
  const current = firstSection(project);
  return {
    ...project,
    sections: [{ ...current, [field]: value }, ...sections.slice(1)],
  };
}

export function updateSection(project, sectionId, field, value) {
  const sections = Array.isArray(project.sections) ? project.sections : [];
  return {
    ...project,
    sections: sections.map((section) =>
      section.id === sectionId ? { ...section, [field]: value } : section,
    ),
  };
}

export function addSection(project) {
  const sections = Array.isArray(project.sections) ? project.sections : [];
  const id = `section-${Date.now()}-${sections.length + 1}`;
  const section = { id, title: 'New section', body: '', level: 1 };
  const toc = project.tableOfContents || {
    schemaVersion: 1,
    mode: 'derived',
    entries: [],
  };
  const entries = Array.isArray(toc.entries) ? toc.entries : [];
  return {
    ...project,
    sections: [...sections, section],
    tableOfContents: {
      ...toc,
      entries: [
        ...entries,
        {
          id: `toc-${id}`,
          sectionId: id,
          title: section.title,
          level: 1,
          order: entries.length + 1,
          visible: true,
        },
      ],
    },
  };
}

export function removeSection(project, sectionId) {
  const sections = Array.isArray(project.sections) ? project.sections : [];
  if (sections.length <= 1) return project;
  const toc = project.tableOfContents || {};
  const entries = Array.isArray(toc.entries) ? toc.entries : [];
  return {
    ...project,
    sections: sections.filter((section) => section.id !== sectionId),
    tableOfContents: {
      ...toc,
      entries: entries.filter((entry) => entry.sectionId !== sectionId),
    },
  };
}

export function moveSection(project, sectionId, direction) {
  const sections = Array.isArray(project.sections) ? [...project.sections] : [];
  const index = sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return project;
  [sections[index], sections[target]] = [sections[target], sections[index]];
  const toc = project.tableOfContents || {};
  const entries = Array.isArray(toc.entries) ? [...toc.entries] : [];
  const order = new Map(
    sections.map((section, position) => [section.id, position + 1]),
  );
  entries.sort(
    (a, b) => (order.get(a.sectionId) || 0) - (order.get(b.sectionId) || 0),
  );
  return {
    ...project,
    sections,
    tableOfContents: {
      ...toc,
      entries: entries.map((entry, position) => ({
        ...entry,
        order: position + 1,
      })),
    },
  };
}

export function updateTableOfContentsEntry(project, entryId, field, value) {
  const toc = project.tableOfContents || {
    schemaVersion: 1,
    mode: 'manual',
    entries: [],
  };
  const entries = Array.isArray(toc.entries) ? toc.entries : [];
  return {
    ...project,
    tableOfContents: {
      ...toc,
      mode: 'manual',
      entries: entries.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry,
      ),
    },
  };
}

export function updateFirstTableOfContentsEntry(project, field, value) {
  const toc = project.tableOfContents || {
    schemaVersion: 1,
    mode: 'manual',
    entries: [],
  };
  const entries = Array.isArray(toc.entries) ? toc.entries : [];
  if (!entries.length) return project;
  return {
    ...project,
    tableOfContents: {
      ...toc,
      mode: 'manual',
      entries: [{ ...entries[0], [field]: value }, ...entries.slice(1)],
    },
  };
}
