import { Layers3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const joinClasses = (...classes) =>
  classes.filter(Boolean).join(' ');

export default function GenesisAppShell({
  children,
  brandName = 'Genesis OS',
  contextLabel = '',
  eyebrow = '',
  title,
  description = '',
  badge = '',
  navigation = [],
  actions = null,
  className = '',
}) {
  const { theme } = useTheme();
  const accent = theme?.brandColor || '#f59e0b';

  return (
    <div
      className={joinClasses('genesis-app-shell', className)}
      style={{ '--genesis-accent': accent }}
    >
      <div
        className="genesis-app-shell__ambient"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle at 18% 0%, ${accent} 0%, transparent 58%)`,
        }}
      />

      <header className="genesis-app-shell__topbar">
        <div className="genesis-app-shell__topbar-inner">
          <div className="genesis-app-shell__brand">
            <div className="genesis-app-shell__brand-mark" aria-hidden="true">
              {theme?.logoUrl ? (
                <img src={theme.logoUrl} alt="" />
              ) : (
                <Layers3 size={18} />
              )}
            </div>

            <div className="genesis-app-shell__brand-copy">
              <p className="genesis-app-shell__brand-name">{brandName}</p>
              {contextLabel ? (
                <p className="genesis-app-shell__brand-context">
                  {contextLabel}
                </p>
              ) : null}
            </div>
          </div>

          {actions ? (
            <div className="genesis-app-shell__actions">{actions}</div>
          ) : null}
        </div>
      </header>

      <main className="genesis-app-shell__main">
        <div className="genesis-app-shell__intro">
          <div>
            {eyebrow ? (
              <p className="genesis-app-shell__eyebrow">{eyebrow}</p>
            ) : null}

            <div className="genesis-app-shell__title-row">
              <h1 className="genesis-app-shell__title">{title}</h1>
              {badge ? (
                <span className="genesis-app-shell__badge">{badge}</span>
              ) : null}
            </div>

            {description ? (
              <p className="genesis-app-shell__description">{description}</p>
            ) : null}
          </div>

          {navigation.length > 0 ? (
            <nav className="genesis-app-shell__nav" aria-label="Primary">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="genesis-app-shell__nav-item"
                    aria-current={item.active ? 'page' : undefined}
                    disabled={item.disabled}
                    onClick={item.onSelect}
                  >
                    {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>

        <div className="genesis-stack">{children}</div>
      </main>
    </div>
  );
}
