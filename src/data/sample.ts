import { AppData, Book, BookSource } from '../types';

const now = Date.now();

export const sampleBook: Book = {
  id: 'local-wind-library',
  sourceId: 'local',
  title: '风从旧书馆来',
  author: '纯阅示例',
  url: 'local://wind-library',
  intro: '一篇随应用附送的原创短篇，用来体验章节、主题与阅读进度。',
  addedAt: now,
  progress: { chapterIndex: 0, chapterPercent: 0, updatedAt: now },
  chapters: [
    {
      title: '第一章 雨夜的灯',
      url: 'local://wind-library/1',
      content:
        '雨从傍晚开始下。\n\n林澈推开旧书馆的木门时，门楣上的铜铃只轻轻响了一声。馆里没有音乐，也没有招徕客人的海报，只有一盏盏暖黄的灯，把书脊照得像一条安静的河。\n\n柜台后的老人递给他一块干毛巾，说：“今天的风会替人翻书，你若听见纸页响，不必害怕。”\n\n林澈以为那只是旧书馆惯有的玩笑。直到午夜将近，最深处的一排书架忽然传来沙沙声，一本没有书名的蓝布封面书自行落在桌上。',
    },
    {
      title: '第二章 没有写完的信',
      url: 'local://wind-library/2',
      content:
        '蓝布书里夹着一封信。\n\n信纸已经泛黄，第一行写着“给十年后的我”，末尾却停在一个未写完的句子上。林澈认出了字迹——那是少年时代的自己。\n\n窗缝里的风又一次吹来，纸页向后翻动。空白处慢慢浮出淡蓝色的字，像墨水刚刚落下：\n\n“你有没有成为一个仍会为故事停下脚步的人？”\n\n林澈坐了很久。他这些年赶过无数班车、开过无数会议，却想不起上一次安静读完一本书是什么时候。雨声落在玻璃上，替沉默标出了节拍。',
    },
    {
      title: '第三章 清晨的书签',
      url: 'local://wind-library/3',
      content:
        '天快亮时，林澈终于提笔，在未写完的句子后补上一行回答。\n\n他没有许诺宏大的改变，只写道：“从今天起，每晚留半小时给自己。”\n\n字迹干透后，蓝布书合拢了。老人把它放回书架，递来一枚银杏叶书签。门外的雨已经停了，清晨的风带着潮湿泥土的气味。\n\n林澈走出几步，又回头看。旧书馆的灯一盏接一盏熄灭，铜铃在无人触碰时轻响。\n\n他把书签放进口袋，知道今晚还会回来。',
    },
  ],
};

export const sourceTemplate: BookSource = {
  id: 'source-template',
  name: '书源模板（请编辑后启用）',
  baseUrl: 'https://example.com',
  enabled: false,
  headers: { Accept: 'text/html,application/json' },
  search: {
    url: '/search?q={{keyword}}',
    type: 'html',
    list: '.result-item',
    name: '.book-name::text',
    author: '.author::text',
    bookUrl: 'a::attr(href)',
    cover: 'img::attr(src)',
    intro: '.intro::text',
  },
  toc: {
    url: '{{bookUrl}}',
    type: 'html',
    list: '.chapter-list a',
    title: '::text',
    chapterUrl: '::attr(href)',
  },
  content: {
    url: '{{chapterUrl}}',
    type: 'html',
    body: '#content',
    remove: ['.ad', 'script', 'style'],
  },
};

export const initialData: AppData = {
  books: [sampleBook],
  sources: [sourceTemplate],
  settings: { fontSize: 19, lineHeight: 1.85, theme: 'paper' },
};

