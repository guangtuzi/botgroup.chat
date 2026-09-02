import type { GameResult } from './types';

// 后端返回的时间戳不带时区后缀，统一按 UTC 解析
export function toUtcDate(date?: string | null) {
  if (!date) return null;
  return new Date(date.endsWith('Z') ? date : `${date}Z`);
}

export function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Math.round(Number(value) * 100)}%`;
}

export function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
}

// 人类识别准确率换算成 0~3 星
export function resultStars(result?: GameResult | null) {
  return Math.max(0, Math.min(3, Math.round(Number(result?.human_accuracy || 0) * 3)));
}

// 从结算 summary 里抠出「平民词 / 卧底词」
export function extractUndercoverWordPair(summary?: string | null) {
  const match = summary?.match(/平民词是「(.+?)」，卧底词是「(.+?)」/);
  return match ? { civilianWord: match[1], undercoverWord: match[2] } : null;
}

// 解析玩家身份密文，格式：undercover|role=x|word=y|civilian=z|undercover=w
export function parseUndercoverMeta(raw?: string | null) {
  if (!raw?.startsWith('undercover|')) return null;
  const parts = Object.fromEntries(raw.split('|').slice(1).map((part) => {
    const idx = part.indexOf('=');
    return idx >= 0 ? [part.slice(0, idx), part.slice(idx + 1)] : [part, ''];
  }));
  return {
    role: parts.role,
    word: parts.word,
    civilianWord: parts.civilian,
    undercoverWord: parts.undercover,
  };
}
