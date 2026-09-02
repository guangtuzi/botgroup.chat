// 局内玩家身份与房间关卡的本地存储 key（按房间隔离）
export const playerStorageKey = (roomId: string) => `ai-game-player:${roomId}`;
export const roomLevelStorageKey = (roomId: string) => `ai-game-room-level:${roomId}`;

// 两种玩法的通关进度存储 key
export const campaignProgressKey = 'ai-game-campaign-progress';
export const humanHuntProgressKey = 'ai-game-human-hunt-progress';

export interface CampaignProgress {
  highestUnlockedLevel: number;
  bestStars: Record<string, number>;
  clearedAt: Record<string, string>;
}
