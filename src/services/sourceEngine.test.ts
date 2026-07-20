import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookSource } from '../types';
import { loadContent, loadToc, searchSource, validateSource } from './sourceEngine';

const htmlSource: BookSource = {
  id: 'test-html',
  name: '测试 HTML',
  baseUrl: 'https://books.test',
  enabled: true,
  search: {
    url: '/search?q={{keyword}}',
    type: 'html',
    list: '.book',
    name: '.name::text',
    author: '.author::text',
    bookUrl: 'a::attr(href)',
    cover: 'img::attr(src)',
  },
  toc: {
    url: '{{bookUrl}}',
    type: 'html',
    list: '.toc a',
    title: '::text',
    chapterUrl: '::attr(href)',
  },
  content: {
    url: '{{chapterUrl}}',
    type: 'html',
    body: '#content',
    remove: ['.ad'],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('source engine', () => {
  it('searches HTML, resolves relative URLs, loads toc and cleans content', async () => {
    const responses: Record<string, string> = {
      'https://books.test/search?q=%E9%A3%8E': '<div class="book"><a href="/book/1"><span class="name">风之书</span></a><span class="author">林野</span><img src="/cover.jpg"></div>',
      'https://books.test/book/1': '<nav class="toc"><a href="/chapter/1">第一章</a><a href="/chapter/2">第二章</a></nav>',
      'https://books.test/chapter/1': '<main id="content"><p>第一段。</p><div class="ad">广告</div><p>第二段。</p></main>',
    };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(responses[url] ?? '', { status: responses[url] ? 200 : 404 });
    }));

    const books = await searchSource(htmlSource, '风');
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ title: '风之书', author: '林野', url: 'https://books.test/book/1', cover: 'https://books.test/cover.jpg' });

    const chapters = await loadToc(htmlSource, books[0]);
    expect(chapters).toEqual([
      { title: '第一章', url: 'https://books.test/chapter/1' },
      { title: '第二章', url: 'https://books.test/chapter/2' },
    ]);

    const content = await loadContent(htmlSource, chapters[0]);
    expect(content).toContain('第一段。');
    expect(content).toContain('第二段。');
    expect(content).not.toContain('广告');
  });

  it('parses a JSONPath source and rejects incomplete sources', async () => {
    const source: BookSource = {
      ...htmlSource,
      id: 'test-json',
      search: {
        url: '/api/search?key={{keyword}}',
        type: 'json',
        list: '$.items[*]',
        name: '$.title',
        author: '$.author',
        bookUrl: '$.url',
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ title: '山海', author: '无名', url: '/b/9' }] }))));
    const books = await searchSource(source, '山');
    expect(books[0]).toMatchObject({ title: '山海', url: 'https://books.test/b/9' });
    expect(() => validateSource({ name: '坏书源' })).toThrow(/缺少/);
  });
});

