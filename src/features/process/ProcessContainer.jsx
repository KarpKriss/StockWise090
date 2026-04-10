import ProcessStart from './ProcessStart.jsx';
import ProcessFlow from './ProcessFlowV2.jsx';
import EmptyLocationProcess from './EmptyLocationProcess.jsx';
import ManualInventoryProcess from './ManualInventoryProcess.jsx';
import { useSession } from '../../core/session/AppSession';

export default function ProcessContainer() {
  const { session, loading, processType } = useSession();

  if (loading) return <div>Loading...</div>;

  if (!session) return <ProcessStart />;

if (!processType) return <ProcessStart />;

if (processType === "empty") return <EmptyLocationProcess />;
if (processType === "manual") return <ManualInventoryProcess />;

return <ProcessFlow />;
}
