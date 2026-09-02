import { Bot, Check, Copy, Loader2, Play, Share2, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { GameControlPanelProps } from './GameControlPanel';

interface MobileActionCardProps extends GameControlPanelProps {
  voteOpen: boolean;
  setVoteOpen: (open: boolean) => void;
}

export default function MobileActionCard({
  room,
  players,
  candidatePlayers,
  currentPlayer,
  currentPlayerSecret,
  selectedVote,
  setSelectedVote,
  canGuess,
  canReveal,
  campaignTimedOut,
  busy,
  aiChatPending,
  revealed,
  isObserver,
  isJuryMode,
  isUndercoverMode,
  isHumanHuntMode,
  copied,
  effectiveStatus,
  onStart,
  onCopyShare,
  onNewGame,
  onReplay,
  onAiChatRound,
  onConfirm,
  voteHint,
  voteOpen,
  setVoteOpen,
}: MobileActionCardProps) {
  const selectedPlayer = candidatePlayers.find(player => player.id === selectedVote);
  const showVotePicker = (voteOpen || effectiveStatus === 'voting') && canGuess && !revealed;

  if (room.status === 'waiting') {
    if (isObserver) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
          <div className="text-sm font-medium">围观中</div>
          <div className="mt-1 text-xs text-muted-foreground">房主开始后会自动进入观看，本模式不能操作房间。</div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">等待开局</div>
            <div className="text-xs text-muted-foreground">已入座 {players.length}/{room.max_players}</div>
          </div>
          <Button size="sm" onClick={onStart} disabled={busy || !currentPlayer} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
            {busy ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />准备中…</> : <><Play className="mr-1 h-3.5 w-3.5" />开始</>}
          </Button>
        </div>
        {!onReplay && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => navigator.clipboard.writeText(room.id).then(() => toast.success('房间 ID 已复制'))}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制房间 ID
          </Button>
        )}
      </div>
    );
  }

  if (revealed) {
    if (isObserver) return null;

    return (
      <div className="rounded-lg border bg-card p-2.5 shadow-sm md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className={`grid min-w-0 flex-1 gap-1.5 ${onReplay ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Button size="sm" variant="outline" onClick={onCopyShare} className="h-7 px-2 text-xs">
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Share2 className="mr-1 h-3 w-3" />}
              分享
            </Button>
            {!onReplay && (
              <Button onClick={onNewGame} size="sm" className="h-7 bg-[#c2410c] px-2 text-xs text-white hover:bg-[#9a3412]">
                <Play className="mr-1 h-3 w-3" />
                再来一局
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (campaignTimedOut) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm md:hidden dark:border-red-900/40 dark:bg-red-950/20">
        <div className="text-sm font-medium text-red-700 dark:text-red-300">挑战失败</div>
        <div className="mt-1 text-xs text-red-600 dark:text-red-300">本关已超时，身份不会揭晓。</div>
        {!isObserver && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onNewGame}>
              返回地图
            </Button>
            <Button size="sm" onClick={onReplay || onNewGame} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
              重玩本关
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (effectiveStatus !== 'playing' && effectiveStatus !== 'voting') {
    return null;
  }

  if (isObserver) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
        <div className="text-sm font-medium">围观中</div>
        <div className="mt-1 text-xs text-muted-foreground">你正在观看本局，不能发言、投票或揭晓身份。</div>
      </div>
    );
  }

  if (!showVotePicker) {
    return (
      <div className="rounded-lg border bg-card p-2 shadow-sm md:hidden">
        <div className="flex items-center gap-2">
      {isUndercoverMode && !isObserver && !currentPlayerSecret?.word && room.status === 'playing' && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 animate-pulse">
          <span className="text-xs text-muted-foreground">正在分配词语…</span>
          <span className="text-sm font-semibold text-[#c2410c]/60">生成中</span>
        </div>
      )}
      {isUndercoverMode && !isObserver && currentPlayerSecret?.word && (
            <div className="min-w-0 flex-1 rounded-lg border border-[#c2410c]/25 bg-orange-50 px-2.5 py-1.5 dark:bg-orange-950/20">
              <div className="text-[11px] leading-4 text-muted-foreground">你的词语</div>
              <div className="truncate text-sm font-semibold tracking-normal text-[#c2410c]">{currentPlayerSecret.word}</div>
            </div>
          )}
          {!isJuryMode && (
            <Button onClick={() => setVoteOpen(true)} disabled={!canGuess} variant="outline" size="sm" className="h-10 flex-none">
              <Vote className="mr-1 h-3.5 w-3.5" />
              {isHumanHuntMode ? '投 AI' : '投票'}
            </Button>
          )}
          {isHumanHuntMode && (
            <Button onClick={onAiChatRound} disabled={busy || aiChatPending} variant="outline" size="sm" className="h-10 flex-none">
              {aiChatPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1 h-3.5 w-3.5" />}
              {aiChatPending ? '聊着' : '聊一下'}
            </Button>
          )}
          <Button onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} variant="outline" size="sm" className="h-10 flex-none">
            {isHumanHuntMode ? '揭晓' : isUndercoverMode ? '揭晓' : isJuryMode ? '请求宣判' : '揭晓'}
          </Button>
        </div>
        {voteHint && <div className="mt-1.5 text-xs text-muted-foreground">{voteHint}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{isHumanHuntMode ? '投出一个 AI' : '选择怀疑对象'}</div>
          <div className="truncate text-xs text-muted-foreground">
            {selectedPlayer ? `当前选择：${selectedPlayer.display_name}` : isHumanHuntMode ? '找出最像 AI 的角色' : '先选一个玩家再提交投票'}
          </div>
        </div>
        <Button onClick={() => setVoteOpen(false)} variant="ghost" size="sm" className="h-8 flex-none px-2">
          收起
        </Button>
      </div>

      {isUndercoverMode && !isObserver && !currentPlayerSecret?.word && room.status === 'playing' && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 animate-pulse">
          <span className="text-xs text-muted-foreground">正在分配词语…</span>
          <span className="text-sm font-semibold text-[#c2410c]/60">生成中</span>
        </div>
      )}
      {isUndercoverMode && !isObserver && currentPlayerSecret?.word && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">你的词语</span>
          <span className="max-w-[60%] truncate text-sm font-semibold text-[#c2410c]">{currentPlayerSecret.word}</span>
        </div>
      )}

      <div className="mb-2 max-h-[24dvh] overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 gap-2">
          {candidatePlayers.map(player => {
            const disabled = player.id === currentPlayer?.id || player.player_type === 'observer' || !!player.eliminated_at;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedVote(player.id)}
                disabled={disabled}
                className={`min-w-0 rounded-lg border px-2 py-2 text-left transition-colors ${selectedVote === player.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'bg-background'} ${disabled ? 'opacity-50' : 'active:bg-accent'}`}
              >
                <div className="truncate text-xs font-medium">{player.display_name}</div>
                <div className="text-xs text-muted-foreground">{player.id === currentPlayer?.id ? '你' : player.eliminated_at ? '已出局' : '可投票'}</div>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} size="sm" className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
        {busy ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />投票中…</> : <><Vote className="mr-1 h-3.5 w-3.5" />提交投票</>}
      </Button>
    </div>
  );
}
