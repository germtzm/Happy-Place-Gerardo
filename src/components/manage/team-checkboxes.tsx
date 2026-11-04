import { useId } from "react";

/**
 * Champ « Équipes concernées » : une case par équipe (hors Admin). Aucune case cochée = visible de tout
 * le cabinet. Les équipes déjà liées à l'élément restent proposées même si la liste n'a pas pu être chargée.
 */
export function TeamCheckboxes({
  teams,
  value,
  onChange,
  loading,
  failed,
}: {
  teams: string[] | undefined;
  value: string[];
  onChange: (next: string[]) => void;
  loading: boolean;
  failed: boolean;
}) {
  const helpId = useId();
  const options = [...new Set([...(teams ?? []), ...value])].sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" }),
  );

  function toggle(team: string, checked: boolean) {
    onChange(checked ? [...value, team] : value.filter((t) => t !== team));
  }

  return (
    <fieldset aria-describedby={helpId} className="space-y-xs">
      <legend className="font-label-md text-label-md text-primary">Équipes concernées</legend>
      <p id={helpId} className="text-body-sm text-on-surface-variant">
        Aucune case cochée : visible de tout le cabinet. Avec des équipes cochées : visible
        seulement des membres de ces équipes, et des admins.
      </p>
      {loading && <p className="text-body-sm text-on-surface-variant">Chargement des équipes…</p>}
      {failed && (
        <p role="alert" className="text-body-sm text-error">
          Impossible de charger la liste des équipes.
        </p>
      )}
      <div className="grid grid-cols-1 gap-x-sm sm:grid-cols-2">
        {options.map((team) => (
          <label
            key={team}
            className="flex min-h-[44px] cursor-pointer items-center gap-xs font-body-md text-body-md text-primary"
          >
            <input
              type="checkbox"
              checked={value.includes(team)}
              onChange={(e) => toggle(team, e.target.checked)}
              className="h-5 w-5 shrink-0 accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            <span className="wrap-anywhere">{team}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
