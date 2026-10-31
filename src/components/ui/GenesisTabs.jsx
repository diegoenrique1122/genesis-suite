import { useId, useRef } from 'react';

export default function GenesisTabs({ label, tabs, activeTab, onChange, children }) {
  const id = useId();
  const buttons = useRef([]);

  const handleKeyDown = (event, index) => {
    const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key in offsets) next = (index + offsets[event.key] + tabs.length) % tabs.length;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label={label} className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {tabs.map(({ id: tabId, label: title, description, icon: Icon }, index) => (
          <button
            key={tabId}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="tab"
            id={`${id}-tab-${tabId}`}
            aria-controls={`${id}-panel-${tabId}`}
            aria-selected={activeTab === tabId}
            tabIndex={activeTab === tabId ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(tabId)}
            style={{
              borderColor: activeTab === tabId ? 'var(--genesis-accent)' : 'color-mix(in srgb, currentColor 20%, transparent)',
              backgroundColor: activeTab === tabId ? 'color-mix(in srgb, var(--genesis-accent) 8%, transparent)' : 'transparent',
            }}
            className={`flex gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${activeTab === tabId ? 'shadow-sm' : 'opacity-80 hover:opacity-100'}`}
          >
            {Icon ? <Icon size={20} className="shrink-0 mt-0.5" aria-hidden="true" /> : null}
            <span className="min-w-0">
              <span className="block text-xs font-bold">{title}</span>
              {description ? <span className="block mt-1 text-[11px] opacity-65 leading-relaxed">{description}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {tabs.map(({ id: tabId }) => (
        <section
          key={tabId}
          role="tabpanel"
          id={`${id}-panel-${tabId}`}
          aria-labelledby={`${id}-tab-${tabId}`}
          hidden={activeTab !== tabId}
          tabIndex={0}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current rounded-3xl"
        >
          {activeTab === tabId ? children : null}
        </section>
      ))}
    </div>
  );
}
