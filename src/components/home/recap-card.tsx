import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyRecap,
  RECAP_FREQUENCIES,
  recapPreviewText,
  recapTimeFromParts,
  recapTimeLabel,
  recapTimeParts,
  recapUpdatedLabel,
  saveMyRecap,
  stepRecapHour,
  stepRecapMinute,
  validateRecapInput,
  type RecapFrequency,
  type RecapInput,
  type RecapPreferences,
} from "@/lib/dashboard";

const FREQUENCY_OPTIONS: SegmentOption<RecapFrequency>[] = [
  { value: "desactive", label: "DÉSACTIVÉ" },
  { value: "quotidien", label: "CHAQUE JOUR" },
  { value: "hebdomadaire", label: "CHAQUE SEMAINE" },
];

/** Jour ISO : 1 = lundi … 7 = dimanche. Libellé court affiché, nom complet lu par les lecteurs d'écran. */
const DAY_OPTIONS: SegmentOption<number>[] = [
  { value: 1, label: "LUN", ariaLabel: "Lundi" },
  { value: 2, label: "MAR", ariaLabel: "Mardi" },
  { value: 3, label: "MER", ariaLabel: "Mercredi" },
  { value: 4, label: "JEU", ariaLabel: "Jeudi" },
  { value: 5, label: "VEN", ariaLabel: "Vendredi" },
  { value: 6, label: "SAM", ariaLabel: "Samedi" },
  { value: 7, label: "DIM", ariaLabel: "Dimanche" },
];

const FIELD_LABEL = "font-label-sm text-label-sm uppercase text-[#68686D]";
const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

type SegmentOption<T extends string | number> = { value: T; label: string; ariaLabel?: string };

/**
 * Choix unique en segments (pattern WAI-ARIA radiogroup) : seul le segment actif est atteignable par
 * Tab, les flèches changent la sélection et le focus avec bouclage, Entrée ou Espace valident.
 */
function RadioSegments<T extends string | number>({
  labelledBy,
  options,
  value,
  onChange,
  disabled,
  className,
  compact = false,
}: {
  labelledBy: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  className: string;
  /** Texte et remplissage réduits (jamais la hauteur de 44 px) pour tenir sur une ligne à 375 px. */
  compact?: boolean;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  // Sans valeur reconnue, le premier segment reste atteignable au clavier.
  const tabbable = options.some((o) => o.value === value) ? value : options[0].value;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === tabbable);
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className={className}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) refs.current.set(o.value, el);
              else refs.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            tabIndex={o.value === tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] min-w-0 rounded-[8px] border font-label-sm uppercase disabled:opacity-60 ${
              compact ? "px-0 text-[11px] leading-none tracking-normal" : "px-xs text-label-sm"
            } ${FOCUS_RING} ${
              selected
                ? "border-[#28282D] bg-[#28282D] text-[#F5F4F1]"
                : "border-[#CDCDD1] bg-white text-[#232428]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compteur à deux chiffres entre « − » et « + » (heures ou minutes). La valeur est un spinbutton :
 * flèche haut = plus, flèche bas = moins. Le bouclage est calculé par `onStep` (fonctions pures).
 */
function TimeStepper({
  id,
  label,
  value,
  min,
  max,
  unit,
  onStep,
  disabled,
  describedBy,
}: {
  id: string;
  label: "Heures" | "Minutes";
  value: string;
  min: number;
  max: number;
  unit: string;
  onStep: (delta: 1 | -1) => void;
  disabled: boolean;
  describedBy: string;
}) {
  const buttonClass = `flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[8px] border border-[#CDCDD1] bg-white text-[20px] leading-none text-[#232428] disabled:cursor-not-allowed disabled:bg-[#EEEDEA] disabled:text-[#68686D] ${FOCUS_RING}`;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onStep(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onStep(-1);
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="min-w-0 space-y-xs">
      <p id={`${id}-label`} className="text-body-sm text-[#68686D]">
        {label}
      </p>
      <div className="flex w-full min-w-0 items-center gap-xs">
        <button
          type="button"
          aria-label={`${label}, moins`}
          disabled={disabled}
          onClick={() => onStep(-1)}
          className={buttonClass}
        >
          <span aria-hidden="true">−</span>
        </button>
        <div
          role="spinbutton"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-valuenow={Number(value)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={`${value} ${unit}`}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={onKeyDown}
          className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-[8px] border border-[#CDCDD1] font-display text-[20px] leading-none ${FOCUS_RING} ${
            disabled ? "bg-[#EEEDEA] text-[#68686D]" : "bg-white text-[#232428]"
          }`}
        >
          {value}
        </div>
        <button
          type="button"
          aria-label={`${label}, plus`}
          disabled={disabled}
          onClick={() => onStep(1)}
          className={buttonClass}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

function toForm(p: RecapPreferences): RecapInput {
  return {
    channel_app: p.channel_app,
    channel_email: p.channel_email,
    frequency: p.frequency,
    send_day: p.send_day,
    send_time: recapTimeLabel(p.send_time),
  };
}

/**
 * Carte « Mon récapitulatif » (managers) : canaux, fréquence, jour et heure d'envoi, aperçu du dernier
 * texte envoyé. Jour et heure sont des ajouts hors maquette E3 (demande du 2026-11-02).
 */
export function RecapCard() {
  const qc = useQueryClient();
  const ids = useId();
  const recap = useQuery({ queryKey: ["recap"], queryFn: fetchMyRecap, retry: false });
  // Brouillon local : tant qu'il est null, le formulaire reflète la base.
  const [draft, setDraft] = useState<RecapInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const save = useMutation({
    mutationFn: saveMyRecap,
    onSuccess: (row) => {
      qc.setQueryData(["recap"], row);
      void qc.invalidateQueries({ queryKey: ["recap"] });
      setDraft(null);
      setJustSaved(true);
      setMessage({ kind: "ok", text: "Préférences enregistrées." });
    },
    onError: (e: unknown) => {
      setMessage({ kind: "error", text: (e as Error).message || "Enregistrement impossible." });
    },
  });

  const saving = save.isPending;
  const form: RecapInput | null = draft ?? (recap.data ? toForm(recap.data) : null);

  function update(patch: Partial<RecapInput>) {
    if (!form) return;
    setDraft({ ...form, ...patch });
    setMessage(null);
  }

  function onSave() {
    if (!form) return;
    const invalid = validateRecapInput(form);
    if (invalid) {
      setMessage({ kind: "error", text: invalid });
      return;
    }
    setMessage(null);
    save.mutate(form);
  }

  // La ligne par défaut (rien d'enregistré) porte un updated_at = maintenant : on ne l'affiche pas
  // comme une « dernière mise à jour », sauf si l'enregistrement vient d'avoir lieu ici.
  const stored =
    recap.data && (justSaved || Date.now() - new Date(recap.data.updated_at).getTime() > 60_000);
  const updatedLabel = stored ? recapUpdatedLabel(recap.data?.updated_at) : null;

  const weekly = form?.frequency === "hebdomadaire";
  const disabledFrequency = form?.frequency === "desactive";
  const time = recapTimeParts(form?.send_time);
  const checkboxClass = `h-[20px] w-[20px] shrink-0 accent-[#28282D] ${FOCUS_RING}`;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="flex h-full min-w-0 flex-col gap-md rounded-[8px] border border-[#CDCDD1] bg-white p-md"
    >
      <h2 id={`${ids}-title`} className="font-headline-sm text-headline-sm text-primary">
        Mon récapitulatif
      </h2>

      {recap.isLoading ? (
        <p className="text-body-md text-[#68686D]">Chargement…</p>
      ) : recap.isError || !form ? (
        <p role="alert" className="text-body-md text-error">
          Impossible de charger tes préférences de récapitulatif.
        </p>
      ) : (
        <>
          <fieldset className="min-w-0 space-y-xs" disabled={saving}>
            <legend className={FIELD_LABEL}>CANAL DE RÉCEPTION</legend>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-body-md text-[#232428]">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={form.channel_app}
                onChange={(e) => update({ channel_app: e.target.checked })}
              />
              Dans l'application
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-body-md text-[#232428]">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={form.channel_email}
                onChange={(e) => update({ channel_email: e.target.checked })}
              />
              Par email
            </label>
          </fieldset>

          <div className="min-w-0 space-y-xs">
            <p id={`${ids}-freq`} className={FIELD_LABEL}>
              FRÉQUENCE D'ENVOI
            </p>
            <RadioSegments
              labelledBy={`${ids}-freq`}
              options={FREQUENCY_OPTIONS}
              value={form.frequency}
              onChange={(frequency) => update({ frequency })}
              disabled={saving}
              className="grid w-full grid-cols-1 gap-xs sm:grid-cols-3"
            />
          </div>

          {weekly && (
            <div className="min-w-0 space-y-xs">
              <p id={`${ids}-day`} className={FIELD_LABEL}>
                JOUR D'ENVOI
              </p>
              <RadioSegments
                labelledBy={`${ids}-day`}
                options={DAY_OPTIONS}
                value={form.send_day}
                onChange={(send_day) => update({ send_day })}
                disabled={saving || disabledFrequency}
                compact
                className="grid w-full grid-cols-7 gap-1"
              />
            </div>
          )}

          <fieldset className="min-w-0 space-y-xs">
            <legend className={FIELD_LABEL}>HEURE D'ENVOI</legend>
            <div className="grid w-full min-w-0 grid-cols-2 gap-sm">
              <TimeStepper
                id={`${ids}-hour`}
                label="Heures"
                value={time.hour}
                min={0}
                max={23}
                unit="heures"
                disabled={saving || disabledFrequency}
                describedBy={`${ids}-time-hint`}
                onStep={(delta) =>
                  update({
                    send_time: recapTimeFromParts(stepRecapHour(time.hour, delta), time.minute),
                  })
                }
              />
              <TimeStepper
                id={`${ids}-minute`}
                label="Minutes"
                value={time.minute}
                min={0}
                max={45}
                unit="minutes"
                disabled={saving || disabledFrequency}
                describedBy={`${ids}-time-hint`}
                onStep={(delta) =>
                  update({
                    send_time: recapTimeFromParts(time.hour, stepRecapMinute(time.minute, delta)),
                  })
                }
              />
            </div>
            <p id={`${ids}-time-hint`} className="text-body-sm text-[#68686D]">
              heure de Paris
            </p>
          </fieldset>

          <div className="min-w-0 space-y-xs">
            <p id={`${ids}-preview`} className={FIELD_LABEL}>
              APERÇU DU RÉCAPITULATIF
            </p>
            <div
              aria-labelledby={`${ids}-preview`}
              role="group"
              className="whitespace-pre-line wrap-anywhere rounded-[8px] bg-[#EEEDEA] p-sm text-body-md text-[#232428]"
            >
              {recapPreviewText(recap.data?.last_text)}
            </div>
          </div>

          <div className="mt-auto space-y-xs">
            <div aria-live="polite" className="min-h-[1.5rem] text-body-sm">
              {message && (
                <p className={message.kind === "error" ? "text-error" : "text-[#232428]"}>
                  {message.text}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`min-h-[44px] w-full rounded-[8px] bg-[#28282D] px-md font-label-md text-label-md uppercase text-[#F5F4F1] disabled:opacity-60 ${FOCUS_RING}`}
            >
              {saving ? "ENREGISTREMENT…" : "ENREGISTRER"}
            </button>
            {updatedLabel && (
              <p className="text-center text-body-sm text-[#68686D]">{updatedLabel}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
