import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId, useState } from "react";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/dashboard";

const SCALE = [1, 2, 3, 4, 5] as const;

const OPTIONAL_QUESTIONS = [
  { key: "accueil", legend: "Je trouve vite ce qui me concerne dès l'accueil" },
  { key: "demandes", legend: "Je sais où en sont mes demandes" },
  { key: "notifications", legend: "Les notifications me préviennent quand il faut" },
] as const;

type OptionalKey = (typeof OPTIONAL_QUESTIONS)[number]["key"];

/** Cinq boutons radio natifs (1 à 5) dans un fieldset ; le nom du groupe est la légende. */
function Scale({
  name,
  legend,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="space-y-xs">
      <legend className="font-body-md text-body-md text-on-surface">{legend}</legend>
      <div className="flex flex-wrap gap-xs">
        {SCALE.map((n) => (
          <label
            key={n}
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-xs border border-outline px-sm font-label-md text-label-md text-primary hover:bg-surface-container has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span>{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const uid = useId();
  const commentId = `${uid}-comment`;
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [optional, setOptional] = useState<Record<OptionalKey, number | null>>({
    accueil: null,
    demandes: null,
    notifications: null,
  });
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (satisfaction === null || pending) return;
    setPending(true);
    try {
      await submitFeedback({
        satisfaction,
        accueil: optional.accueil,
        demandes: optional.demandes,
        notifications: optional.notifications,
        comment,
      });
      toast.success("Merci pour ton avis.");
      onClose();
    } catch {
      // La fenêtre reste ouverte et les réponses saisies sont conservées.
      toast.error("L'envoi a échoué. Réessaie dans un instant.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={send} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-md overflow-y-auto p-md">
        <Scale
          name={`${uid}-satisfaction`}
          legend="Globalement, quelle est ta satisfaction vis-à-vis de Happy Place ? (obligatoire)"
          value={satisfaction}
          onChange={setSatisfaction}
        />
        {OPTIONAL_QUESTIONS.map((q) => (
          <Scale
            key={q.key}
            name={`${uid}-${q.key}`}
            legend={q.legend}
            value={optional[q.key]}
            onChange={(v) => setOptional((prev) => ({ ...prev, [q.key]: v }))}
          />
        ))}
        <div className="space-y-xs">
          <label
            htmlFor={commentId}
            className="block font-label-sm text-label-sm uppercase text-on-surface-variant"
          >
            Une chose à améliorer en priorité
          </label>
          <textarea
            id={commentId}
            rows={4}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-outline bg-card p-sm font-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <p className="text-body-sm text-on-surface-variant">
            N'écris pas de données personnelles.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-xs border-t border-outline-variant p-md">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] border border-outline px-md font-label-md text-label-md uppercase text-primary hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ANNULER
        </button>
        <button
          type="submit"
          disabled={satisfaction === null || pending}
          className="min-h-[44px] bg-primary px-lg font-label-md text-label-md text-on-primary disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {pending ? "ENVOI…" : "ENVOYER"}
        </button>
      </div>
    </form>
  );
}

/**
 * Fenêtre « Donner mon avis » (avis anonyme, fonction SQL submit_feedback). Radix Dialog : Échap ferme,
 * le focus est piégé puis rendu à l'élément qui l'avait avant l'ouverture. Le formulaire est monté à
 * l'ouverture seulement : fermée, la fenêtre repart vide.
 */
export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="fixed z-50 inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[min(48rem,calc(100vw-2rem))] h-dvh md:h-auto md:max-h-[85vh] flex flex-col bg-surface-container-lowest border border-outline shadow-lg focus:outline-none">
          <div className="flex items-start justify-between gap-sm border-b border-outline-variant p-md">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-headline-sm text-headline-sm text-primary wrap-anywhere">
                Donner mon avis
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="font-label-sm text-label-sm text-on-surface-variant">
                Réponse anonyme, 1 minute.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="text-on-surface-variant hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden="true" className="material-symbols-outlined">
                close
              </span>
            </DialogPrimitive.Close>
          </div>
          <FeedbackForm onClose={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
