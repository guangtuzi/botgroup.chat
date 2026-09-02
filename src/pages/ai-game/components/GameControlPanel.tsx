import { Bot, Check, Copy, Loader2, Play, Share2, Star, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { aiGameModes, type AiGameCampaignLevel, type AiGameHumanHuntLevel } from '@/config/aiGame';
import { extractUndercoverWordPair, formatPercent, parseUndercoverMeta, resultStars } from '../format';
import type { CurrentPlayerSecret, GamePlayer, GameResult, GameRoomData } from '../types';
import PlayerAvatar from './PlayerAvatar';
import RuleList from './RuleList';

export interface GameControlPanelProps {
  room: GameRoomData;
  modeRules: (typeof aiGameModes)[number];
  effectiveStatus: GameRoomData['status'];
  players: GamePlayer[];
  candidatePlayers: GamePlayer[];
  activeCandidatePlayers: GamePlayer[];
  currentPlayer?: GamePlayer;
  currentPlayerSecret: CurrentPlayerSecret | null;
  selectedVote: string;
  setSelectedVote: (value: string) => void;
  canGuess: boolean;
  canReveal: boolean;
  campaignTimedOut?: boolean;
  busy: boolean;
  aiChatPending?: boolean;
  revealed: boolean;
  isObserver: boolean;
  isJuryMode: boolean;
  isUndercoverMode: boolean;
  isHumanHuntMode: boolean;
  result: GameResult | null;
  campaignLevel?: AiGameCampaignLevel | null;
  humanHuntLevel?: AiGameHumanHuntLevel | null;
  campaignStars?: number;
  copied: boolean;
  onStart: () => void;
  onCopyShare: () => void;
  onNewGame: () => void;
  onReplay?: () => void;
  onNextCampaign?: () => void;
  onAiChatRound?: () => void;
  onConfirm: (action: 'vote' | 'reveal') => void;
  voteHint?: string;
  compact?: boolean;
}

export default function GameControlPanel({
  room,
  modeRules,
  effectiveStatus,
  candidatePlayers,
  activeCandidatePlayers,
  currentPlayer,
  currentPlayerSecret,
  selectedVote,
  setSelectedVote,
  canGuess,
  canReveal,
  campaignTimedOut,
  busy,
  aiChatPending = false,
  revealed,
  isObserver,
  isJuryMode,
  isUndercoverMode,
  isHumanHuntMode,
  result,
  campaignLevel,
  humanHuntLevel,
  campaignStars = 0,
  copied,
  onStart,
  onCopyShare,
  onNewGame,
  onReplay,
  onNextCampaign,
  onAiChatRound,
  onConfirm,
  voteHint,
  compact = false,
}: GameControlPanelProps) {
  const selectedPlayer = candidatePlayers.find(player => player.id === selectedVote);
  const revealedWordPair = revealed && isUndercoverMode ? extractUndercoverWordPair(result?.summary) : null;
  const playerGridClass = compact
    ? 'grid grid-cols-2 gap-2'
    : 'grid grid-cols-2 gap-2';

  return (
    <div className={compact ? 'w-full max-w-full overflow-hidden rounded-lg border bg-card shadow-sm' : 'flex min-h-0 flex-col bg-card'}>
      <div className="border-b p-2.5 md:p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="font-medium">{isHumanHuntMode ? '存活席位' : isUndercoverMode ? '玩家列表' : isJuryMode ? '法庭成员' : isObserver ? '候选玩家' : '玩家席位'}</div>
          <div className="text-xs text-muted-foreground">{activeCandidatePlayers.length}/{room.max_players}</div>
        </div>
        <div className={playerGridClass}>
          {candidatePlayers.map(player => {
            const isOut = !!player.eliminated_at && !revealed;
            const disabled = !canGuess || player.id === currentPlayer?.id || player.player_type === 'observer' || !!player.eliminated_at;
            const isMe = player.id === currentPlayer?.id;
            const isUndercover = isUndercoverMode && revealed && parseUndercoverMeta(player.ai_persona)?.role === 'undercover';
            const isAi = !isUndercoverMode && revealed && player.secret_role === 'ai';
            const revealedRoleLabel = revealed
              ? isUndercoverMode
                ? (isUndercover ? '卧底' : '平民')
                : isHumanHuntMode
                  ? (isAi ? 'AI' : player.secret_role === 'observer' ? '观察者' : '人类')
                  : (isAi ? 'AI' : player.secret_role === 'observer' ? '观察者' : '真人')
              : '';
            const revealedRoleHighlight = isUndercover || isAi;
            const playerStatus = (() => {
              if (isOut) return <span className="font-medium text-red-500">已出局</span>;
              if (isUndercoverMode && revealed) {
                return (
                  <>
                    {parseUndercoverMeta(player.ai_persona)?.role === 'undercover' ? '卧底' : '平民'}
                    {player.eliminated_at && <span className="text-red-500"> · 已出局</span>}
                  </>
                );
              }
              if (isHumanHuntMode && !revealed) return player.eliminated_at ? '已出局' : player.id === currentPlayer?.id ? '你' : '存活中';
              if (isJuryMode && !revealed) return player.id === currentPlayer?.id ? '被告' : '法庭角色';
              if (revealed) return player.secret_role === 'ai' ? 'AI' : player.secret_role === 'observer' ? '观察者' : '真人';
              return player.id === currentPlayer?.id ? '你' : '身份未知';
            })();

            return (
              <button
                key={player.id}
                onClick={() => setSelectedVote(player.id)}
                disabled={disabled}
                className={`relative flex min-w-0 items-center gap-1.5 rounded-lg border p-2 text-left transition-colors ${selectedVote === player.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-accent'} ${isMe ? 'opacity-70' : ''}`}
              >
                <div className={`relative ${isOut ? 'opacity-50 grayscale' : ''}`}>
                  <PlayerAvatar player={player} revealed={revealed} compact={compact} />
                  {isOut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-0.5 w-full rotate-45 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${compact ? 'text-xs' : 'text-sm'} font-medium ${isOut ? 'line-through text-muted-foreground' : ''}`}>{player.display_name}</div>
                  {revealed ? (
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-none ${revealedRoleHighlight ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
                        {revealedRoleLabel}
                      </span>
                      {player.eliminated_at && <span className="text-xs font-medium text-red-500">已出局</span>}
                      {isMe && <span className="text-xs text-muted-foreground">(你)</span>}
                    </div>
                  ) : (
                    <div className="truncate text-xs text-muted-foreground">{playerStatus}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${compact ? '' : 'flex-1 overflow-y-auto'} p-2.5 md:p-4`}>
        {isUndercoverMode && !isObserver && !revealed && room.status === 'playing' && !currentPlayerSecret?.word && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20 animate-pulse">
            <div className="text-xs text-muted-foreground">正在分配词语…</div>
            <div className="mt-1 text-lg font-semibold tracking-normal text-[#c2410c]/60">生成中</div>
          </div>
        )}
        {isUndercoverMode && !isObserver && !revealed && currentPlayerSecret?.word && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20">
            <div className="text-xs text-muted-foreground">你的词语</div>
            <div className="mt-1 text-2xl font-semibold tracking-normal text-[#c2410c]">{currentPlayerSecret.word}</div>
            <div className="mt-1 text-xs text-muted-foreground">描述时不能直接说出这个词。</div>
          </div>
        )}

        {selectedPlayer && canGuess && !revealed && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 text-sm dark:bg-orange-950/20">
            已选择：<span className="font-medium">{selectedPlayer.display_name}</span>
          </div>
        )}

        {voteHint && !revealed && (
          <div className="mb-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {voteHint}
          </div>
        )}

        {campaignTimedOut && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            本关已超时，挑战失败。身份不会揭晓，可以重玩本关。
            {!isObserver && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={onNewGame}>
                  返回地图
                </Button>
                <Button size="sm" onClick={onReplay || onNewGame} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  重玩本关
                </Button>
              </div>
            )}
          </div>
        )}

        {room.status === 'waiting' && (
          <div className="space-y-3">
            {isObserver ? (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">围观中</div>
                <div className="mt-1">房主开始后会自动进入观看，本模式不能操作房间。</div>
              </div>
            ) : (
              <>
            {!compact && !isHumanHuntMode && (
              <details className="group rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none list-none font-medium text-muted-foreground marker:hidden">
                  规则与流程
                  <span className="float-right text-xs transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p>{modeRules.setup}</p>
                    <p>{modeRules.goal}</p>
                    <p>{modeRules.winCondition}</p>
                  </div>
                  <RuleList items={modeRules.flow} />
                </div>
              </details>
            )}
            <Button onClick={onStart} disabled={busy || !currentPlayer} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />准备中…</> : <><Play className="mr-2 h-4 w-4" />开始游戏</>}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(room.id).then(() => toast.success('房间 ID 已复制'))}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制房间 ID
            </Button>
              </>
            )}
          </div>
        )}

        {effectiveStatus === 'playing' && !campaignTimedOut && (
          <div className="space-y-3">
            {isObserver ? (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">围观中</div>
                <div className="mt-1">你正在观看本局，不能发言、投票或揭晓身份。</div>
              </div>
            ) : (
              <>
            {!compact && (
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isHumanHuntMode
                  ? '自由聊天和互相试探，聊够后你可以发起投票。'
                  : isUndercoverMode
                  ? '描述自己的词，观察发言方向，觉得可疑就投票。'
                  : '继续提问观察，选中可疑玩家后投票。'}
              </div>
            )}
            {!isJuryMode && (
               <Button variant="outline" onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />投票中…</> : <><Vote className="mr-2 h-4 w-4" />{isHumanHuntMode ? '投出一个 AI' : isUndercoverMode ? '提交投票' : '投给选中的玩家'}</>}
              </Button>
            )}
            {isHumanHuntMode && (
              <Button variant="outline" onClick={onAiChatRound} disabled={busy || aiChatPending} className="w-full">
                {aiChatPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                {aiChatPending ? '聊天中…' : '让大家聊一下'}
              </Button>
            )}
            <Button onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} className="w-full">
              {isHumanHuntMode ? '揭晓身份' : isUndercoverMode ? '揭晓身份' : isJuryMode ? '请求宣判' : '直接揭晓'}
            </Button>
              </>
            )}
          </div>
        )}

        {effectiveStatus === 'voting' && !isJuryMode && !campaignTimedOut && !isObserver && (
          <div className="space-y-3">
            <Button onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />投票中…</> : '提交投票'}
            </Button>
            <Button variant="outline" onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} className="w-full">
              揭晓身份
            </Button>
          </div>
        )}

        {revealed && (
          <div className="space-y-3">
            {isUndercoverMode && !isObserver && (
              <div className="rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">本局结算</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campaignLevel ? campaignLevel.title : '谁是卧底'}
                    </div>
                  </div>
                  <div className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${resultStars(result) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
                    {resultStars(result) > 0 ? '成功' : '失败'}
                  </div>
                </div>
                {campaignLevel && (
                  <div className="mt-2 flex text-[#c2410c]">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                )}
                {revealedWordPair && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                      <div className="text-muted-foreground">平民词</div>
                      <div className="mt-0.5 truncate font-semibold text-foreground">{revealedWordPair.civilianWord}</div>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                      <div className="text-muted-foreground">卧底词</div>
                      <div className="mt-0.5 truncate font-semibold text-foreground">{revealedWordPair.undercoverWord}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isHumanHuntMode && !isObserver && (
              <div className="rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">本关结算</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {humanHuntLevel ? humanHuntLevel.title : '谁是人类'}
                    </div>
                  </div>
                  <div className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${resultStars(result) > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
                    {resultStars(result) > 0 ? '人类胜利' : 'AI 胜利'}
                  </div>
                </div>
                {humanHuntLevel && (
                  <div className="mt-2 flex text-[#c2410c]">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isJuryMode && !isUndercoverMode && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">识别率</div>
                  <div className="mt-1 text-lg font-semibold">{formatPercent(result?.human_accuracy)}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">AI 逃脱率</div>
                  <div className="mt-1 text-lg font-semibold">{formatPercent(result?.ai_escape_rate)}</div>
                </div>
              </div>
            )}
            <div className="rounded-lg bg-muted p-3 text-sm">
              {result?.summary || (isJuryMode ? '本案已经宣判。' : '本局已经揭晓。')}
            </div>
            {!isObserver && (
              <>
                <Button onClick={onCopyShare} className="w-full">
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                  生成战绩卡
                </Button>
                {onReplay && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={onReplay} disabled={busy}>
                      重玩本关
                    </Button>
                    <Button onClick={onNextCampaign || onNewGame} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                      {onNextCampaign ? '下一关' : '返回地图'}
                    </Button>
                  </div>
                )}
                {!onReplay && (
                  <Button onClick={onNewGame} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
                    <Play className="mr-2 h-4 w-4" />
                    再来一局
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
