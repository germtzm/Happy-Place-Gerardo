import { useEffect, useId } from "react";
import { TEAM_FILTER_ALL } from "@/lib/home-lists";
import { canPickTeam, setTeamFilter, useTeamFilter, useTeamScope } from "./use-team-filter";

/**
 * Sélecteur « Équipe » des indicateurs et des points bloquants. La base ne renvoie déjà que ce que le
 * connecté peut lire : le sélecteur ne cache rien de lui-même, il laisse choisir parmi ses équipes.
 */
export function TeamFilter({ className = "" }: { className?: string }) {
  const id = useId();
  const [team, setTeam] = useTeamFilter();
  const scope = useTeamScope();
  const teams = scope.data?.teams ?? [];

  // Une équipe choisie qui n'est plus proposée (droits changés) ramène à « toutes ».
  useEffect(() => {
    if (scope.data && team !== TEAM_FILTER_ALL && !scope.data.teams.includes(team)) {
      setTeamFilter(TEAM_FILTER_ALL);
    }
  }, [scope.data, team]);

  if (!scope.data || !canPickTeam(scope.data)) return null;

  return (
    <div className={`flex flex-wrap items-center gap-xs ${className}`}>
      <label htmlFor={id} className="font-label-sm text-label-sm uppercase text-on-surface-variant">
        Équipe
      </label>
      <select
        id={id}
        value={teams.includes(team) ? team : TEAM_FILTER_ALL}
        onChange={(e) => setTeam(e.target.value)}
        className="min-h-[44px] min-w-[12rem] rounded-[8px] border border-[#CDCDD1] bg-surface-container-lowest px-sm font-label-md text-label-md text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <option value={TEAM_FILTER_ALL}>
          {scope.data.isAdmin ? "Toutes les équipes" : "Toutes mes équipes"}
        </option>
        {teams.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
