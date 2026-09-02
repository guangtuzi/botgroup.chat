import { useParams } from 'react-router-dom';
import AiGameHome from './AiGameHome';
import AiGameRoom from './AiGameRoom';

// 有 roomId 进房间页，否则进玩法首页（首页内部再按 pathname 区分卧底 / 谁是人类）
export default function AiGamePage() {
  const { roomId } = useParams();
  return roomId ? <AiGameRoom /> : <AiGameHome />;
}
