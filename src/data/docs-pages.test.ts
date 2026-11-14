import { describe, expect, it } from 'vitest';

import { DOC_PAGES, DOC_TABS, docGroups, findDocPage } from './docs-pages';
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
});
