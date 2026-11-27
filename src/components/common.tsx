import { useState, type ReactNode } from "react";
import type { RolUsuario, Usuario } from "../data";
import logo from "../imports/saco-oliveros-30.png";

export type View =
  | "dashboard"
  | "students"
  | "alert"
  | "history"
  | "derivations"
  | "communication"
  | "model"
  | "my-section"
  | "evidence"
  | "my-derivations";
export type IconName =
  | "dashboard"
  | "students"
  | "alerts"
  | "history"
  | "family"
  | "bell"
  | "chevron"
  | "arrow"
  | "trend"
  | "trendDown"
  | "trendUp"
  | "trendFlat"
  | "calendar"
  | "check"
  | "info"
  | "search"
  | "filter"
  | "model"
  | "send"
  | "close";

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  students: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  alerts: (
    <>
      <path d="M10.3 3.6 2.2 17.1A2 2 0 0 0 3.9 20h16.2a2 2 0 0 0 1.7-2.9L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  family: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-2-3.5V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4Z" />
      <path d="M7 8h10M7 12h7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21h-3.4" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <path d="m12 19-7-7 7-7M19 12H5" />,
  trend: (
    <>
      <path d="m3 6 6 6 4-4 8 8" />
      <path d="M21 10v6h-6" />
    </>
  ),
  trendDown: (
    <>
      <path d="m3 6 6 6 4-4 8 8" />
      <path d="M21 10v6h-6" />
    </>
  ),
  trendUp: (
    <>
      <path d="m3 18 6-6 4 4 8-8" />
      <path d="M15 8h6v6" />
    </>
  ),
  trendFlat: (
    <>
      <path d="M4 12h16" />
      <path d="m16 8 4 4-4 4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
  model: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M14 17.5h-4A3.5 3.5 0 0 1 6.5 14v-4" />
    </>
  ),
  send: <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function RiskBadge({ level }: { level: "Bajo" | "Medio" | "Alto" }) {
  return (
    <span className={`risk-badge risk-${level.toLowerCase()}`}>
      <span className="risk-dot" />
      {level}
    </span>
  );
}

export function TrendIcon({ trend }: { trend: string }) {
  const name: IconName = trend === "Ascendente" ? "trendUp" : trend === "Estable" ? "trendFlat" : "trendDown";
  return <Icon name={name} size={16} />;
}

export function Button({
  children,
  onClick,
  secondary = false,
  icon,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  icon?: IconName;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={secondary ? "button button-secondary" : "button button-primary"}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}

interface NavItem {
  label: string;
  icon: IconName;
  view: View;
}

export const navigationByRole: Record<RolUsuario, NavItem[]> = {
  Tutor: [
    { label: "Dashboard", icon: "dashboard", view: "dashboard" },
    { label: "Estudiantes", icon: "students", view: "students" },
    { label: "Alertas", icon: "alerts", view: "alert" },
    { label: "Seguimiento", icon: "history", view: "history" },
    { label: "Derivaciones", icon: "send", view: "derivations" },
    { label: "Comunicación con familias", icon: "family", view: "communication" },
    { label: "Cómo funciona el sistema", icon: "model", view: "model" },
  ],
  Docente: [
    { label: "Mi sección", icon: "students", view: "my-section" },
    { label: "Registrar evidencias", icon: "check", view: "evidence" },
    { label: "Mis derivaciones", icon: "send", view: "my-derivations" },
  ],
  Coordinacion: [
    { label: "Dashboard", icon: "dashboard", view: "dashboard" },
    { label: "Estudiantes", icon: "students", view: "students" },
    { label: "Alertas", icon: "alerts", view: "alert" },
    { label: "Seguimiento", icon: "history", view: "history" },
    { label: "Derivaciones", icon: "send", view: "derivations" },
    { label: "Cómo funciona el sistema", icon: "model", view: "model" },
  ],
};

export const landingByRole: Record<RolUsuario, View> = {
  Tutor: "dashboard",
  Docente: "my-section",
  Coordinacion: "dashboard",
};

export const roleLabels: Record<RolUsuario, string> = {
  Tutor: "Tutor",
  Docente: "Docente",
  Coordinacion: "Coordinación",
};

export function Sidebar({
  view,
  navigate,
  resetData,
  role,
  pendingDerivations,
}: {
  view: View;
  navigate: (view: View) => void;
  resetData: () => void;
  role: RolUsuario;
  pendingDerivations: number;
}) {
  const navItems = navigationByRole[role];

  return (
    <aside className="sidebar">
      <div className="logo-wrap">
        <img src={logo} alt="Saco Oliveros" className="logo" />
      </div>
      <div className="school-label">Portal del tutor</div>
      <nav aria-label="Navegación principal" className="nav-list">
        {navItems.map((item) => {
          const active = item.view === view;
          return (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => item.view && navigate(item.view)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.view === "derivations" && pendingDerivations > 0 && (
                <span className="nav-badge">{pendingDerivations}</span>
              )}
            </button>
          );
        })}
      </nav>
      <button type="button" className="reset-data-button" onClick={resetData}>
        Restablecer datos de demostración
      </button>
      <div className="sidebar-note">
        <div className="note-icon"><Icon name="info" size={18} /></div>
        <p>Herramienta de apoyo para la toma de decisiones del tutor.</p>
      </div>
    </aside>
  );
}

export function Header({
  activeUser,
  notificationCount,
  logout,
  openNotifications,
}: {
  activeUser: Usuario;
  notificationCount: number;
  logout: () => void;
  openNotifications: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const initials = activeUser.nombre
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <header className="topbar">
      <div>
        <p className="system-name">Sistema de Alerta Temprana</p>
        <p className="system-kicker">Riesgo académico</p>
      </div>
      <div className="header-actions">
        <div className="class-chip">3.º Secundaria · A</div>
        <button
          type="button"
          className="icon-button"
          aria-label={`Notificaciones: ${notificationCount}`}
          onClick={openNotifications}
        >
          <Icon name="bell" />
          {notificationCount > 0 && <span className="notification-count">{notificationCount}</span>}
        </button>
        <div className="profile-menu">
          <button
            type="button"
            className="profile"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((open) => !open)}
          >
            <div className="avatar">{initials}</div>
            <div className="profile-copy">
              <strong>{activeUser.nombre}</strong>
              <span>{roleLabels[activeUser.rol]} · ficticio</span>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          {profileOpen && (
            <div className="profile-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={logout}>Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="page-heading">
      {onBack && (
        <button type="button" className="back-link" onClick={onBack}>
          <Icon name="arrow" size={17} /> Volver
        </button>
      )}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function formatearEntero(valor: number) {
  return Math.round(Number(valor) || 0);
}

export function calcularTendencia(bimestre1: number, bimestre2: number) {
  const variacion = Math.round(bimestre2) - Math.round(bimestre1);
  if (variacion <= -2) return "Descendente";
  if (variacion < 0) return "Leve descenso";
  if (variacion === 0) return "Estable";
  return "Ascendente";
}

export function formatearNivelPorcentaje(valor: number) {
  return `${Math.round(valor * 100)} %`;
}

export function HelpHint({ text }: { text: string }) {
  return <span className="help-hint" title={text} aria-label={text}>?</span>;
}