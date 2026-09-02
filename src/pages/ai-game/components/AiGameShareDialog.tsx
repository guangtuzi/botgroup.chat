import { useMemo, useRef } from 'react';
import { Copy, Download, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { AiGameCampaignLevel, AiGameHumanHuntLevel } from '@/config/aiGame';
import { createQrSvgDataUrl } from '../qr';
import { extractUndercoverWordPair, resultStars } from '../format';
import type { CurrentPlayerSecret, GameResult, GameRoomData } from '../types';

export default function AiGameShareDialog({
  open,
  onOpenChange,
  room,
  result,
  campaignLevel,
  humanHuntLevel,
  campaignStars,
  currentPlayerSecret,
  challengeUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: GameRoomData;
  result: GameResult | null;
  campaignLevel: AiGameCampaignLevel | null;
  humanHuntLevel?: AiGameHumanHuntLevel | null;
  campaignStars: number;
  currentPlayerSecret: CurrentPlayerSecret | null;
  challengeUrl: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wordPair = extractUndercoverWordPair(result?.summary);
  const stars = resultStars(result);
  const guessedRight = stars > 0;
  const title = humanHuntLevel
    ? `谁是人类 第 ${humanHuntLevel.levelNumber} 关`
    : campaignLevel ? `卧底晋级赛 第 ${campaignLevel.levelNumber} 关` : room.title.replace(/\s*\[tier:[^\]]+\]/, '');
  const verdict = humanHuntLevel
    ? guessedRight ? '藏到了最后' : '被 AI 找到了'
    : guessedRight ? '一票抓住破绽' : '这局被带偏了';
  const roleText = humanHuntLevel ? '人类' : currentPlayerSecret?.role === 'undercover' ? '卧底' : currentPlayerSecret?.role ? '平民' : '玩家';
  const qrCodeUrl = useMemo(() => {
    try {
      return createQrSvgDataUrl(challengeUrl);
    } catch {
      return '';
    }
  }, [challengeUrl]);

  const copyChallengeLink = async () => {
    await navigator.clipboard.writeText(challengeUrl);
    toast.success('挑战链接已复制');
  };

  const savePoster = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#fff7ed',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
      if (!blob) throw new Error('poster blob failed');

      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share && navigator.canShare?.({ files: [new File([blob], 'ai-game-result.png', { type: 'image/png' })] })) {
        await navigator.share({
          files: [new File([blob], 'ai-game-result.png', { type: 'image/png' })],
          title: title,
          text: result?.share_text || '我刚玩了一局谁是卧底',
        });
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = 'ai-game-result.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
    } catch (error) {
      console.error('ai-game share poster failed:', error);
      toast.error('保存战绩卡失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>战绩卡</DialogTitle>
          <DialogDescription>保存战绩卡或复制挑战链接</DialogDescription>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto p-3">
          <div ref={cardRef} className="overflow-hidden rounded-lg border border-orange-200 bg-orange-50 text-zinc-950 shadow-sm">
            <div className="bg-[#c2410c] px-5 py-4 text-white">
              <div className="text-xs opacity-80">谁是卧底 · 战绩卡</div>
              <div className="mt-1 text-xl font-semibold tracking-normal">{verdict}</div>
              <div className="mt-1 truncate text-sm opacity-90">{title}</div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">结果</div>
                  <div className="mt-1 text-sm font-semibold">{guessedRight ? '成功' : '失败'}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">身份</div>
                  <div className="mt-1 text-sm font-semibold">{roleText}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">星级</div>
                  <div className="mt-1 flex justify-center text-[#c2410c]">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                </div>
              </div>
              {wordPair && (
                <div className="rounded-md bg-white p-3">
                  <div className="text-xs text-zinc-500">本局词组</div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span>平民词 <b>{wordPair.civilianWord}</b></span>
                    <span className="text-zinc-300">/</span>
                    <span>卧底词 <b>{wordPair.undercoverWord}</b></span>
                  </div>
                </div>
              )}
              <div className="rounded-md bg-white p-3 text-sm leading-6 text-zinc-700">
                {result?.share_text || '我刚玩了一局谁是卧底，来挑战同一关。'}
              </div>
              <div className="flex items-center gap-3 border-t border-orange-200 pt-3">
                {qrCodeUrl && (
                  <img
                    src={qrCodeUrl}
                    alt="挑战二维码"
                    className="h-20 w-20 flex-none rounded-md border border-orange-100 bg-white p-1"
                  />
                )}
                <div className="min-w-0 text-xs leading-5 text-zinc-500">
                  <div className="font-medium text-zinc-700">扫码挑战同一关</div>
                  <div className="mt-0.5 break-all">{challengeUrl}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={copyChallengeLink}>
              <Copy className="mr-2 h-4 w-4" />
              复制挑战链接
            </Button>
            <Button onClick={savePoster} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
              <Download className="mr-2 h-4 w-4" />
              保存图片
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
