import { ArrowRight, Camera, Download, FileText, Settings2, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/layout/PageShell";
import "../../features/menu/menu-modern.css";

const SETTINGS_ITEMS = [
  {
    title: "Uzytkownicy",
    description: "Zarzadzanie kontami, rolami i dostepem operatorow do systemu.",
    path: "/admin/users",
    icon: Users,
  },
  {
    title: "Konfiguracja procesu",
    description: "Przeglad krokow procesu, wymaganych pol i logiki skanowania.",
    path: "/admin/process-config",
    icon: SlidersHorizontal,
  },
  {
    title: "Skanowanie",
    description: "Wlaczanie kamery, wybór pol procesu i formatow kodow dla telefonow operatorow.",
    path: "/admin/scanning",
    icon: Camera,
  },
  {
    title: "Import/Export",
    description: "Skroty do obslugi danych wsadowych, eksportow i konfiguracji zasilek.",
    path: "/admin/import-export",
    icon: Download,
  },
  {
    title: "Log's",
    description: "Punkt startowy do audytow, historii zmian i logow operacyjnych.",
    path: "/admin/logs",
    icon: FileText,
  },
  {
    title: "Statusy",
    description: "Biezacy status systemu oraz szybki przeglad kondycji srodowiska.",
    path: "/admin/statuses",
    icon: ShieldCheck,
  },
];

export default function SettingsHome() {
  const navigate = useNavigate();

  return (
    <PageShell
      title="Ustawienia"
      subtitle="Wybierz obszar administracyjny, nad ktorym chcesz dalej pracowac."
      icon={<Settings2 size={26} />}
      backTo="/menu"
      backLabel="Powrot do menu"
      compact
    >
      <div className="menu-grid">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              className="menu-card role-admin"
              onClick={() => navigate(item.path)}
            >
              <div className="menu-card__icon">
                <Icon size={22} />
              </div>
              <div className="menu-card__content">
                <div className="menu-card__title">{item.title}</div>
                <div className="menu-card__desc">{item.description}</div>
                <div
                  style={{
                    marginTop: 12,
                    color: "var(--app-primary-strong)",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Otworz sekcje <ArrowRight size={14} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

