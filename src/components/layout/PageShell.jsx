import { ChevronLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageShell({
  title,
  subtitle,
  children,
  backTo = null,
  backLabel = "Powrot",
  actions = null,
  icon = null,
  compact = false,
}) {
  const navigate = useNavigate();

  return (
    <div className={`page-shell ${compact ? "page-shell-compact" : ""}`}>
      <div className="page-shell__back-row">
        {backTo !== null ? (
          <button
            type="button"
            className="app-icon-button"
            onClick={() => (typeof backTo === "number" ? navigate(backTo) : navigate(backTo))}
            aria-label={backLabel}
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <div className="page-shell__pill">
            <Sparkles size={14} />
            StockWise
          </div>
        )}

        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </div>

      <div className="page-shell__hero">
        <div className="page-shell__eyebrow">Warehouse Flow</div>
        <div className="page-shell__title-row">
          {icon ? <div className="page-shell__icon">{icon}</div> : null}
          <div>
            <h1 className="page-shell__title">{title}</h1>
            {subtitle ? <p className="page-shell__subtitle">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className="page-shell__content">{children}</div>
    </div>
  );
}
