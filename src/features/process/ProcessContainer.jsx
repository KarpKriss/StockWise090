import ProcessStart from './ProcessStart.jsx';
import ProcessFlow from './ProcessFlowV2.jsx';
import { useSession } from '../../core/session/AppSession';

export default function ProcessContainer() {
  const { session, loading, processType } = useSession();

  if (loading) return <div>Loading...</div>;

  if (!session) return <ProcessStart />;

if (!processType) return <ProcessStart />;

return <ProcessFlow />;
}
