import { useQuery } from "@tanstack/react-query";
import { fetchPendingNotifications } from "@/lib/dashboard";

/**
 * Notifications à traiter : une seule requête (même clé) pour la cloche, son libellé accessible,
 * le « N NON LUES » et la liste, afin qu'ils ne divergent jamais.
 */
export function usePendingNotifications(email: string) {
  return useQuery({
    queryKey: ["notifications", "pending", email],
    queryFn: fetchPendingNotifications,
    enabled: !!email,
    retry: false,
  });
}
