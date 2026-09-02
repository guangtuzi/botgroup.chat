import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import BasicLayout from './layouts/BasicLayout';
import AuthGuard from './components/AuthGuard';
import PageLoading from './components/PageLoading';

const Login = lazy(() => import('./pages/login'));
const Chat = lazy(() => import('./pages/chat'));
const AiGamePage = lazy(() => import('./pages/ai-game'));

const lazyPage = (node: ReactNode) => (
  <Suspense fallback={<PageLoading />}>{node}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: lazyPage(<Login />),
  },
  {
    path: '/ai-game',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/ai-game/whoisundercover',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/ai-game/whoisundercover/:roomId',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/ai-game/whoishuman',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/ai-game/whoishuman/:roomId',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/ai-game/:roomId',
    element: lazyPage(<AiGamePage />),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <BasicLayout />
      </AuthGuard>
    ),
    children: [
      {
        path: '',
        element: lazyPage(<Chat />),
      },
    ],
  },
]);
