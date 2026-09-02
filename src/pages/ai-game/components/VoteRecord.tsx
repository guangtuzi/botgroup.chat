import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarData } from '@/utils/avatar';
import VoteRoleBadge from './VoteRoleBadge';

export default function VoteRecord({
  voterName,
  targetName,
  voterRole,
  targetRole,
  targetEliminated,
}: {
  voterName: string;
  targetName: string;
  voterRole?: string | null;
  targetRole?: string | null;
  targetEliminated?: boolean;
}) {
  const voterAvatar = getAvatarData(voterName);
  const targetAvatar = getAvatarData(targetName);
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <Avatar className="h-5 w-5">
        <AvatarFallback style={{ backgroundColor: voterAvatar.backgroundColor, color: 'white', fontSize: 10 }}>{voterName[0]}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium">{voterName}</span>
      <VoteRoleBadge label={voterRole} />
      <span className="text-muted-foreground">→</span>
      <Avatar className={`h-5 w-5 ${targetEliminated ? 'opacity-50 grayscale' : ''}`}>
        <AvatarFallback style={{ backgroundColor: targetAvatar.backgroundColor, color: 'white', fontSize: 10 }}>{targetName[0]}</AvatarFallback>
      </Avatar>
      <span className={`min-w-0 truncate font-medium ${targetEliminated ? 'line-through text-muted-foreground' : ''}`}>{targetName}</span>
      <VoteRoleBadge label={targetRole} />
      {targetEliminated && <span className="flex-none font-medium text-red-500">已出局</span>}
    </div>
  );
}
