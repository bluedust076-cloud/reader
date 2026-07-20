import { selectAll, selectOne } from 'css-select';
import { DomUtils, parseDocument } from 'htmlparser2';
import { JSONPath } from 'jsonpath-plus';
import { Book, BookSource, Chapter, ParseType } from '../types';

type Context = Record<string, string | number | undefined>;

const REQUEST_TIMEOUT_MS = 18_000;

function applyTemplate(template: string, context: Context): string {
  return template.replace(/{{\s*([\w]+)\s*}}/g, (_, key: string) => {
    const value = String(context[key] ?? '');
    return key === 'keyword' ? encodeURIComponent(value) : value;
  });
}

function absoluteUrl(value: string, baseUrl: string, requestUrl?: string): string {
  if (!value) return '';
  try {
    return new URL(value, requestUrl || baseUrl).toString();
  } catch {
    return value;
  }
}

async function request(source: BookSource, template: string, context: Context): Promise<{ data: string; url: string }> {
  const rendered = applyTemplate(template, { baseUrl: source.baseUrl, ...context });
  const url = absoluteUrl(rendered, source.baseUrl);
  if (!/^https?:\/\//i.test(url)) throw new Error('书源请求只支持 http 或 https 地址');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: source.headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { data: await response.text(), url };
  } finally {
    clearTimeout(timer);
  }
}

function splitHtmlSelector(expression: string): { css: string; attr?: string; text: boolean } {
  const value = expression.trim();
  const attr = value.match(/::attr\(([^)]+)\)\s*$/);
  if (attr) return { css: value.slice(0, attr.index).trim() || ':scope', attr: attr[1].trim(), text: false };
  if (value.endsWith('::text')) return { css: value.slice(0, -6).trim() || ':scope', text: true };
  return { css: value || ':scope', text: true };
}

function htmlValue(node: any, expression: string): string {
  const parsed = splitHtmlSelector(expression);
  const target = parsed.css === ':scope' ? node : selectOne(parsed.css, node) ?? undefined;
  if (!target) return '';
  if (parsed.attr) return String(target.attribs?.[parsed.attr] ?? '').trim();
  return DomUtils.innerText(target).replace(/\s+/g, ' ').trim();
}

function jsonValue(node: unknown, expression: string): string {
  if (!expression.trim()) return '';
  const value = JSONPath({ path: expression, json: node as object, wrap: false }) as unknown;
  if (Array.isArray(value)) return value.map(String).join(' ');
  return value == null ? '' : String(value).trim();
}

function parseList(data: string, type: ParseType, expression: string): unknown[] {
  if (type === 'json') {
    const json = JSON.parse(data) as object;
    const result = JSONPath({ path: expression, json, wrap: true }) as unknown[];
    return result.flatMap((value) => (Array.isArray(value) ? value : [value]));
  }
  const document = parseDocument(data);
  return selectAll(expression, document.children as any);
}

function valueFor(type: ParseType, node: unknown, expression: string): string {
  return type === 'json' ? jsonValue(node, expression) : htmlValue(node, expression);
}

export async function searchSource(source: BookSource, keyword: string): Promise<Book[]> {
  const response = await request(source, source.search.url, { keyword });
  const nodes = parseList(response.data, source.search.type, source.search.list);

  return nodes
    .map((node, index): Book | null => {
      const title = valueFor(source.search.type, node, source.search.name);
      const bookUrl = absoluteUrl(valueFor(source.search.type, node, source.search.bookUrl), source.baseUrl, response.url);
      if (!title || !bookUrl) return null;
      const timestamp = Date.now();
      return {
        id: `${source.id}:${bookUrl}`,
        sourceId: source.id,
        title,
        author: valueFor(source.search.type, node, source.search.author) || '未知作者',
        url: bookUrl,
        cover: source.search.cover
          ? absoluteUrl(valueFor(source.search.type, node, source.search.cover), source.baseUrl, response.url)
          : undefined,
        intro: source.search.intro ? valueFor(source.search.type, node, source.search.intro) : undefined,
        addedAt: timestamp + index,
        progress: { chapterIndex: 0, chapterPercent: 0, updatedAt: timestamp },
      };
    })
    .filter((book): book is Book => Boolean(book));
}

export async function loadToc(source: BookSource, book: Book): Promise<Chapter[]> {
  const response = await request(source, source.toc.url, { bookUrl: book.url });
  const nodes = parseList(response.data, source.toc.type, source.toc.list);
  return nodes
    .map((node): Chapter | null => {
      const title = valueFor(source.toc.type, node, source.toc.title);
      const url = absoluteUrl(valueFor(source.toc.type, node, source.toc.chapterUrl), source.baseUrl, response.url);
      return title && url ? { title, url } : null;
    })
    .filter((chapter): chapter is Chapter => Boolean(chapter));
}

export async function loadContent(source: BookSource, chapter: Chapter): Promise<string> {
  const response = await request(source, source.content.url, { chapterUrl: chapter.url });
  if (source.content.type === 'json') {
    return jsonValue(JSON.parse(response.data), source.content.body)
      .replace(/(?:\r?\n\s*){3,}/g, '\n\n')
      .trim();
  }

  const document = parseDocument(response.data);
  const target = selectOne(source.content.body, document.children as any);
  if (!target) throw new Error('正文选择器没有匹配到内容');
  for (const selector of source.content.remove ?? []) {
    for (const node of selectAll(selector, target as any)) DomUtils.removeElement(node as any);
  }
  return DomUtils.innerText(target as any)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/(?:\r?\n\s*){3,}/g, '\n\n')
    .trim();
}

export function validateSource(value: unknown): BookSource {
  const source = value as Partial<BookSource>;
  if (!source || typeof source !== 'object') throw new Error('书源必须是 JSON 对象');
  if (!source.name || !source.baseUrl || !source.search || !source.toc || !source.content) {
    throw new Error('缺少 name、baseUrl、search、toc 或 content');
  }
  for (const rule of [source.search, source.toc, source.content]) {
    if (rule.type !== 'html' && rule.type !== 'json') throw new Error('规则 type 只能是 html 或 json');
  }
  return {
    ...(source as BookSource),
    id: source.id || `source-${Date.now()}`,
    enabled: source.enabled ?? true,
  };
}

