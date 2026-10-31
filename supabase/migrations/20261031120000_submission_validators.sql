-- B02 : prénoms des managers qui valident les demandes d'une équipe.
-- Réservée aux comptes de la liste blanche. Jamais d'email ni de nom de famille.
-- Un manager sans prénom compte pour « un manager ». Aucun manager : chaîne vide.
CREATE OR REPLACE FUNCTION public.submission_validators(_team text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT string_agg(m.prenom, ', ' ORDER BY m.prenom)
    FROM (
      SELECT DISTINCT ON (u.id)
        u.id,
        coalesce(nullif(btrim(u.first_name), ''), 'un manager') AS prenom
      FROM public.allowed_users u
      JOIN public.allowed_user_roles r
        ON r.allowed_user_id = u.id AND r.role = 'manager'::public.app_role
      JOIN public.manager_teams mt
        ON mt.allowed_user_id = u.id
      WHERE lower(btrim(mt.team)) = lower(btrim(_team))
    ) m
  ), '');
END
$$;

REVOKE ALL ON FUNCTION public.submission_validators(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submission_validators(text) TO authenticated;
