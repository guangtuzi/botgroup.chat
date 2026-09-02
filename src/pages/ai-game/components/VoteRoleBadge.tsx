// 卧底 / AI 身份用红色高亮，平民等其余身份用绿色
export default function VoteRoleBadge({ label }: { label?: string | null }) {
  if (!label) return null;
  const highlight = label === '卧底' || label === 'AI';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${highlight ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
      {label}
    </span>
  );
}
