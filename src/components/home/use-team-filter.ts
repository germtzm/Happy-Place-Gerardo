import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { fetchMyTeamScope } from "@/lib/dashboard";
import { TEAM_FILTER_ALL } from "@/lib/home-lists";

/**
 * Équipe choisie dans le sélecteur, partagée entre l'accueil et les vues « Voir tout ». Gardée en
 * mémoire seulement (jamais dans le navigateur) : un rechargement de la page remet « toutes ».
 */
let selectedTeam: string = TEAM_FILTER_ALL;
const listeners = new Set<() => void>();

export function setTeamFilter(team: string) {
  if (team === selectedTeam) return;
  selectedTeam = team;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTeamFilter(): [string, (team: string) => void] {
  const team = useSyncExternalStore(
    subscribe,
    () => selectedTeam,
    () => TEAM_FILTER_ALL,
  );
  return [team, setTeamFilter];
}

/** Équipes proposées au connecté (la sienne et ses manager_teams ; toutes pour l'admin). */
export function useTeamScope() {
  return useQuery({
    queryKey: ["my-team-scope"],
    queryFn: fetchMyTeamScope,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
