const joinClasses = (...classes) =>
  classes.filter(Boolean).join(' ');

export function GenesisSurface({
  as: Component = 'section',
  tone = 'default',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={joinClasses('genesis-surface-panel', className)}
      data-tone={tone}
      {...props}
    >
      {children}
    </Component>
  );
}

export function GenesisSectionHeading({
  title,
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={joinClasses('genesis-section-heading', className)}>
      <div className="genesis-section-heading__copy">
        <h2 className="genesis-section-heading__title">{title}</h2>
        {description ? (
          <p className="genesis-section-heading__description">
            {description}
          </p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

export function GenesisMetric({
  label,
  value,
  helper = '',
  icon: Icon = null,
  accent = '',
  className = '',
}) {
  return (
    <article
      className={joinClasses('genesis-metric', className)}
      style={accent ? { '--genesis-accent': accent } : undefined}
    >
      {Icon ? (
        <div className="genesis-metric__icon" aria-hidden="true">
          <Icon size={18} />
        </div>
      ) : null}

      <div className="genesis-metric__copy">
        <p className="genesis-metric__label">{label}</p>
        <p className="genesis-metric__value">{value}</p>
        {helper ? <p className="genesis-metric__helper">{helper}</p> : null}
      </div>
    </article>
  );
}

export function GenesisProgressRing({
  value,
  size = 64,
  label = '',
  accent = '',
  className = '',
}) {
  const normalizedValue = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedValue / 100) * circumference;
  const accessibleLabel = label || `${Math.round(normalizedValue)}%`;

  return (
    <div
      className={joinClasses('genesis-progress-ring', className)}
      style={{
        width: size,
        height: size,
        ...(accent ? { '--genesis-accent': accent } : {}),
      }}
      role="img"
      aria-label={accessibleLabel}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle
          className="genesis-progress-ring__track"
          cx="32"
          cy="32"
          r={radius}
        />
        <circle
          className="genesis-progress-ring__value"
          cx="32"
          cy="32"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="genesis-progress-ring__label">
        {Math.round(normalizedValue)}%
      </span>
    </div>
  );
}

export function GenesisEmptyState({
  icon: Icon = null,
  title,
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={joinClasses('genesis-empty-state', className)}>
      <div>
        {Icon ? (
          <div className="genesis-empty-state__icon" aria-hidden="true">
            <Icon size={20} />
          </div>
        ) : null}
        <h3 className="genesis-empty-state__title">{title}</h3>
        {description ? (
          <p className="genesis-empty-state__description">{description}</p>
        ) : null}
        {action}
      </div>
    </div>
  );
}
