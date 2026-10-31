import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabTileDef = {
  /** Identifiant sans espace : sert à tab-<id> et panel-<id>. */
  id: string;
  label: string;
  count: ReactNode;
  caption?: ReactNode;
  panel: ReactNode;
};

/** Tuiles-onglets (pattern WAI-ARIA tabs) : une seule tuile active, seul son panneau est visible. */
export function TabTiles({
  tabs,
  ariaLabel,
  defaultId,
  gridClassName = "grid-cols-2 md:grid-cols-5",
}: {
  tabs: TabTileDef[];
  ariaLabel: string;
  defaultId?: string;
  gridClassName?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === active);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(i + step + tabs.length) % tabs.length];
    setActive(next.id);
    tileRefs.current[next.id]?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={`mb-md grid gap-sm ${gridClassName}`}
      >
        {tabs.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tileRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`min-w-0 rounded-[8px] border p-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                selected
                  ? "border-[#28282D] bg-[#28282D] text-[#F5F4F1]"
                  : "border-[#CDCDD1] bg-white text-[#232428]"
              }`}
            >
              <span className="block font-label-sm text-label-sm uppercase">{t.label}</span>
              <span className="block font-display text-[32px] leading-tight">{t.count}</span>
              {t.caption && (
                <span
                  className={`block text-body-sm ${selected ? "text-[#CDCDD1]" : "text-[#68686D]"}`}
                >
                  {t.caption}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          className="space-y-xs"
        >
          {t.panel}
        </div>
      ))}
    </>
  );
}
