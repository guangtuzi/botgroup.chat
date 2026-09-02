import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Check, Flag, Lock, Play, Share2, Star, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  aiGameGlobalRules,
  aiGameModes,
  generateCampaignLevel,
  generateHumanHuntLevel,
  getCampaignWindow,
  getHumanHuntLevels,
  type AiGameCampaignLevel,
  type AiGameHumanHuntLevel,
} from '@/config/aiGame';
import { request } from '@/utils/request';
import { buildAiGameChallengeUrl, buildHumanHuntChallengeUrl, parseChallengeLevel, parseHumanHuntChallengeLevel } from './share';
import { playerStorageKey, roomLevelStorageKey, type CampaignProgress } from './constants';
import { loadCampaignProgress, loadHumanHuntProgress } from './progress';
import RuleList from './components/RuleList';

export default function AiGameHome() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isUndercoverPath = pathname.startsWith('/ai-game/whoisundercover');
  const isHumanHuntPath = pathname.startsWith('/ai-game/whoishuman');
  const challengeLevelNumber = typeof window !== 'undefined' ? parseChallengeLevel(window.location.search) : null;
  const humanChallengeLevelNumber = typeof window !== 'undefined' ? parseHumanHuntChallengeLevel(window.location.search) : null;
  const [homeSection, setHomeSection] = useState<'menu' | 'campaign' | 'human_hunt' | 'practice'>(() => {
    if (isUndercoverPath) return challengeLevelNumber ? 'campaign' : 'campaign';
    if (isHumanHuntPath) return humanChallengeLevelNumber ? 'human_hunt' : 'human_hunt';
    return challengeLevelNumber ? 'campaign' : humanChallengeLevelNumber ? 'human_hunt' : 'menu';
  });
  const [mode, setMode] = useState(aiGameModes[0].id);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [campaignProgress] = useState<CampaignProgress>(() => loadCampaignProgress());
  const [humanHuntProgress] = useState<CampaignProgress>(() => loadHumanHuntProgress());

  const [joining, setJoining] = useState(false);

  const selectedMode = aiGameModes.find(item => item.id === mode) || aiGameModes[0];
  const visibleCampaignLevels = useMemo(() => {
    const levels = getCampaignWindow(Math.max(campaignProgress.highestUnlockedLevel, challengeLevelNumber || 1));
    if (!challengeLevelNumber || levels.some(level => level.levelNumber === challengeLevelNumber)) return levels;
    return [generateCampaignLevel(challengeLevelNumber), ...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  }, [campaignProgress.highestUnlockedLevel, challengeLevelNumber]);
  const clearedLevels = useMemo(() => Object.values(campaignProgress.bestStars).filter(stars => stars > 0).length, [campaignProgress.bestStars]);
  const humanHuntLevels = useMemo(() => {
    const levels = getHumanHuntLevels();
    if (!humanChallengeLevelNumber || levels.some(level => level.levelNumber === humanChallengeLevelNumber)) return levels;
    return [generateHumanHuntLevel(humanChallengeLevelNumber), ...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  }, [humanChallengeLevelNumber]);
  const clearedHumanHuntLevels = useMemo(() => Object.values(humanHuntProgress.bestStars).filter(stars => stars > 0).length, [humanHuntProgress.bestStars]);

  const createRoom = async () => {
    setCreating(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          maxPlayers: selectedMode.maxPlayers,
          aiCount: selectedMode.aiCount,
          durationSeconds: selectedMode.durationSeconds,
        }),
      });
      const roomData = await roomRes.json();
      const newRoomId = roomData.data.roomId;
      const joinRes = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: newRoomId, displayName: name || '玩家1' }),
      });
      const joinData = await joinRes.json();
      localStorage.setItem(playerStorageKey(newRoomId), joinData.data.playerId);
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/whoisundercover/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const id = roomId.trim();
    if (!id) return;
    setJoining(true);
    try {
      const res = await request(`/api/ai-game/rooms?id=${id}`);
      const data = await res.json();
      const targetRoom = data.data?.room;
      if (!targetRoom) {
        toast.error('房间不存在');
        return;
      }
      if (targetRoom.status === 'revealed' || targetRoom.status === 'archived') {
        toast.error('该房间已结束');
        return;
      }
      const players = data.data?.players || [];
      const humanCount = players.filter((p: any) => p.player_type !== 'observer').length;
      if (targetRoom.status !== 'waiting' && humanCount >= targetRoom.max_players) {
        toast.error('房间已满');
        return;
      }
      const roomSubPath = targetRoom.mode === 'human_hunt' ? 'whoishuman' : 'whoisundercover';
      if (targetRoom.status === 'waiting') {
        toast.success(`房间「${targetRoom.title}」等待中 (${humanCount}/${targetRoom.max_players})`);
        navigate(`/ai-game/${roomSubPath}/${id}`);
      } else {
        toast.info(`房间「${targetRoom.title}」进行中，将作为旁观者加入`);
        navigate(`/ai-game/${roomSubPath}/${id}?observe=1`);
      }
    } catch (error: any) {
      toast.error(error.message || '房间查询失败');
    } finally {
      setJoining(false);
    }
  };

  const createCampaignRoom = async (level: AiGameCampaignLevel) => {
    setCreating(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'undercover',
          title: `卧底晋级赛 · ${level.title}`,
          maxPlayers: level.maxPlayers,
          aiCount: level.aiCount,
          durationSeconds: level.durationSeconds,
          wordTier: level.wordTier,
          campaignLevel: level.levelNumber,
          undercoverCount: level.undercoverCount,
        }),
      });
      const roomData = await roomRes.json();
      const newRoomId = roomData.data.roomId;
      const joinRes = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: newRoomId, displayName: name || '玩家1' }),
      });
      const joinData = await joinRes.json();
      localStorage.setItem(playerStorageKey(newRoomId), joinData.data.playerId);
      localStorage.setItem(roomLevelStorageKey(newRoomId), String(level.levelNumber));
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/whoisundercover/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '关卡创建失败');
    } finally {
      setCreating(false);
    }
  };

  const createHumanHuntRoom = async (level: AiGameHumanHuntLevel) => {
    setCreating(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'human_hunt',
          title: `谁是人类 · ${level.title}`,
          maxPlayers: level.maxPlayers,
          aiCount: level.aiCount,
          durationSeconds: level.durationSeconds,
          campaignLevel: level.levelNumber,
        }),
      });
      const roomData = await roomRes.json();
      const newRoomId = roomData.data.roomId;
      const joinRes = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: newRoomId, displayName: name || '玩家1' }),
      });
      const joinData = await joinRes.json();
      localStorage.setItem(playerStorageKey(newRoomId), joinData.data.playerId);
      localStorage.setItem(roomLevelStorageKey(newRoomId), `h${level.levelNumber}`);
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/whoishuman/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '关卡创建失败');
    } finally {
      setCreating(false);
    }
  };

  const isLevelUnlocked = (level: AiGameCampaignLevel) => level.levelNumber <= campaignProgress.highestUnlockedLevel || level.levelNumber === challengeLevelNumber;
  const isHumanHuntLevelUnlocked = (level: AiGameHumanHuntLevel) => level.levelNumber <= humanHuntProgress.highestUnlockedLevel || level.levelNumber === humanChallengeLevelNumber;

  const shareGame = async () => {
    const isHumanHunt = homeSection === 'human_hunt' || isHumanHuntPath;
    const url = isHumanHunt
      ? buildHumanHuntChallengeUrl(window.location.href, null)
      : buildAiGameChallengeUrl(window.location.href, null);
    const title = isHumanHunt ? '谁是人类' : '卧底晋级赛';
    const text = isHumanHunt
      ? '来玩一局谁是人类，藏进一群 AI 里别被找出来。'
      : '来玩一局谁是卧底，和一群 AI 玩家一起找卧底。';
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareCopied(true);
        toast.success('游戏链接已复制');
        setTimeout(() => setShareCopied(false), 1800);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareCopied(true);
      toast.success('游戏链接已复制');
      setTimeout(() => setShareCopied(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6 md:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => {
            if (isUndercoverPath || isHumanHuntPath) {
              navigate('/ai-game');
            } else if (homeSection === 'menu') {
              navigate('/');
            } else {
              setHomeSection('menu');
            }
          }}>
            {(isUndercoverPath || isHumanHuntPath) ? '返回首页' : homeSection === 'menu' ? '返回群聊' : '返回'}
          </Button>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Bot className="h-4 w-4" />
              真人 AI 混聊局
            </div>
            <Button variant="outline" size="sm" onClick={shareGame}>
              {shareCopied ? <Check className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
              分享游戏
            </Button>
          </div>
        </div>

        {homeSection === 'menu' && (
          <div className="grid flex-1 content-center gap-4 md:grid-cols-2">
            {/* 谁是卧底 */}
            <div className="min-w-0 rounded-lg border bg-card p-5 text-left shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Flag className="h-5 w-5 text-[#c2410c]" />
                <h1 className="text-xl font-semibold tracking-normal">谁是卧底</h1>
              </div>
              <p className="text-sm text-muted-foreground">和 AI 拿相近词，轮流描述、投票找出卧底</p>
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">本地进度</div>
                <div className="mt-1">最高第 {campaignProgress.highestUnlockedLevel} 关 · 已通关 {clearedLevels} 关</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setHomeSection('campaign')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Trophy className="h-4 w-4 text-[#c2410c]" />
                  逐关挑战
                </button>
                <button
                  onClick={() => setHomeSection('practice')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Play className="h-4 w-4 text-[#c2410c]" />
                  自由练习
                </button>
              </div>
            </div>

            {/* 谁是人类 */}
            <div className="min-w-0 rounded-lg border bg-card p-5 text-left shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#c2410c]" />
                <h1 className="text-xl font-semibold tracking-normal">谁是人类</h1>
              </div>
              <p className="text-sm text-muted-foreground">混进 AI 群聊，自由聊天、投票活到最后</p>
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">本地进度</div>
                <div className="mt-1">最高第 {humanHuntProgress.highestUnlockedLevel} 关 · 已通关 {clearedHumanHuntLevels} 关</div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setHomeSection('human_hunt')}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Trophy className="h-4 w-4 text-[#c2410c]" />
                  逐关挑战
                </button>
              </div>
            </div>
          </div>
        )}

        {homeSection === 'human_hunt' && (
        <section className="mb-6 rounded-lg border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#c2410c]" />
                <h1 className="text-lg font-semibold tracking-normal">谁是人类</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">没有倒计时。自由聊天、主动投票淘汰 AI，别被 AI 找出来。</p>
            </div>
            <div className="hidden rounded-lg bg-muted px-3 py-2 text-right text-xs text-muted-foreground md:block">
              <div className="font-medium text-foreground">本地进度</div>
              <div>最高第 {humanHuntProgress.highestUnlockedLevel} 关 · 已通关 {clearedHumanHuntLevels} 关</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {humanHuntLevels.map((level) => {
              const stars = humanHuntProgress.bestStars[String(level.levelNumber)] || 0;
              const unlocked = isHumanHuntLevelUnlocked(level);
              return (
                <button
                  key={level.id}
                  onClick={() => unlocked && createHumanHuntRoom(level)}
                  disabled={!unlocked || creating}
                  className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${unlocked ? 'bg-background hover:bg-accent' : 'cursor-not-allowed bg-muted/60 opacity-70'} ${stars ? 'border-[#c2410c]/50' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">{level.chapter}</div>
                    {unlocked ? (
                      <div className="flex text-[#c2410c]">
                        {Array.from({ length: 3 }).map((_, starIndex) => (
                          <Star key={starIndex} className={`h-3.5 w-3.5 ${starIndex < stars ? 'fill-current' : 'opacity-30'}`} />
                        ))}
                      </div>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="truncate text-sm font-semibold">{level.levelNumber}. {level.title}</div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs text-muted-foreground">{level.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-md bg-muted px-2 py-1">难度 {level.difficulty}</span>
                    <span className="text-muted-foreground">1 真人 · {level.aiCount} AI</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-[#c2410c]">{level.modifier}</div>
                </button>
              );
            })}
          </div>
        </section>
        )}

        {homeSection === 'campaign' && (
        <section className="mb-6 rounded-lg border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-[#c2410c]" />
                <h1 className="text-lg font-semibold tracking-normal">卧底晋级赛</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">逐关挑战谁是卧底，从明显破绽到高压反杀。</p>
            </div>
            <div className="hidden rounded-lg bg-muted px-3 py-2 text-right text-xs text-muted-foreground md:block">
              <div className="font-medium text-foreground">本地进度</div>
              <div>最高第 {campaignProgress.highestUnlockedLevel} 关 · 已通关 {clearedLevels} 关</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {visibleCampaignLevels.map((level) => {
              const stars = campaignProgress.bestStars[String(level.levelNumber)] || 0;
              const unlocked = isLevelUnlocked(level);
              return (
                <button
                  key={level.id}
                  onClick={() => unlocked && createCampaignRoom(level)}
                  disabled={!unlocked || creating}
                  className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${unlocked ? 'bg-background hover:bg-accent' : 'cursor-not-allowed bg-muted/60 opacity-70'} ${stars || level.levelNumber === challengeLevelNumber ? 'border-[#c2410c]/50' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">{level.levelNumber === challengeLevelNumber ? '好友挑战' : level.chapter}</div>
                    {unlocked ? (
                      <div className="flex text-[#c2410c]">
                        {Array.from({ length: 3 }).map((_, starIndex) => (
                          <Star key={starIndex} className={`h-3.5 w-3.5 ${starIndex < stars ? 'fill-current' : 'opacity-30'}`} />
                        ))}
                      </div>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="truncate text-sm font-semibold">{level.levelNumber}. {level.title}</div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs text-muted-foreground">{level.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-md bg-muted px-2 py-1">难度 {level.difficulty}</span>
                    <span className="text-muted-foreground">{level.maxPlayers} 人 · {level.undercoverCount} 卧底 · {Math.round(level.durationSeconds / 60)} 分钟</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-[#c2410c]">{level.modifier}</div>
                </button>
              );
            })}
          </div>
        </section>
        )}

        {homeSection === 'practice' && (
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-normal">自由练习</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                不计入闯关进度，直接开一局当前玩法练手。
              </p>
            </div>

            <div className="grid gap-3">
              {aiGameModes.map(item => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${mode === item.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'bg-background hover:bg-accent'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.maxPlayers - item.aiCount} 真人 + {item.aiCount} AI</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                  <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground/80">目标</div>
                    <div className="mt-1">{item.goal}</div>
                    <div className="mt-2 font-medium text-foreground/80">胜负</div>
                    <div className="mt-1">{item.winCondition}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Play className="h-4 w-4 text-[#c2410c]" />
              <h2 className="font-medium">快速开局</h2>
            </div>
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="你的昵称"
              />
              <Button onClick={createRoom} disabled={creating} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
                {creating ? '创建中...' : '创建并加入'}
              </Button>
            </div>

            <div className="my-5 border-t" />

            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#c2410c]" />
              <h2 className="font-medium">加入已有房间</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="game-xxxx" className="flex-1 min-w-0" />
              <Button variant="outline" onClick={joinRoom} disabled={joining}>{joining ? '查询中...' : '加入'}</Button>
            </div>

            <div className="mt-5 rounded-lg bg-muted p-3">
              <div className="mb-2 text-sm font-medium">通用规则</div>
              <RuleList items={aiGameGlobalRules} />
            </div>
          </section>
        </div>
        )}
      </div>
    </div>
  );
}
