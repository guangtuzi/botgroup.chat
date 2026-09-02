import {
  campaignProgressKey,
  humanHuntProgressKey,
  type CampaignProgress,
} from './constants';

/**
 * 兼容两种历史存档格式：
 * - 新格式：{ highestUnlockedLevel, bestStars, clearedAt }
 * - 旧格式：{ u1: { stars, clearedAt }, u2: {...} }（key 前缀 u + 关卡号）
 */
export function normalizeCampaignProgress(raw: any): CampaignProgress {
  if (raw && typeof raw.highestUnlockedLevel === 'number' && raw.bestStars && raw.clearedAt) {
    return {
      highestUnlockedLevel: Math.max(1, Math.floor(raw.highestUnlockedLevel || 1)),
      bestStars: raw.bestStars || {},
      clearedAt: raw.clearedAt || {},
    };
  }

  const bestStars: Record<string, number> = {};
  const clearedAt: Record<string, string> = {};
  let highestCleared = 0;

  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      const levelNumber = Number(key.replace(/^u/, ''));
      const item = value as { stars?: number; clearedAt?: string };
      if (!Number.isFinite(levelNumber) || levelNumber < 1 || !item?.stars) return;
      bestStars[String(levelNumber)] = Math.max(0, Math.min(3, Number(item.stars) || 0));
      if (item.clearedAt) clearedAt[String(levelNumber)] = item.clearedAt;
      highestCleared = Math.max(highestCleared, levelNumber);
    });
  }

  return {
    highestUnlockedLevel: Math.max(1, highestCleared + 1),
    bestStars,
    clearedAt,
  };
}

function loadProgress(storageKey: string): CampaignProgress {
  try {
    return normalizeCampaignProgress(JSON.parse(localStorage.getItem(storageKey) || '{}'));
  } catch {
    return normalizeCampaignProgress(null);
  }
}

function saveProgress(storageKey: string, progress: CampaignProgress) {
  localStorage.setItem(storageKey, JSON.stringify(progress));
}

export function loadCampaignProgress(): CampaignProgress {
  return loadProgress(campaignProgressKey);
}

export function saveCampaignProgress(progress: CampaignProgress) {
  saveProgress(campaignProgressKey, progress);
}

export function loadHumanHuntProgress(): CampaignProgress {
  return loadProgress(humanHuntProgressKey);
}

export function saveHumanHuntProgress(progress: CampaignProgress) {
  saveProgress(humanHuntProgressKey, progress);
}
