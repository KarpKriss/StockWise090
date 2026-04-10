import { Database, Map, Package, ScrollText, Tag, Warehouse } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/layout/PageShell";
import "../menu/menu-modern.css";

const items = [
  {
    title: "Produkty",
    description: "Referencje SKU, EAN i statusy indeksow.",
    path: "/data/products",
    icon: Package,
  },
  {
    title: "Stock",
    description: "Stany magazynowe po lokalizacji i produkcie.",
    path: "/data/stock",
    icon: Warehouse,
  },
  {
    title: "Ceny",
    description: "Wartosci produktow wykorzystywane w analizach finansowych.",
    path: "/data/prices",
    icon: Tag,
  },
  {
    title: "Mapa magazynu",
    description: "Struktura lokalizacji, stref i statusow operacyjnych.",
    path: "/data/locations",
    icon: Map,
  },
  {
    title: "Historia korekt",
    description: "Zmiany danych, log korekt i zgloszonych problemow.",
    path: "/data/history",
    icon: ScrollText,
  },
];

export default function DataMenuModern() {
  const navigate = useNavigate();

  return (
    <PageShell
      title="Dane referencyjne"
      subtitle="Centralne miejsce do zarzadzania produktami, stockiem, cenami i historia zmian."
      icon={<Database size={26} />}
      backTo="/menu"
      compact
    >
      <div className="app-grid app-grid--cards">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              className="card selectable"
              onClick={() => navigate(item.path)}
            >
              <div className="menu-card__icon">
                <Icon size={22} />
              </div>
              <div className="card-title" style={{ marginTop: 14 }}>
                {item.title}
              </div>
              <div className="card-desc">{item.description}</div>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}
