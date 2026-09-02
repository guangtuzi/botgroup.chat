import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarData } from '@/utils/avatar';
import { getPlayerRoleLabel } from '../voteMessage';
import type { GamePlayer } from '../types';
import VoteRoleBadge from './VoteRoleBadge';

export default function EliminatedIdentityRecord({
  player,
  isUndercoverMode,
}: {
  player: GamePlayer;
  isUndercoverMode: boolean;
}) {
  const avatar = getAvatarData(player.display_name);
  const roleLabel = getPlayerRoleLabel({ player, isUndercoverMode });

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="flex-none rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-red-700 dark:bg-red-950/40 dark:text-red-400">已出局</span>
      <Avatar className="h-5 w-5 flex-none opacity-50 grayscale">
        <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white', fontSize: 10 }}>{player.display_name[0]}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium text-muted-foreground line-through">{player.display_name}</span>
      <VoteRoleBadge label={roleLabel} />
    </div>
  );
}
