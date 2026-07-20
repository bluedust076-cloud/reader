export type ParseType = 'html' | 'json';

export interface SearchRule {
  url: string;
  type: ParseType;
  list: string;
  name: string;
  author: string;
  bookUrl: string;
  cover?: string;
  intro?: string;
}

export interface TocRule {
  url: string;
  type: ParseType;
  list: string;
  title: string;
  chapterUrl: string;
}

export interface ContentRule {
  url: string;
  type: ParseType;
  body: string;
  remove?: string[];
}

export interface BookSource {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  headers?: Record<string, string>;
  search: SearchRule;
  toc: TocRule;
  content: ContentRule;
}

export interface Chapter {
  title: string;
  url: string;
  content?: string;
}

export interface ReadingProgress {
  chapterIndex: number;
  chapterPercent: number;
  updatedAt: number;
}

export interface Book {
  id: string;
  sourceId: string;
  title: string;
  author: string;
  url: string;
  cover?: string;
  intro?: string;
  chapters?: Chapter[];
  progress: ReadingProgress;
  addedAt: number;
}

export type ReaderTheme = 'paper' | 'light' | 'dark';

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
}

export interface AppData {
  books: Book[];
  sources: BookSource[];
  settings: ReaderSettings;
}

