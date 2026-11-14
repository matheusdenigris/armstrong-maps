import { describe, expect, it } from 'vitest';

import { DOC_PAGES, DOC_TABS, docGroups, findDocPage, searchDocs } from './docs-pages';
import { GLOBAL_LAYERS } from './layers';
import { SITES } from './sites';
import { SOURCES } from './sources';

describe('docs pages', () => {
  it('gives every page its own id', () => {
    const ids = DOC_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a page for every data source, NASA ones marked', () => {
    for (const source of SOURCES) {
      const page = findDocPage(source.id);
      expect(page.id).toBe(source.id);
      expect(page.nasa).toBe(source.nasa);
    }
  });

  it('links cards only to pages that exist', () => {
    const ids = new Set(DOC_PAGES.map((page) => page.id));
    for (const page of DOC_PAGES) {
      for (const section of page.sections) {
        for (const block of section.blocks) {
          if (block.kind !== 'cards') continue;
          for (const item of block.items) if (item.page) expect(ids.has(item.page), item.page).toBe(true);
        }
      }
    }
  });

  it('opens the first page for an unknown address', () => {
    expect(findDocPage('nothing').id).toBe(DOC_PAGES[0].id);
  });

  it('fills every tab with grouped pages', () => {
    for (const tab of DOC_TABS) {
      const groups = docGroups(tab.id);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((group) => group.pages.length > 0)).toBe(true);
    }
  });
  it('links cards only to screens that exist', () => {
    const screens = new Set(SITES.map((site) => `/site/${site.id}`));
    for (const page of DOC_PAGES) {
      for (const section of page.sections) {
        for (const block of section.blocks) {
          if (block.kind !== 'cards') continue;
          for (const item of block.items) if (item.href) expect(screens.has(item.href), item.href).toBe(true);
        }
      }
    }
  });

  it('gives every section of a page its own id', () => {
    for (const page of DOC_PAGES) {
      const ids = page.sections.map((section) => section.id);
      expect(new Set(ids).size, page.id).toBe(ids.length);
    }
  });

  it('describes every layer of the whole planet and opens every site', () => {
    const layers = findDocPage('layers').sections.flatMap((section) =>
      section.blocks.flatMap((block) => (block.kind === 'layers' ? block.items : [])),
    );
    expect(layers.map((layer) => layer.name)).toEqual(GLOBAL_LAYERS.map((layer) => layer.name));

    const opened = findDocPage('sites').sections.flatMap((section) =>
      section.blocks.flatMap((block) => (block.kind === 'cards' ? block.items : [])),
    );
    expect(opened.map((item) => item.href)).toEqual(SITES.map((site) => `/site/${site.id}`));
  });

  it('searches everything a page says, with a match in the title first', () => {
    expect(searchDocs('  ')).toEqual([]);
    expect(searchDocs('thermal inertia').map((page) => page.id)).toContain('layers');
    expect(searchDocs('visor')[0].title.toLowerCase()).toContain('visor');
    expect(searchDocs('no page says this at all')).toEqual([]);
  });
});
