import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { useSession } from "../../core/session/AppSession";
import EmptyLocationProcess from "./EmptyLocationProcessModern.jsx";
import ManualInventoryProcess from "./ManualInventoryProcess.jsx";
import ProcessFlow from "./ProcessFlowV2.jsx";
import ProcessStart from "./ProcessStartModern.jsx";

export default function ProcessContainer() {
  const { t } = useAppPreferences();
  const { session, loading, processType } = useSession();

  if (loading) {
    return <LoadingOverlay open fullscreen message={t("processStart.overlay")} />;
  }

  if (!session || !processType) return <ProcessStart />;

  if (processType === "empty") return <EmptyLocationProcess />;
  if (processType === "manual") return <ManualInventoryProcess />;

  return <ProcessFlow />;
}
