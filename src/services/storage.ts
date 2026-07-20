import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialData } from '../data/sample';
import { AppData } from '../types';

const STORAGE_KEY = 'pure-reader:data:v1';

export async function loadData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return initialData;

  try {
    const saved = JSON.parse(raw) as Partial<AppData>;
    return {
      books: Array.isArray(saved.books) ? saved.books : initialData.books,
      sources: Array.isArray(saved.sources) ? saved.sources : initialData.sources,
      settings: { ...initialData.settings, ...saved.settings },
    };
  } catch {
    return initialData;
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

