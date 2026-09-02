import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Eye, Loader2, Play, Send, Share2, Star, Trophy, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  aiGameModes,
  generateCampaignLevel,
  generateHumanHuntLevel,
  type AiGameCampaignLevel,
  type AiGameHumanHuntLevel,
} from '@/config/aiGame';
import { request } from '@/utils/request';
import { getAvatarData } from '@/utils/avatar';
import type { CurrentPlayerSecret, GameMessage, GamePlayer, GameResult, GameRoomData } from './types';
import { getPlayerRoleLabel, parseVoteResultMessage } from './voteMessage';
import { buildAiGameChallengeUrl, buildHumanHuntChallengeUrl } from './share';
import { getHumanHuntTurnState } from './humanHunt';
import { playerStorageKey, roomLevelStorageKey } from './constants';
import {
  loadCampaignProgress,
  saveCampaignProgress,
  loadHumanHuntProgress,
  saveHumanHuntProgress,
} from './progress';
import { toUtcDate, formatCountdown, resultStars, extractUndercoverWordPair } from './format';
import VoteRecord from './components/VoteRecord';
import EliminatedIdentityRecord from './components/EliminatedIdentityRecord';
import AiGameShareDialog from './components/AiGameShareDialog';
import GameControlPanel from './components/GameControlPanel';
import MobileActionCard from './components/MobileActionCard';

export default function AiGameRoom() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const observeInvite = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('observe') === '1';
  const [room, setRoom] = useState<GameRoomData | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentPlayerSecret, setCurrentPlayerSecret] = useState<CurrentPlayerSecret | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [input, setInput] = useState('');
  const [playerId, setPlayerId] = useState(() => localStorage.getItem(playerStorageKey(roomId)) || '');
  const [campaignLevelId, setCampaignLevelId] = useState(() => localStorage.getItem(roomLevelStorageKey(roomId)) || '');
  const [selectedVote, setSelectedVote] = useState('');
  const [mobileVoteOpen, setMobileVoteOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [votingPending, setVotingPending] = useState(false);
  const [aiChatPending, setAiChatPending] = useState(false);
  const [postGameReviewPending, setPostGameReviewPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'vote' | 'reveal' | null>(null);
  const lastMessageIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const observeJoinAttemptedRef = useRef('');

  const currentPlayer = useMemo(() => players.find(player => player.id === playerId), [players, playerId]);
  const latestUndercoverVoteResultId = useMemo(() => {
    const voteResults = messages.filter(message => message.sender_type === 'system' && message.content.startsWith('投票完成'));
    return voteResults.length ? voteResults[voteResults.length - 1].id : 0;
  }, [messages]);
  const latestOwnDescriptionId = useMemo(() => {
    const ownMessages = messages.filter(message => message.player_id === playerId && message.sender_type === 'human');
    return ownMessages.length ? ownMessages[ownMessages.length - 1].id : 0;
  }, [messages, playerId]);
  const aiMessagesAfterOwnDescriptionCount = useMemo(() => {
    if (!latestOwnDescriptionId) return 0;
    return messages.filter(message => message.sender_type === 'ai' && message.id > latestOwnDescriptionId).length;
  }, [latestOwnDescriptionId, messages]);
  const campaignLevel = useMemo(() => {
    if (campaignLevelId.startsWith('h')) return null;
    const levelNumber = Number(campaignLevelId.replace(/^u/, ''));
    return Number.isFinite(levelNumber) && levelNumber > 0 ? generateCampaignLevel(levelNumber) : null;
  }, [campaignLevelId]);
  const humanHuntLevel = useMemo(() => {
    const levelNumber = Number(campaignLevelId.replace(/^h/, ''));
    return campaignLevelId.startsWith('h') && Number.isFinite(levelNumber) && levelNumber > 0
      ? generateHumanHuntLevel(levelNumber)
      : null;
  }, [campaignLevelId]);
  const candidatePlayers = useMemo(() => players.filter(player => player.player_type !== 'observer'), [players]);
  const activeCandidatePlayers = useMemo(() => candidatePlayers.filter(player => !player.eliminated_at), [candidatePlayers]);
  const revealed = room?.status === 'revealed' || room?.status === 'archived';
  const startedAt = toUtcDate(room?.started_at);
  const endsAt = startedAt && room ? new Date(startedAt.getTime() + room.duration_seconds * 1000) : null;
  const [now, setNow] = useState(Date.now());
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 1000)) : room?.duration_seconds || 0;
  const effectiveStatus = room?.status === 'playing' && secondsLeft <= 0 && room.mode !== 'jury' && room.mode !== 'undercover' && room.mode !== 'human_hunt' ? 'voting' : room?.status;

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerStorageKey(roomId)) || '');
    setCampaignLevelId(localStorage.getItem(roomLevelStorageKey(roomId)) || '');
    setSelectedVote('');
    setMobileVoteOpen(false);
    setShareDialogOpen(false);
    setInput('');
    setRoom(null);
    setPlayers([]);
    setResult(null);
    setCurrentPlayerSecret(null);
    setVotingPending(false);
    setAiChatPending(false);
    setPostGameReviewPending(false);
    lastMessageIdRef.current = 0;
    setMessages([]);
  }, [roomId]);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    const res = await request(`/api/ai-game/rooms?id=${roomId}${playerId ? `&player=${playerId}` : ''}`);
    const data = await res.json();
    const loadedRoom = data.data.room;
    setRoom(loadedRoom);
    if (!localStorage.getItem(roomLevelStorageKey(roomId)) && Number(loadedRoom?.campaign_level) > 0) {
      const levelValue = loadedRoom?.mode === 'human_hunt'
        ? `h${loadedRoom.campaign_level}`
        : String(loadedRoom.campaign_level);
      setCampaignLevelId(levelValue);
    }
    setPlayers(data.data.players || []);
    setResult(data.data.result || null);
    setCurrentPlayerSecret(data.data.currentPlayerSecret || null);
    return loadedRoom as GameRoomData;
  }, [roomId, playerId]);

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    const res = await request(`/api/ai-game/messages?room=${roomId}&since=${lastMessageIdRef.current}${playerId ? `&player=${playerId}` : ''}`);
    const data = await res.json();
    const newMessages = data.data.messages || [];
    if (newMessages.length > 0) {
      lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
      setMessages(prev => {
        const ids = new Set(prev.map(msg => msg.id));
        return [...prev, ...newMessages.filter((msg: GameMessage) => !ids.has(msg.id))];
      });
    }
  }, [roomId, playerId]);

  useEffect(() => {
    loadRoom().catch((error) => toast.error(error.message || '房间加载失败'));
    lastMessageIdRef.current = 0;
    setMessages([]);
  }, [loadRoom, roomId]);

  useEffect(() => {
    loadMessages().catch(() => {});
    const interval = setInterval(() => {
      loadRoom().catch(() => {});
      loadMessages().catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, [loadMessages, loadRoom]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (effectiveStatus === 'voting') {
      setMobileVoteOpen(true);
    }
  }, [effectiveStatus]);

  useEffect(() => {
    if (!campaignLevel || !result || (room?.status !== 'revealed' && room?.status !== 'archived')) return;
    const stars = resultStars(result);
    if (stars <= 0) return;
    const progress = loadCampaignProgress();
    const levelKey = String(campaignLevel.levelNumber);
    if ((progress.bestStars[levelKey] || 0) >= stars && progress.highestUnlockedLevel >= campaignLevel.levelNumber + 1) return;
    progress.bestStars[levelKey] = Math.max(progress.bestStars[levelKey] || 0, stars);
    progress.clearedAt[levelKey] = new Date().toISOString();
    progress.highestUnlockedLevel = Math.max(progress.highestUnlockedLevel, campaignLevel.levelNumber + 1);
    saveCampaignProgress(progress);
  }, [campaignLevel, result, room?.status]);

  useEffect(() => {
    if (!humanHuntLevel || !result || (room?.status !== 'revealed' && room?.status !== 'archived')) return;
    const stars = resultStars(result);
    if (stars <= 0) return;
    const progress = loadHumanHuntProgress();
    const levelKey = String(humanHuntLevel.levelNumber);
    if ((progress.bestStars[levelKey] || 0) >= stars && progress.highestUnlockedLevel >= humanHuntLevel.levelNumber + 1) return;
    progress.bestStars[levelKey] = Math.max(progress.bestStars[levelKey] || 0, stars);
    progress.clearedAt[levelKey] = new Date().toISOString();
    progress.highestUnlockedLevel = Math.max(progress.highestUnlockedLevel, Math.min(9, humanHuntLevel.levelNumber + 1));
    saveHumanHuntProgress(progress);
  }, [humanHuntLevel, result, room?.status]);

  const join = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId, displayName: name || '玩家' }),
      });
      const data = await res.json();
      localStorage.setItem(playerStorageKey(roomId), data.data.playerId);
      localStorage.setItem('ai-game-name', name || '玩家');
      setPlayerId(data.data.playerId);
      await loadRoom();
    } catch (error: any) {
      toast.error(error.message || '加入失败');
    } finally {
      setBusy(false);
    }
  };

  const joinAsObserver = useCallback(async () => {
    if (!roomId || playerId || observeJoinAttemptedRef.current === roomId) return;
    observeJoinAttemptedRef.current = roomId;
    setBusy(true);
    try {
      const res = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId, displayName: name || '观众', joinAs: 'observer' }),
      });
      const data = await res.json();
      localStorage.setItem(playerStorageKey(roomId), data.data.playerId);
      localStorage.setItem('ai-game-name', name || '观众');
      setPlayerId(data.data.playerId);
      if (data.data.message) toast.info(data.data.message);
      else toast.success('已进入围观模式');
    } catch (error: any) {
      observeJoinAttemptedRef.current = '';
      toast.error(error.message || '进入围观失败');
    } finally {
      setBusy(false);
    }
  }, [name, playerId, roomId]);

  useEffect(() => {
    if (observeInvite && !playerId) {
      joinAsObserver();
    }
  }, [joinAsObserver, observeInvite, playerId]);

  const start = async () => {
    if (!currentPlayer || isObserver) {
      toast.error('请先加入房间');
      return;
    }
    setBusy(true);
    try {
      await request('/api/ai-game/start', { method: 'POST', body: JSON.stringify({ roomId, playerId: currentPlayer.id }) });
      const loadedRoom = await loadRoom();
      await loadMessages();
      if (loadedRoom?.mode === 'human_hunt') {
        await request('/api/ai-game/ai-turn', { method: 'POST', body: JSON.stringify({ roomId }) });
        await loadMessages();
        await loadRoom();
      }
    } catch (error: any) {
      toast.error(error.message || '开始失败');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!input.trim() || !currentPlayer || currentStatus !== 'playing') return;
    const content = input;
    setInput('');
    try {
      await request('/api/ai-game/send', {
        method: 'POST',
        body: JSON.stringify({ roomId, playerId: currentPlayer.id, content }),
      });
      await loadMessages();
      request('/api/ai-game/ai-turn', { method: 'POST', body: JSON.stringify({ roomId }) })
        .then(() => loadMessages())
        .then(() => loadRoom())
        .catch((error) => toast.error(error.message || 'AI 暂时没接上话'));
    } catch (error: any) {
      setInput(content);
      toast.error(error.message || '发送失败');
    }
  };

  const requestAiChatRound = async () => {
    if (!roomId || currentStatus !== 'playing') return;
    setAiChatPending(true);
    try {
      await request('/api/ai-game/ai-turn', {
        method: 'POST',
        body: JSON.stringify({ roomId, force: true }),
      });
      await loadMessages();
      await loadRoom();
    } catch (error: any) {
      toast.error(error.message || 'AI 暂时没接上话');
    } finally {
      setAiChatPending(false);
    }
  };

  const requestPostGameReviews = async () => {
    setPostGameReviewPending(true);
    try {
      await request('/api/ai-game/reviews', {
        method: 'POST',
        body: JSON.stringify({ roomId, playerId: currentPlayer?.id }),
      });
      await loadMessages();
    } catch (error: any) {
      toast.error(error.message || 'AI 复盘失败');
    } finally {
      setPostGameReviewPending(false);
    }
  };

  const vote = async () => {
    if (!selectedVote || !currentPlayer) return;
    setBusy(true);
    setVotingPending(true);
    setPostGameReviewPending(false);
    try {
      await request('/api/ai-game/vote', {
        method: 'POST',
        body: JSON.stringify({ roomId, voterPlayerId: currentPlayer.id, targetPlayerId: selectedVote }),
      });
      setVotingPending(false);
      toast.success('投票已提交');
      setSelectedVote('');
      setMobileVoteOpen(false);
      const loadedRoom = await loadRoom();
      await loadMessages();
      if (loadedRoom?.status === 'revealed' || loadedRoom?.status === 'archived') {
        await requestPostGameReviews();
      } else if (loadedRoom?.mode === 'human_hunt' && loadedRoom?.status === 'playing') {
        request('/api/ai-game/ai-turn', { method: 'POST', body: JSON.stringify({ roomId }) })
          .then(() => loadMessages())
          .then(() => loadRoom())
          .catch((error) => toast.error(error.message || 'AI 暂时没接上话'));
      }
    } catch (error: any) {
      toast.error(error.message || '投票失败');
    } finally {
      setVotingPending(false);
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (!currentPlayer || isObserver) {
      toast.error('只有玩家可以揭晓身份');
      return;
    }
    if (campaignLevel) {
      toast.error('闯关模式不能直接揭晓身份');
      return;
    }
    setBusy(true);
    try {
      await request('/api/ai-game/reveal', { method: 'POST', body: JSON.stringify({ roomId, playerId: currentPlayer.id }) });
      const loadedRoom = await loadRoom();
      await loadMessages();
      if (loadedRoom?.status === 'revealed' || loadedRoom?.status === 'archived') {
        await requestPostGameReviews();
      }
    } catch (error: any) {
      toast.error(error.message || '揭晓失败');
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    setShareDialogOpen(true);
  };

  const copyObserveInvite = async () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('observe', '1');
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    toast.success('围观链接已复制');
    setTimeout(() => setCopied(false), 1800);
  };

  const createCampaignRoomFromLevel = async (level: AiGameCampaignLevel) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  const createHumanHuntRoomFromLevel = async (level: AiGameHumanHuntLevel) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  if (!room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c2410c] border-t-transparent" />
      </div>
    );
  }

  const modeRules = aiGameModes.find(item => item.id === room.mode) || aiGameModes[0];
  const currentStatus = effectiveStatus || room.status;
  const isObserver = currentPlayer?.player_type === 'observer';
  const isJuryMode = room.mode === 'jury';
  const isUndercoverMode = room.mode === 'undercover';
  const isHumanHuntMode = room.mode === 'human_hunt';
  const humanHuntTurnState = isHumanHuntMode ? getHumanHuntTurnState(players, messages) : null;
  const currentPlayerEliminated = !!currentPlayer?.eliminated_at;
  const isParticipant = !!currentPlayer && !isObserver;
  const campaignTimedOut = !!campaignLevel && !revealed && room.status === 'playing' && secondsLeft <= 0;
  const activeAiCount = activeCandidatePlayers.filter(player => player.player_type === 'ai').length;
  const needsDescriptionBeforeVote = isUndercoverMode && latestOwnDescriptionId <= latestUndercoverVoteResultId;
  const needsAiRoundBeforeVote = isUndercoverMode && !needsDescriptionBeforeVote && aiMessagesAfterOwnDescriptionCount < Math.max(1, activeAiCount);
  const humanHuntCanVote = !isHumanHuntMode || !!humanHuntTurnState?.canVote;
  const canVote = isParticipant && !currentPlayerEliminated && (isHumanHuntMode ? currentStatus === 'playing' || currentStatus === 'voting' : (currentStatus === 'playing' || currentStatus === 'voting')) && !revealed && !needsDescriptionBeforeVote && !needsAiRoundBeforeVote && !campaignTimedOut && humanHuntCanVote;
  const canSpeak = isParticipant && !currentPlayerEliminated && currentStatus === 'playing' && !campaignTimedOut;
  const canReveal = isParticipant && !campaignLevel && !isHumanHuntMode && !campaignTimedOut;
  const canGuess = canVote && !isJuryMode;
  const voteHint = needsDescriptionBeforeVote
    ? (latestUndercoverVoteResultId > 0 ? '上一轮已完成投票，请先继续描述或追问后再投下一轮。' : '先描述你的词或追问一次，再进行投票。')
    : needsAiRoundBeforeVote
      ? '请等 AI 完成本轮描述后再投票。'
      : isHumanHuntMode && currentStatus === 'playing'
        ? humanHuntTurnState?.canVote
          ? '可以发起投票，也可以继续自由聊。'
          : `再聊几句后投票，本轮至少需要 ${humanHuntTurnState?.minSpeechCount || activeCandidatePlayers.length} 条发言，且 ${humanHuntTurnState?.minUniqueSpeakerCount || activeCandidatePlayers.length} 人发过言。`
      : undefined;
  const statusText = (() => {
    if (campaignTimedOut) return '挑战失败';
    if (revealed) return isJuryMode ? '已宣判' : '已揭晓';
    if (currentStatus === 'waiting') return '等待开局';
    if (isHumanHuntMode && currentStatus === 'playing') return humanHuntTurnState?.round ? `第 ${humanHuntTurnState.round} 轮自由聊` : '自由聊';
    if (isHumanHuntMode && currentStatus === 'voting') return '投票中';
    if (isJuryMode && currentStatus === 'playing') return secondsLeft > 0 ? `庭审剩余 ${secondsLeft}s` : '可请求宣判';
    if (isUndercoverMode && currentStatus === 'playing') return '进行中';
    if (currentStatus === 'playing') return `剩余 ${secondsLeft}s`;
    if (currentStatus === 'voting') return '投票中';
    return '进行中';
  })();
  const showHeaderCountdown = !isHumanHuntMode && currentStatus === 'playing' && !revealed && !campaignTimedOut && startedAt && room;
  const nextCampaignLevel = campaignLevel ? generateCampaignLevel(campaignLevel.levelNumber + 1) : undefined;
  const nextHumanHuntLevel = humanHuntLevel && humanHuntLevel.levelNumber < 9 ? generateHumanHuntLevel(humanHuntLevel.levelNumber + 1) : undefined;
  const campaignStars = (campaignLevel || humanHuntLevel) && result && revealed ? resultStars(result) : 0;
  const controlPanelProps = {
    room,
    modeRules,
    effectiveStatus: currentStatus,
    players,
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
    aiChatPending,
    revealed,
    isObserver,
    isJuryMode,
    isUndercoverMode,
    isHumanHuntMode,
    result,
    campaignLevel,
    humanHuntLevel,
    campaignStars,
    copied,
    onStart: start,
    onCopyShare: copyShare,
    onNewGame: () => navigate(isHumanHuntMode ? '/ai-game/whoishuman' : '/ai-game/whoisundercover'),
    onReplay: campaignLevel ? () => createCampaignRoomFromLevel(campaignLevel) : humanHuntLevel ? () => createHumanHuntRoomFromLevel(humanHuntLevel) : undefined,
    onNextCampaign: campaignStars > 0 && nextCampaignLevel ? () => createCampaignRoomFromLevel(nextCampaignLevel) : campaignStars > 0 && nextHumanHuntLevel ? () => createHumanHuntRoomFromLevel(nextHumanHuntLevel) : undefined,
    onAiChatRound: isHumanHuntMode ? requestAiChatRound : undefined,
    onConfirm: (action: 'vote' | 'reveal') => setConfirmAction(action),
    voteHint,
  };
  const challengeUrl = typeof window !== 'undefined'
    ? humanHuntLevel
      ? buildHumanHuntChallengeUrl(window.location.href, humanHuntLevel.levelNumber)
      : buildAiGameChallengeUrl(window.location.href, campaignLevel?.levelNumber)
    : '';
  const hasGameOverMessage = messages.some(message =>
    message.sender_type === 'system'
    && message.content.startsWith('投票完成')
    && (message.content.includes('游戏结束') || message.content.includes('身份已揭晓'))
  );
  const renderCampaignSettlementCard = () => {
    if ((!campaignLevel && !humanHuntLevel) || !revealed || !result) return null;
    const wordPair = extractUndercoverWordPair(result.summary);
    const title = humanHuntLevel ? humanHuntLevel.title : campaignLevel?.title || '';
    const heading = humanHuntLevel ? '谁是人类结算' : '晋级赛结算';
    const successText = humanHuntLevel ? '人类伪装成功，下一关已解锁。' : '通关成功，下一关已解锁。';
    const failText = humanHuntLevel ? '这关被 AI 找出来了，重玩一次控制发言细节。' : '这关还没通关，重玩一次调整发言和投票策略。';
    return (
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 md:hidden">
        <div className="mx-auto max-w-sm rounded-lg border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{heading}</div>
              <div className="truncate text-xs text-muted-foreground">{title}</div>
            </div>
            <div className="flex text-[#c2410c]">
              {Array.from({ length: 3 }).map((_, index) => (
                <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            {campaignStars > 0 ? successText : failText}
          </div>
          {wordPair && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">平民词</div>
                <div className="mt-0.5 truncate font-semibold text-foreground">{wordPair.civilianWord}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">卧底词</div>
                <div className="mt-0.5 truncate font-semibold text-foreground">{wordPair.undercoverWord}</div>
              </div>
            </div>
          )}
          {!isObserver && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (campaignLevel) createCampaignRoomFromLevel(campaignLevel);
                  else if (humanHuntLevel) createHumanHuntRoomFromLevel(humanHuntLevel);
                }}
                disabled={busy}
              >
                重玩
              </Button>
              {campaignStars > 0 && nextCampaignLevel ? (
                <Button size="sm" onClick={() => createCampaignRoomFromLevel(nextCampaignLevel)} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  下一关
                </Button>
              ) : campaignStars > 0 && nextHumanHuntLevel ? (
                <Button size="sm" onClick={() => createHumanHuntRoomFromLevel(nextHumanHuntLevel)} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  下一关
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate(isHumanHuntMode ? '/ai-game/whoishuman' : '/ai-game/whoisundercover')} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  返回地图
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background">
      <div className="flex h-full flex-col">
        <header className="flex flex-none items-center justify-between border-b bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
            onClick={() => navigate(isHumanHuntMode ? '/ai-game/whoishuman' : '/ai-game/whoisundercover')}
              aria-label="返回"
              title="返回"
              className="h-8 w-8 flex-none rounded-full p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{room.title.replace(/\s*\[tier:[^\]]+\]/, '')}</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span>{statusText}</span>
                {showHeaderCountdown && (
                  <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                    secondsLeft <= 30
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-muted text-foreground'
                  }`}>
                    {formatCountdown(secondsLeft)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyObserveInvite}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
            邀请围观
          </Button>
        </header>

        {effectiveStatus === 'playing' && !isHumanHuntMode && startedAt && room && (
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${Math.max(0, (secondsLeft / room.duration_seconds) * 100)}%`,
                backgroundColor: secondsLeft > room.duration_seconds * 0.5
                  ? '#22c55e'
                  : secondsLeft > room.duration_seconds * 0.2
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
          </div>
        )}

        <main className="grid flex-1 overflow-hidden md:grid-cols-[1fr_320px]">
          <section className="flex min-w-0 min-h-0 flex-col bg-muted">
            <div className="min-w-0 flex-1 overflow-y-auto px-2 py-2 md:px-3 md:py-3">
              <div className="mx-auto max-w-3xl min-w-0 space-y-3">
                {isHumanHuntMode && currentStatus === 'playing' && (humanHuntTurnState?.round ?? 0) > 0 && (
                  <div className="sticky top-0 z-10 rounded-lg border border-[#c2410c]/30 bg-orange-50 px-3 py-2 text-sm shadow-sm dark:bg-orange-950/20">
                    <div className="text-xs text-muted-foreground">第 {humanHuntTurnState?.round} 轮自由讨论</div>
                    <div className="mt-0.5 font-medium text-[#c2410c]">
                      {humanHuntTurnState?.speechCount}/{humanHuntTurnState?.minSpeechCount} 条 · {humanHuntTurnState?.uniqueSpeakerCount}/{humanHuntTurnState?.minUniqueSpeakerCount} 人后可投票
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {humanHuntTurnState?.currentSpeaker
                        ? `${humanHuntTurnState?.currentSpeaker?.display_name} 先开场`
                        : humanHuntTurnState?.canVote
                          ? '可以投票，也可以继续聊'
                          : '自由发言中'}
                    </div>
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="flex h-56 flex-col items-center justify-center text-center text-muted-foreground">
                    <Eye className="mb-3 h-8 w-8" />
                    <div className="text-sm">开局后开始聊天，别太快暴露自己。</div>
                  </div>
                )}
                {messages.map(message => {
                  const mine = message.player_id === playerId;
                  const system = message.sender_type === 'system';
                  const avatar = getAvatarData(message.sender_name);
                  if (system) {
                    const isVoteResult = message.content.startsWith('投票完成');
                    const isGameOver = isVoteResult && (message.content.includes('游戏结束') || message.content.includes('身份已揭晓'));
                    const isGameStart = message.content.startsWith('游戏开始') || message.content.startsWith('谁是人类开始') || message.content.startsWith('开庭') || message.content.startsWith('单人鉴定');
                    const isElimination = message.content.includes('出局') && !isGameOver;

                    if (isGameOver) {
                      const { votes: votePairs, eliminatedName, resultLines } = parseVoteResultMessage(message.content);
                      const visibleVoteNames = new Set(votePairs.flatMap(pair => [pair.voter, pair.target]));
                      const priorEliminatedPlayers = candidatePlayers.filter(player => player.eliminated_at && !visibleVoteNames.has(player.display_name));
                      return (
                        <div key={message.id} className="space-y-3">
                          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                            <div className="mx-auto max-w-sm rounded-xl border border-red-200 bg-red-50/60 p-3 shadow-sm md:border-border md:bg-card dark:border-red-900/40 dark:bg-red-950/20 md:dark:border-border md:dark:bg-card">
                              <Trophy className="mx-auto mb-2 h-6 w-6 text-[#c2410c] md:hidden" />
                              <Vote className="mx-auto mb-1 hidden h-4 w-4 text-red-500 md:block" />
                              <div className="text-center text-sm font-semibold text-foreground">
                                <span className="md:hidden">游戏结束</span>
                                <span className="hidden md:inline">最终投票</span>
                              </div>
                              {(votePairs.length > 0 || priorEliminatedPlayers.length > 0) && (
                                <div className="mt-3 space-y-1.5 rounded-lg bg-white/60 p-2 md:bg-muted dark:bg-black/20">
                                  {votePairs.map((pair, i) => {
                                    const voter = candidatePlayers.find(player => player.display_name === pair.voter);
                                    const target = candidatePlayers.find(player => player.display_name === pair.target);
                                    return (
                                      <VoteRecord
                                        key={i}
                                        voterName={pair.voter}
                                        targetName={pair.target}
                                        voterRole={getPlayerRoleLabel({ player: voter, isUndercoverMode })}
                                        targetRole={getPlayerRoleLabel({ player: target, isUndercoverMode })}
                                        targetEliminated={pair.target === eliminatedName}
                                      />
                                    );
                                  })}
                                  {priorEliminatedPlayers.map(player => (
                                    <EliminatedIdentityRecord
                                      key={player.id}
                                      player={player}
                                      isUndercoverMode={isUndercoverMode}
                                    />
                                  ))}
                                </div>
                              )}
                              {resultLines.length > 0 && (
                                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground leading-relaxed text-center md:hidden">
                                  {resultLines.map((line, i) => (
                                    <p key={i}>{line}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {renderCampaignSettlementCard()}
                        </div>
                      );
                    }

                    if (isVoteResult) {
                      const { votes: votePairs, eliminatedName, resultLines } = parseVoteResultMessage(message.content);
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-sm rounded-xl border border-red-200 bg-red-50/60 p-3 shadow-sm dark:border-red-900/40 dark:bg-red-950/20">
                            <div className="mb-2 flex items-center justify-center gap-1.5">
                              <Vote className="h-4 w-4 text-red-500" />
                              <span className="text-xs font-semibold text-red-700 dark:text-red-400">投票记录</span>
                            </div>
                            {votePairs.length > 0 && (
                              <div className="space-y-1.5 rounded-lg bg-white/60 p-2 dark:bg-black/20">
                                {votePairs.map((pair, i) => (
                                  <VoteRecord
                                    key={i}
                                    voterName={pair.voter}
                                    targetName={pair.target}
                                    targetEliminated={pair.target === eliminatedName}
                                  />
                                ))}
                              </div>
                            )}
                            {resultLines.length > 0 && (
                              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground leading-relaxed text-center">
                                {resultLines.map((line, i) => (
                                  <p key={i}>{line}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isElimination) {
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-xs rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                            <AlertCircle className="mx-auto mb-1 h-3.5 w-3.5 text-amber-600" />
                            <div className="text-xs text-amber-800 dark:text-amber-300">{message.content}</div>
                          </div>
                        </div>
                      );
                    }

                    if (isGameStart) {
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-sm rounded-lg border border-[#c2410c]/30 bg-orange-50/60 px-4 py-2.5 text-center dark:bg-orange-950/20">
                            <Play className="mx-auto mb-1 h-3.5 w-3.5 text-[#c2410c]" />
                            <div className="text-xs font-medium text-[#c2410c]">{message.content}</div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <div className="mx-auto max-w-xs rounded-lg bg-muted px-4 py-2 text-center">
                          <div className="text-xs text-muted-foreground">{message.content}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={message.id} className={`animate-in fade-in-0 slide-in-from-bottom-2 duration-300 flex items-start gap-2 ${mine ? 'justify-end' : ''}`}>
                      {!mine && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>{message.sender_name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[78%] ${mine ? 'text-right' : ''}`}>
                        <div className="text-xs text-muted-foreground">{message.sender_name}</div>
                        <div className={`mt-1 rounded-lg px-3 py-2 text-sm shadow-sm ${mine ? 'bg-blue-600 text-left text-white' : 'bg-card'}`}>
                          {message.content}
                        </div>
                      </div>
                      {mine && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>{message.sender_name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                {!hasGameOverMessage && renderCampaignSettlementCard()}
                {votingPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在投票，等待结果…
                  </div>
                )}
                {aiChatPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在聊天…
                  </div>
                )}
                {postGameReviewPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在复盘…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="flex-none border-t bg-card p-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className="mx-auto mb-2 max-w-3xl">
                <MobileActionCard {...controlPanelProps} voteOpen={mobileVoteOpen} setVoteOpen={setMobileVoteOpen} />
              </div>
              {isObserver ? (
                <div className="text-center text-sm text-muted-foreground">你正在围观本局</div>
              ) : !currentPlayer && room.status === 'waiting' ? (
                <div className="mx-auto flex max-w-3xl gap-2">
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} placeholder="你的昵称" />
                  <Button onClick={join} disabled={busy}>加入</Button>
                </div>
              ) : currentStatus === 'playing' ? (
                <div className="mx-auto flex max-w-3xl gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') send(); }}
                    placeholder={currentPlayerEliminated ? '你已出局，可以继续观看本局' : isHumanHuntMode ? '自由聊，试探别人，也别太像真人...' : isUndercoverMode ? '描述你的词，别直接说出词语...' : isJuryMode ? '为自己辩护，或者反问证人...' : isObserver ? '向候选玩家提一个问题...' : currentPlayer ? '自然点，别像 AI...' : '你正在围观本局'}
                    disabled={!canSpeak}
                    maxLength={500}
                  />
                  <Button onClick={send} disabled={!canSpeak || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">当前阶段不能发言</div>
              )}
            </div>
          </section>

          <aside className="hidden min-h-0 border-l bg-card md:flex">
            <GameControlPanel {...controlPanelProps} />
          </aside>
        </main>
      </div>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'vote' ? '确认投票' : '确认揭晓'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'vote'
                ? isHumanHuntMode
                  ? `确定要投出「${candidatePlayers.find(p => p.id === selectedVote)?.display_name || '该玩家'}」吗？目标是淘汰 AI，投票后不可撤回。`
                  : `确定要投给「${candidatePlayers.find(p => p.id === selectedVote)?.display_name || '该玩家'}」吗？投票后不可撤回。`
                : '揭晓后将公布所有玩家身份，本局结束。确定要揭晓吗？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
            <Button
              className="bg-[#c2410c] text-white hover:bg-[#9a3412]"
              onClick={async () => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'vote') {
                  await vote();
                } else if (action === 'reveal') {
                  await reveal();
                }
              }}
              disabled={busy || (confirmAction === 'reveal' && !canReveal)}
            >
              {busy ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {revealed && (
        <AiGameShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          room={room}
          result={result}
          campaignLevel={campaignLevel}
          humanHuntLevel={humanHuntLevel}
          campaignStars={campaignStars}
          currentPlayerSecret={currentPlayerSecret}
          challengeUrl={challengeUrl}
        />
      )}
    </div>
  );
}
