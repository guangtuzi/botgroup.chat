import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarData } from '@/utils/avatar';
import type { GamePlayer } from '../types';

export default function PlayerAvatar({
  player,
  revealed,
  compact = false,
}: {
  player: GamePlayer;
  revealed?: boolean;
  compact?: boolean;
}) {
  const avatar = getAvatarData(player.display_name);
  const label = revealed && player.secret_role === 'ai' ? 'AI' : player.display_name[0];
  return (
    <Avatar className={compact ? 'h-7 w-7' : 'h-9 w-9'}>
      <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>
        {label}
      </AvatarFallback>
    </Avatar>
  );
}
