import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-7xl font-bold tracking-tighter text-muted-foreground/60">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold">页面找不到了</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          你访问的链接可能已失效、输错了，或者被搬走了。
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回上一页
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              回到首页
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}