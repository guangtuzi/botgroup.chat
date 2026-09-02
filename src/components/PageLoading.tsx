import { Loader2 } from 'lucide-react';

export default function PageLoading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
