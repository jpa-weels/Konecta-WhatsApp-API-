import { NavLink, useNavigate } from "react-router-dom";
import { Smartphone, Settings, BookOpen, Webhook, BarChart2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthContext";

const navItems = [
  { to: "/instances", label: "Instâncias", icon: Smartphone },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/settings", label: "Recursos", icon: Settings },
  { to: "/wiki", label: "Documentação", icon: BookOpen },
];

export default function Sidebar() {
  const { logout, apiUrl } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const host = (() => {
    try { return new URL(apiUrl).host; } catch { return apiUrl; }
  })();

  return (
    <aside className="w-[var(--sidebar-width)] bg-transparent flex flex-col h-full shrink-0">
      <div className="px-2 pt-4 pb-3">
        <div className="flex items-center justify-center gap-1.5 py-2">
          <span className="text-2xl font-black tracking-tight text-foreground">Konecta</span>
          <span className="text-2xl font-bold tracking-tight text-primary">API</span>
        </div>
        {host && (
          <div className="flex justify-center mt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
              <span className="text-[11px] font-medium text-foreground/60 leading-tight truncate max-w-[140px]">
                {host}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-white/5 mb-2" />

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 px-3 mb-2">
          Menu
        </p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                isActive
                  ? "bg-secondary text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground font-medium"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="truncate text-sm">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 h-px bg-white/5 mt-2 mb-3" />

      <div className="px-3 pb-4 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
        >
          <LogOut size={15} className="shrink-0" />
          <span>Sair</span>
        </button>
        <p className="text-[10px] text-muted-foreground/40 font-medium text-center">
          Konecta API v1
        </p>
      </div>
    </aside>
  );
}
