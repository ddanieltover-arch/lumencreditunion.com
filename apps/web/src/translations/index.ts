import { en } from './en';

type DeepNestedKeys<T> = T extends object
  ? {
      [K in keyof T]: `${Exclude<K, symbol>}${DeepNestedKeys<T[K]> extends never
        ? ''
        : `.${DeepNestedKeys<T[K]>}`}`;
    }[keyof T]
  : never;

export type TranslationPath = DeepNestedKeys<typeof en>;

const translations: Record<string, any> = {
  en,
};

let currentLanguage = 'en';

export function setLanguage(lang: string) {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

export function getLanguage(): string {
  return currentLanguage;
}

/**
 * Access translation string by dot notation path (e.g. "sandbox.bannerNotice" or "member.welcome")
 * with dynamic parameter substitution.
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const dictionary = translations[currentLanguage] || en;
  const segments = path.split('.');

  let result: any = dictionary;
  for (const segment of segments) {
    if (result && typeof result === 'object' && segment in result) {
      result = result[segment];
    } else {
      // Fallback to English dictionary
      let fallbackResult: any = en;
      for (const fallbackSeg of segments) {
        if (fallbackResult && typeof fallbackResult === 'object' && fallbackSeg in fallbackResult) {
          fallbackResult = fallbackResult[fallbackSeg];
        } else {
          return path; // Key not found
        }
      }
      result = fallbackResult;
      break;
    }
  }

  if (typeof result !== 'string') {
    return path;
  }

  if (params) {
    return Object.entries(params).reduce((acc, [key, value]) => {
      return acc.replaceAll(`{${key}}`, String(value));
    }, result);
  }

  return result;
}

export { en };
