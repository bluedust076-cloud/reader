import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initialData, sourceTemplate } from './src/data/sample';
import { loadContent, loadToc, searchSource, validateSource } from './src/services/sourceEngine';
import { loadData, saveData } from './src/services/storage';
import { AppData, Book, BookSource, Chapter, ReaderSettings, ReaderTheme } from './src/types';

type Tab = 'shelf' | 'discover' | 'sources';

const palette = {
  ink: '#22211E',
  muted: '#78746C',
  paper: '#F5F0E6',
  card: '#FFFCF7',
  green: '#315C49',
  greenSoft: '#DDE8E0',
  line: '#E5DED2',
  danger: '#A7463C',
};

const sourceJsonTemplate = JSON.stringify(
  { ...sourceTemplate, id: `source-${Date.now()}`, name: '我的书源', enabled: true },
  null,
  2,
);

function AppContent() {
  const [data, setData] = useState<AppData | null>(null);
  const [tab, setTab] = useState<Tab>('shelf');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  useEffect(() => {
    loadData().then(setData).catch(() => setData(initialData));
  }, []);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => void saveData(data), 250);
    return () => clearTimeout(timer);
  }, [data]);

  const updateBook = useCallback((id: string, update: (book: Book) => Book) => {
    setData((current) =>
      current ? { ...current, books: current.books.map((book) => (book.id === id ? update(book) : book)) } : current,
    );
  }, []);

  if (!data) {
    return (
      <View style={styles.loadingPage}>
        <Text style={styles.brandMark}>阅</Text>
        <ActivityIndicator color={palette.green} />
      </View>
    );
  }

  const activeBook = data.books.find((book) => book.id === activeBookId);
  if (activeBook) {
    return (
      <ReaderView
        book={activeBook}
        source={data.sources.find((source) => source.id === activeBook.sourceId)}
        settings={data.settings}
        onClose={() => setActiveBookId(null)}
        onUpdateBook={(update) => updateBook(activeBook.id, update)}
        onUpdateSettings={(settings) => setData((current) => (current ? { ...current, settings } : current))}
      />
    );
  }

  return (
    <SafeAreaView style={styles.appShell}>
      <StatusBar style="dark" />
      <View style={styles.pageBody}>
        {tab === 'shelf' && (
          <ShelfScreen
            books={data.books}
            onOpen={(book) => setActiveBookId(book.id)}
            onRemove={(book) => {
              Alert.alert('移出书架', `确定移除《${book.title}》吗？`, [
                { text: '取消', style: 'cancel' },
                {
                  text: '移除',
                  style: 'destructive',
                  onPress: () => setData((current) => ({ ...current!, books: current!.books.filter((b) => b.id !== book.id) })),
                },
              ]);
            }}
          />
        )}
        {tab === 'discover' && (
          <DiscoverScreen
            sources={data.sources.filter((source) => source.enabled)}
            shelfIds={new Set(data.books.map((book) => book.id))}
            onAdd={(book) => setData((current) => ({ ...current!, books: [book, ...current!.books] }))}
          />
        )}
        {tab === 'sources' && (
          <SourcesScreen
            sources={data.sources}
            onChange={(sources) => setData((current) => ({ ...current!, sources }))}
          />
        )}
      </View>
      <TabBar tab={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function PageHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      {detail ? <Text style={styles.pageDetail}>{detail}</Text> : null}
    </View>
  );
}

function ShelfScreen({ books, onOpen, onRemove }: { books: Book[]; onOpen: (book: Book) => void; onRemove: (book: Book) => void }) {
  return (
    <FlatList
      data={books}
      keyExtractor={(book) => book.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<PageHeader eyebrow="PURE READING" title="我的书架" detail={`${books.length} 本书 · 所有进度仅保存在设备上`} />}
      ListEmptyComponent={<EmptyState title="书架还是空的" detail="前往“找书”搜索已启用的自定义书源。" />}
      renderItem={({ item }) => {
        const total = item.chapters?.length ?? 0;
        const progress = total ? Math.min(100, Math.round(((item.progress.chapterIndex + item.progress.chapterPercent) / total) * 100)) : 0;
        return (
          <TouchableOpacity style={styles.bookCard} activeOpacity={0.82} onPress={() => onOpen(item)} onLongPress={() => onRemove(item)}>
            <BookCover book={item} />
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.bookAuthor}>{item.author}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              <Text style={styles.bookMeta}>{total ? `读到第 ${item.progress.chapterIndex + 1} 章 · ${progress}%` : '尚未获取目录'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function BookCover({ book }: { book: Book }) {
  if (book.cover) return <Image source={{ uri: book.cover }} style={styles.cover as any} />;
  return (
    <View style={styles.coverFallback}>
      <Text style={styles.coverGlyph}>阅</Text>
      <Text style={styles.coverName} numberOfLines={3}>{book.title}</Text>
    </View>
  );
}

function DiscoverScreen({ sources, shelfIds, onAdd }: { sources: BookSource[]; shelfIds: Set<string>; onAdd: (book: Book) => void }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const search = async () => {
    if (!keyword.trim()) return;
    if (!sources.length) {
      setMessage('请先在“书源”中导入并启用至少一个书源。');
      return;
    }
    setLoading(true);
    setMessage('');
    const settled = await Promise.allSettled(sources.map((source) => searchSource(source, keyword.trim())));
    const books = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const failures = settled.filter((result) => result.status === 'rejected').length;
    setResults(books);
    setMessage(books.length ? `${books.length} 条结果${failures ? ` · ${failures} 个书源请求失败` : ''}` : `没有找到结果${failures ? `，${failures} 个书源请求失败` : ''}`);
    setLoading(false);
  };

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <PageHeader eyebrow="DISCOVER" title="找书" detail={sources.length ? `将搜索 ${sources.length} 个已启用书源` : '尚无已启用书源'} />
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="输入书名或作者"
              placeholderTextColor="#9B978F"
              returnKeyType="search"
              onSubmitEditing={() => void search()}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={() => void search()} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>搜索</Text>}
            </TouchableOpacity>
          </View>
          {message ? <Text style={styles.resultMessage}>{message}</Text> : null}
        </View>
      }
      ListEmptyComponent={!loading && message ? <EmptyState title="换个关键词试试" detail="书源规则失效时，可在书源页更新选择器。" /> : null}
      renderItem={({ item }) => {
        const added = shelfIds.has(item.id);
        return (
          <View style={styles.resultCard}>
            <BookCover book={item} />
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.bookAuthor}>{item.author}</Text>
              {item.intro ? <Text style={styles.bookIntro} numberOfLines={2}>{item.intro}</Text> : null}
            </View>
            <TouchableOpacity style={[styles.smallButton, added && styles.smallButtonDisabled]} disabled={added} onPress={() => onAdd(item)}>
              <Text style={[styles.smallButtonText, added && styles.smallButtonTextDisabled]}>{added ? '已加入' : '加入'}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

function SourcesScreen({ sources, onChange }: { sources: BookSource[]; onChange: (sources: BookSource[]) => void }) {
  const [editing, setEditing] = useState<BookSource | null | undefined>(undefined);
  const [jsonText, setJsonText] = useState(sourceJsonTemplate);
  const [error, setError] = useState('');

  const openEditor = (source?: BookSource) => {
    setEditing(source ?? null);
    setJsonText(source ? JSON.stringify(source, null, 2) : sourceJsonTemplate);
    setError('');
  };

  const save = () => {
    try {
      const source = validateSource(JSON.parse(jsonText));
      const next = editing ? sources.map((item) => (item.id === editing.id ? { ...source, id: editing.id } : item)) : [...sources, source];
      onChange(next);
      setEditing(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '书源 JSON 无效');
    }
  };

  const mergeSources = (incoming: BookSource[]) => {
    const ids = new Set(incoming.map((source) => source.id));
    onChange([...sources.filter((source) => !ids.has(source.id)), ...incoming]);
  };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        const imported = parsed.map(validateSource);
        mergeSources(imported);
        Alert.alert('导入成功', `已导入 ${imported.length} 个书源。`);
      } else {
        validateSource(parsed);
        setEditing(null);
        setJsonText(JSON.stringify(parsed, null, 2));
        setError('');
      }
    } catch (reason) {
      Alert.alert('导入失败', reason instanceof Error ? reason.message : '无法读取这个书源文件');
    }
  };

  const exportSources = async () => {
    try {
      if (!sources.length) throw new Error('目前没有可导出的书源');
      if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享面板');
      const file = new File(Paths.cache, `pure-reader-sources-${Date.now()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(sources, null, 2));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: '导出纯阅书源',
      });
    } catch (reason) {
      Alert.alert('导出失败', reason instanceof Error ? reason.message : '无法导出书源');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="SOURCES" title="自定义书源" detail="支持 HTML CSS 选择器与 JSONPath；规则保存在本机。" />
      <TouchableOpacity style={styles.addSourceButton} onPress={() => void importFile()}>
        <Text style={styles.addSourcePlus}>＋</Text><Text style={styles.addSourceText}>从“文件”导入 JSON</Text>
      </TouchableOpacity>
      <View style={styles.sourceActions}>
        <TouchableOpacity style={styles.sourceActionButton} onPress={() => openEditor()}>
          <Text style={styles.sourceActionText}>新建 / 粘贴</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sourceActionButton} onPress={() => void exportSources()}>
          <Text style={styles.sourceActionText}>导出备份</Text>
        </TouchableOpacity>
      </View>
      {sources.map((source) => (
        <TouchableOpacity key={source.id} style={styles.sourceCard} activeOpacity={0.84} onPress={() => openEditor(source)}>
          <View style={styles.sourceAvatar}><Text style={styles.sourceAvatarText}>{source.name.slice(0, 1)}</Text></View>
          <View style={styles.sourceInfo}>
            <Text style={styles.sourceName}>{source.name}</Text>
            <Text style={styles.sourceUrl} numberOfLines={1}>{source.baseUrl}</Text>
            <Text style={styles.sourceType}>{source.search.type.toUpperCase()} · 点击编辑规则</Text>
          </View>
          <Switch
            value={source.enabled}
            trackColor={{ false: '#D8D4CD', true: '#91AE9D' }}
            thumbColor={source.enabled ? palette.green : '#F6F3EE'}
            onValueChange={(enabled) => onChange(sources.map((item) => (item.id === source.id ? { ...item, enabled } : item)))}
          />
        </TouchableOpacity>
      ))}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>规则提示</Text>
        <Text style={styles.tipText}>模板变量：{'{{keyword}}'}、{'{{bookUrl}}'}、{'{{chapterUrl}}'}。HTML 属性写作 a::attr(href)，正文文本直接填写 CSS 选择器；JSON 规则使用 JSONPath。</Text>
        <Text style={styles.tipText}>只导入你信任并有权访问的内容来源。书源可以指定请求头，也能访问你在局域网中自建的服务。</Text>
      </View>

      <Modal visible={editing !== undefined} animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <SafeAreaView style={styles.modalPage}>
          <KeyboardAvoidingView style={styles.modalPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditing(undefined)}><Text style={styles.modalAction}>取消</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>{editing ? '编辑书源' : '导入书源'}</Text>
              <TouchableOpacity onPress={save}><Text style={[styles.modalAction, styles.modalSave]}>保存</Text></TouchableOpacity>
            </View>
            <TextInput
              style={styles.jsonEditor}
              value={jsonText}
              onChangeText={setJsonText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
              spellCheck={false}
            />
            {error ? <Text style={styles.editorError}>{error}</Text> : null}
            {editing ? (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => Alert.alert('删除书源', `确定删除“${editing.name}”吗？`, [
                  { text: '取消', style: 'cancel' },
                  { text: '删除', style: 'destructive', onPress: () => { onChange(sources.filter((source) => source.id !== editing.id)); setEditing(undefined); } },
                ])}
              >
                <Text style={styles.deleteText}>删除这个书源</Text>
              </TouchableOpacity>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function ReaderView({
  book,
  source,
  settings,
  onClose,
  onUpdateBook,
  onUpdateSettings,
}: {
  book: Book;
  source?: BookSource;
  settings: ReaderSettings;
  onClose: () => void;
  onUpdateBook: (update: (book: Book) => Book) => void;
  onUpdateSettings: (settings: ReaderSettings) => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [chapters, setChapters] = useState<Chapter[]>(book.chapters ?? []);
  const [index, setIndex] = useState(book.progress.chapterIndex ?? 0);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [controls, setControls] = useState(true);
  const [tocVisible, setTocVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const contentHeight = useRef(1);
  const viewportHeight = useRef(1);
  const pendingRestore = useRef(0);

  const colors = useMemo(() => {
    if (settings.theme === 'dark') return { background: '#171816', text: '#CAC8C1', dim: '#979891', chrome: '#222420' };
    if (settings.theme === 'light') return { background: '#FAFAF8', text: '#272824', dim: '#777870', chrome: '#FFFFFF' };
    return { background: '#F2EBDD', text: '#3B3933', dim: '#7D786E', chrome: '#FBF6EC' };
  }, [settings.theme]);

  const readChapter = useCallback(async (chapterIndex: number, available: Chapter[], restorePercent = 0) => {
    if (!available.length) return;
    const safeIndex = Math.max(0, Math.min(chapterIndex, available.length - 1));
    const chapter = available[safeIndex];
    setIndex(safeIndex);
    setLoading(true);
    setError('');
    setControls(false);
    pendingRestore.current = restorePercent;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    try {
      let text = chapter.content;
      if (!text) {
        if (!source) throw new Error('找不到这本书对应的书源，请重新导入书源');
        text = await loadContent(source, chapter);
        if (!text) throw new Error('正文为空，请检查书源正文规则');
        const cached = available.map((item, itemIndex) => (itemIndex === safeIndex ? { ...item, content: text } : item));
        setChapters(cached);
        available = cached;
      }
      setContent(text);
      onUpdateBook((current) => ({
        ...current,
        chapters: available,
        progress: { chapterIndex: safeIndex, chapterPercent: 0, updatedAt: Date.now() },
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '章节加载失败');
      setContent('');
    } finally {
      setLoading(false);
    }
  }, [onUpdateBook, source]);

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      try {
        let available = book.chapters ?? [];
        if (!available.length) {
          if (!source) throw new Error('找不到对应书源，无法获取目录');
          available = await loadToc(source, book);
          if (!available.length) throw new Error('目录为空，请检查书源目录规则');
          if (cancelled) return;
          setChapters(available);
          onUpdateBook((current) => ({ ...current, chapters: available }));
        }
        if (!cancelled) await readChapter(book.progress.chapterIndex ?? 0, available, book.progress.chapterPercent ?? 0);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '无法打开本书');
          setLoading(false);
        }
      }
    };
    void prepare();
    return () => { cancelled = true; };
    // This preparation intentionally runs once for the opened book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  const saveScrollProgress = (offsetY: number) => {
    const scrollable = Math.max(1, contentHeight.current - viewportHeight.current);
    const percent = Math.max(0, Math.min(1, offsetY / scrollable));
    onUpdateBook((current) => ({ ...current, progress: { chapterIndex: index, chapterPercent: percent, updatedAt: Date.now() } }));
  };

  return (
    <View style={[styles.readerPage, { backgroundColor: colors.background }]}>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} hidden={!controls} />
      <ScrollView
        ref={scrollRef}
        style={styles.readerScroll}
        contentContainerStyle={{ paddingTop: insets.top + 50, paddingBottom: insets.bottom + 100, paddingHorizontal: 26 }}
        scrollEventThrottle={300}
        onLayout={(event) => { viewportHeight.current = event.nativeEvent.layout.height; }}
        onContentSizeChange={(_, height) => {
          contentHeight.current = height;
          if (pendingRestore.current > 0) {
            const y = Math.max(0, height - viewportHeight.current) * pendingRestore.current;
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
            pendingRestore.current = 0;
          }
        }}
        onMomentumScrollEnd={(event) => saveScrollProgress(event.nativeEvent.contentOffset.y)}
      >
        <Pressable onPress={() => setControls((visible) => !visible)}>
          <Text style={[styles.readerBookName, { color: colors.dim }]}>{book.title}</Text>
          <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapters[index]?.title ?? '正在打开'}</Text>
          {loading ? <ActivityIndicator style={styles.readerLoader} color={colors.dim} /> : null}
          {error ? (
            <View style={styles.readerError}>
              <Text style={styles.readerErrorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void readChapter(index, chapters)}><Text style={styles.retryText}>重试</Text></TouchableOpacity>
            </View>
          ) : (
            <Text selectable style={[styles.readerText, { color: colors.text, fontSize: settings.fontSize, lineHeight: settings.fontSize * settings.lineHeight }]}>
              {content}
            </Text>
          )}
          {!loading && !error ? <Text style={[styles.chapterEnd, { color: colors.dim }]}>— 本章完 —</Text> : null}
        </Pressable>
      </ScrollView>

      {controls ? (
        <>
          <View style={[styles.readerTopBar, { paddingTop: insets.top, height: insets.top + 52, backgroundColor: colors.chrome }]}>
            <TouchableOpacity style={styles.readerTopButton} onPress={onClose}><Text style={[styles.readerBack, { color: colors.text }]}>‹</Text></TouchableOpacity>
            <Text style={[styles.readerTopTitle, { color: colors.text }]} numberOfLines={1}>{chapters[index]?.title ?? book.title}</Text>
            <View style={styles.readerTopButton} />
          </View>
          <View style={[styles.readerBottomBar, { paddingBottom: insets.bottom, height: insets.bottom + 82, backgroundColor: colors.chrome }]}>
            <ReaderBarButton label="上一章" disabled={index <= 0} color={colors.text} onPress={() => void readChapter(index - 1, chapters)} />
            <ReaderBarButton label="目录" color={colors.text} onPress={() => setTocVisible(true)} />
            <ReaderBarButton label="设置" color={colors.text} onPress={() => setSettingsVisible(true)} />
            <ReaderBarButton label="下一章" disabled={index >= chapters.length - 1} color={colors.text} onPress={() => void readChapter(index + 1, chapters)} />
          </View>
        </>
      ) : null}

      <Modal visible={tocVisible} transparent animationType="slide" onRequestClose={() => setTocVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTocVisible(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.chrome, paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>目录 · {chapters.length} 章</Text>
          <FlatList
            data={chapters}
            keyExtractor={(chapter, chapterIndex) => `${chapter.url}-${chapterIndex}`}
            initialScrollIndex={index > 4 ? index : undefined}
            getItemLayout={(_, itemIndex) => ({ length: 52, offset: 52 * itemIndex, index: itemIndex })}
            renderItem={({ item, index: itemIndex }) => (
              <TouchableOpacity style={styles.tocRow} onPress={() => { setTocVisible(false); void readChapter(itemIndex, chapters); }}>
                <Text style={[styles.tocIndex, { color: colors.dim }]}>{String(itemIndex + 1).padStart(2, '0')}</Text>
                <Text style={[styles.tocTitle, { color: itemIndex === index ? palette.green : colors.text }]} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSettingsVisible(false)} />
        <View style={[styles.settingsSheet, { backgroundColor: colors.chrome, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>阅读设置</Text>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.dim }]}>字号</Text>
            <TouchableOpacity style={styles.settingButton} onPress={() => onUpdateSettings({ ...settings, fontSize: Math.max(14, settings.fontSize - 1) })}><Text style={styles.settingButtonText}>A−</Text></TouchableOpacity>
            <Text style={[styles.settingValue, { color: colors.text }]}>{settings.fontSize}</Text>
            <TouchableOpacity style={styles.settingButton} onPress={() => onUpdateSettings({ ...settings, fontSize: Math.min(30, settings.fontSize + 1) })}><Text style={styles.settingButtonText}>A＋</Text></TouchableOpacity>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.dim }]}>行距</Text>
            {[1.55, 1.85, 2.15].map((lineHeight) => (
              <TouchableOpacity key={lineHeight} style={[styles.choiceButton, settings.lineHeight === lineHeight && styles.choiceButtonActive]} onPress={() => onUpdateSettings({ ...settings, lineHeight })}>
                <Text style={[styles.choiceText, settings.lineHeight === lineHeight && styles.choiceTextActive]}>{lineHeight === 1.55 ? '紧凑' : lineHeight === 1.85 ? '舒适' : '宽松'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.dim }]}>背景</Text>
            {([['paper', '#F2EBDD'], ['light', '#FAFAF8'], ['dark', '#171816']] as [ReaderTheme, string][]).map(([theme, background]) => (
              <TouchableOpacity key={theme} style={[styles.themeDot, { backgroundColor: background }, settings.theme === theme && styles.themeDotActive]} onPress={() => onUpdateSettings({ ...settings, theme })} />
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReaderBarButton({ label, onPress, disabled, color }: { label: string; onPress: () => void; disabled?: boolean; color: string }) {
  return <TouchableOpacity style={styles.readerBarButton} onPress={onPress} disabled={disabled}><Text style={[styles.readerBarIcon, { color, opacity: disabled ? 0.28 : 1 }]}>{label}</Text></TouchableOpacity>;
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; mark: string }[] = [
    { id: 'shelf', label: '书架', mark: '▥' },
    { id: 'discover', label: '找书', mark: '⌕' },
    { id: 'sources', label: '书源', mark: '◫' },
  ];
  return (
    <View style={styles.tabBar}>
      {items.map((item) => (
        <TouchableOpacity key={item.id} style={styles.tabItem} onPress={() => onChange(item.id)}>
          <Text style={[styles.tabMark, tab === item.id && styles.tabActive]}>{item.mark}</Text>
          <Text style={[styles.tabLabel, tab === item.id && styles.tabActive]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.emptyState}><Text style={styles.emptyMark}>◇</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: palette.paper },
  pageBody: { flex: 1 },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.paper, gap: 20 },
  brandMark: { width: 64, height: 64, borderRadius: 20, textAlign: 'center', lineHeight: 64, color: '#FFF', backgroundColor: palette.green, fontSize: 28, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  pageHeader: { paddingTop: 28, paddingBottom: 24 },
  eyebrow: { color: palette.green, fontSize: 11, letterSpacing: 2.2, fontWeight: '700', marginBottom: 8 },
  pageTitle: { color: palette.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  pageDetail: { color: palette.muted, fontSize: 13, marginTop: 8 },
  bookCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  cover: { width: 68, height: 94, borderRadius: 8, backgroundColor: '#DED9D0' },
  coverFallback: { width: 68, height: 94, borderRadius: 8, backgroundColor: palette.green, padding: 8, justifyContent: 'space-between' },
  coverGlyph: { color: '#DDE9E1', fontSize: 11, borderWidth: 1, borderColor: '#8CAB99', width: 22, height: 22, textAlign: 'center', lineHeight: 20, borderRadius: 11 },
  coverName: { color: '#FFF', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  bookInfo: { flex: 1, paddingHorizontal: 14 },
  bookTitle: { color: palette.ink, fontSize: 17, fontWeight: '600', lineHeight: 23 },
  bookAuthor: { color: palette.muted, fontSize: 12, marginTop: 5 },
  bookMeta: { color: palette.muted, fontSize: 11, marginTop: 6 },
  bookIntro: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: '#E7E3DC', marginTop: 15, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: palette.green },
  chevron: { color: '#A5A097', fontSize: 28, fontWeight: '300' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  searchInput: { flex: 1, height: 50, borderRadius: 14, paddingHorizontal: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, color: palette.ink, fontSize: 15 },
  primaryButton: { width: 76, height: 50, borderRadius: 14, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '700' },
  resultMessage: { color: palette.muted, fontSize: 12, marginVertical: 8 },
  resultCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.line },
  smallButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: palette.greenSoft },
  smallButtonDisabled: { backgroundColor: '#E6E2DB' },
  smallButtonText: { color: palette.green, fontSize: 12, fontWeight: '700' },
  smallButtonTextDisabled: { color: palette.muted },
  addSourceButton: { height: 58, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#A9B9AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  addSourcePlus: { color: palette.green, fontSize: 24, marginRight: 8 },
  addSourceText: { color: palette.green, fontSize: 15, fontWeight: '600' },
  sourceActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  sourceActionButton: { flex: 1, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#A9B9AF', alignItems: 'center', justifyContent: 'center' },
  sourceActionText: { color: palette.green, fontSize: 13, fontWeight: '600' },
  sourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: palette.line, marginBottom: 10 },
  sourceAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.greenSoft },
  sourceAvatarText: { color: palette.green, fontSize: 18, fontWeight: '700' },
  sourceInfo: { flex: 1, paddingHorizontal: 12 },
  sourceName: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  sourceUrl: { color: palette.muted, fontSize: 11, marginTop: 4 },
  sourceType: { color: palette.green, fontSize: 10, marginTop: 5, fontWeight: '600' },
  tipCard: { marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: '#E8E1D4' },
  tipTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  tipText: { color: '#68645D', fontSize: 12, lineHeight: 19, marginBottom: 5 },
  tabBar: { height: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBF8F2', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabMark: { color: '#959087', fontSize: 22, height: 26 },
  tabLabel: { color: '#959087', fontSize: 10, fontWeight: '600' },
  tabActive: { color: palette.green },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyMark: { color: '#AAA59B', fontSize: 38 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '600', marginTop: 15 },
  emptyDetail: { color: palette.muted, textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 8 },
  modalPage: { flex: 1, backgroundColor: '#F8F5EF' },
  modalHeader: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  modalTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  modalAction: { color: palette.muted, fontSize: 15, minWidth: 45 },
  modalSave: { color: palette.green, textAlign: 'right', fontWeight: '700' },
  jsonEditor: { flex: 1, margin: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFF', color: '#292A26', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 12, lineHeight: 18 },
  editorError: { color: palette.danger, fontSize: 12, paddingHorizontal: 18, paddingBottom: 8 },
  deleteButton: { alignSelf: 'center', padding: 14, marginBottom: 8 },
  deleteText: { color: palette.danger, fontSize: 14, fontWeight: '600' },
  readerPage: { flex: 1 },
  readerScroll: { flex: 1 },
  readerBookName: { fontSize: 12, letterSpacing: 1, marginBottom: 20 },
  chapterTitle: { fontSize: 28, fontWeight: '600', lineHeight: 38, marginBottom: 28 },
  readerText: { fontFamily: Platform.select({ ios: 'STSongti-SC-Regular', android: 'serif' }), letterSpacing: 0.25 },
  readerLoader: { marginTop: 80 },
  chapterEnd: { textAlign: 'center', fontSize: 12, marginTop: 56, letterSpacing: 2 },
  readerError: { marginTop: 50, padding: 18, backgroundColor: '#F0DCD7', borderRadius: 14 },
  readerErrorText: { color: '#83463E', fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#8B4C43', borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  readerTopBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000018' },
  readerTopButton: { width: 52, height: 40, justifyContent: 'center', alignItems: 'center' },
  readerBack: { fontSize: 36, lineHeight: 38, fontWeight: '300' },
  readerTopTitle: { flex: 1, textAlign: 'center', fontSize: 13, marginBottom: 8 },
  readerBottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000018' },
  readerBarButton: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 54 },
  readerBarIcon: { fontSize: 12, fontWeight: '600' },
  sheetBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#00000066' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '68%', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  settingsSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#AAA69E', opacity: 0.55, alignSelf: 'center', marginTop: 10, marginBottom: 10 },
  sheetTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, paddingVertical: 12 },
  tocRow: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#88888822' },
  tocIndex: { width: 38, fontSize: 11 },
  tocTitle: { flex: 1, fontSize: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 62 },
  settingLabel: { width: 42, fontSize: 12 },
  settingButton: { height: 36, minWidth: 58, borderRadius: 12, backgroundColor: '#E3E0D9', alignItems: 'center', justifyContent: 'center' },
  settingButtonText: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  settingValue: { width: 30, textAlign: 'center', fontSize: 13 },
  choiceButton: { flex: 1, height: 36, borderRadius: 11, borderWidth: 1, borderColor: '#C9C4BB', alignItems: 'center', justifyContent: 'center' },
  choiceButtonActive: { backgroundColor: palette.green, borderColor: palette.green },
  choiceText: { color: palette.muted, fontSize: 11 },
  choiceTextActive: { color: '#FFF', fontWeight: '700' },
  themeDot: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#BDB9B2' },
  themeDotActive: { borderWidth: 3, borderColor: palette.green },
});
