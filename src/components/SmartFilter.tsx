import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

interface Option {
  raw: string;
  label: string; // translated
  count: number;
}

interface Props {
  label: string;
  value: string | null;
  options: Array<{ raw: string; count: number }>;
  onChange: (v: string | null) => void;
  color: string;
  /** Show as inline pills (default) or dropdown */
  variant?: "pills" | "dropdown";
  searchable?: boolean;
}

export function SmartFilter({
  label,
  value,
  options,
  onChange,
  color,
  variant = "pills",
  searchable = true,
}: Props) {
  const { td, t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const enriched: Option[] = useMemo(
    () =>
      options.map((o) => ({
        raw: o.raw,
        label: td(o.raw) || o.raw,
        count: o.count,
      })),
    [options, td]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (o) => o.raw.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    );
  }, [enriched, query]);

  // Sort: keep selected at the front; otherwise by count desc
  const sortedOptions = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.raw === value) return -1;
      if (b.raw === value) return 1;
      return b.count - a.count;
    });
  }, [filtered, value]);

  useEffect(() => {
    if (!open) return;

    const updateRect = () => {
      if (rootRef.current) setPanelRect(rootRef.current.getBoundingClientRect());
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    updateRect();
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open]);

  if (variant === "dropdown") {
    const selectedLabel = value ? enriched.find((o) => o.raw === value)?.label : t("filter.all");
    return (
      <div ref={rootRef} className={`relative glass-card rounded-md px-2 py-1.5 flex items-center gap-1.5 overflow-visible ${open ? "z-[800]" : ""}`}>
        <span className="text-[10px] text-foreground/80 font-bold shrink-0">
          {label}:
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 h-8 text-[11px] font-bold flex items-center justify-between gap-2 px-2 rounded-md bg-background/70 border shadow-sm transition"
          style={{
            borderColor: open || value ? `${color}99` : "hsl(var(--border) / 0.7)",
            boxShadow: open ? `0 0 0 1px ${color}55` : undefined,
          }}
        >
          <span className="truncate" style={value ? { color } : undefined}>
            {selectedLabel}
          </span>
          <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {createPortal(
          <AnimatePresence>
            {open && panelRect && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="fixed z-[9999] rounded-md p-2 max-h-[320px] overflow-hidden flex flex-col shadow-2xl border bg-popover/95 backdrop-blur-md"
              style={{
                top: panelRect.bottom + 6,
                left: Math.max(8, panelRect.left),
                width: Math.max(260, panelRect.width),
                borderColor: `${color}55`,
              }}
            >
              {searchable && (
                <div className="relative mb-1.5 shrink-0">
                  <Search className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "right-2" : "left-2"} w-3 h-3 text-muted-foreground`} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("filter.search")}
                    className={`w-full h-8 bg-background/80 border rounded-md text-[11px] ${lang === "ar" ? "pr-7 pl-2" : "pl-7 pr-2"} focus:outline-none`}
                    style={{ borderColor: `${color}55` }}
                  />
                </div>
              )}
              <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
                <button
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition ${
                    value === null
                      ? "font-bold"
                      : "hover:bg-secondary/60 text-foreground/80"
                  }`}
                  style={value === null ? { background: `${color}22`, color } : undefined}
                >
                  <span>{t("filter.all")}</span>
                </button>
                {sortedOptions.map((o) => (
                  <button
                    key={o.raw}
                    onClick={() => {
                      onChange(value === o.raw ? null : o.raw);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition ${
                      value === o.raw
                        ? "text-background font-bold"
                        : "hover:bg-secondary/60 text-foreground/80"
                    }`}
                    style={value === o.raw ? { background: color } : undefined}
                  >
                    <span className="truncate flex-1 text-start">{o.label}</span>
                    <span className="text-[9.5px] tabular-nums opacity-70 shrink-0">
                      {o.count.toLocaleString("en-US")}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    );
  }

  // Pills variant
  return (
    <div className="glass-card rounded-md px-2 py-1.5 flex items-center gap-1.5 overflow-hidden">
      <span className="text-[10px] text-muted-foreground font-medium shrink-0">
        {label}:
      </span>
      {searchable && options.length > 8 && (
        <div className="relative shrink-0 w-32">
          <Search className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "right-1.5" : "left-1.5"} w-3 h-3 text-muted-foreground`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filter.search")}
            className={`w-full bg-secondary/40 border border-border/40 rounded-sm text-[10px] py-0.5 ${lang === "ar" ? "pr-5 pl-1.5" : "pl-5 pr-1.5"} focus:outline-none focus:border-primary/60`}
          />
        </div>
      )}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin flex-1">
        <motion.button
          layout
          onClick={() => onChange(null)}
          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full transition border ${
            value === null
              ? "border-primary bg-primary/20 text-primary"
              : "border-border/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("filter.all")}
        </motion.button>
        {sortedOptions.map((o) => (
          <motion.button
            key={o.raw}
            layout
            onClick={() => onChange(value === o.raw ? null : o.raw)}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full transition border whitespace-nowrap flex items-center gap-1 ${
              value === o.raw
                ? "text-background font-bold"
                : "border-border/40 text-foreground/80 hover:text-foreground"
            }`}
            style={
              value === o.raw
                ? { background: color, borderColor: color }
                : undefined
            }
            title={o.raw}
          >
            <span>{o.label}</span>
            <span className={`text-[8.5px] tabular-nums opacity-70`}>
              {o.count.toLocaleString("en-US")}
            </span>
          </motion.button>
        ))}
      </div>
      {value && (
        <button
          onClick={() => onChange(null)}
          className="shrink-0 p-0.5 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition"
          title={t("filter.clear")}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
