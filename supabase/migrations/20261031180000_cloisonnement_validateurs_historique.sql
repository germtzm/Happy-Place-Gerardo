-- Contrôle de cloisonnement : deux écarts corrigés.
--
-- A) submission_validators(_team) ne répond plus que pour l'équipe du lecteur
--    (collaborateur : son équipe ; manager : une équipe qu'il valide ; admin : toutes).
--    Une autre équipe lève « Accès refusé » (l'app masque alors la ligne Validateur).
-- B) submission_status_history n'est plus lisible en direct par un collaborateur :
--    elle contient l'e-mail et le nom du manager qui a décidé, et les motifs de refus.
--    La date d'attente dont il a besoin passe par submission_waiting_since(), qui ne renvoie
--    qu'une date, et seulement pour ses propres demandes.

-- A) Validateurs : même résultat qu'avant (prénoms uniquement), accès restreint
CREATE OR REPLACE FUNCTION public.submission_validators(_team text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _role public.app_role;
BEGIN
  IF NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  _role := private.current_app_role();
  IF NOT (
    _role = 'admin'::public.app_role
    OR (_role = 'manager'::public.app_role AND private.can_review_team(_team))
    OR (_role = 'collaborateur'::public.app_role
        AND lower(btrim(coalesce(private.own_team(), ''))) = lower(btrim(coalesce(_team, ''))))
  ) THEN
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

-- B) Historique : lecture directe réservée aux managers et aux admins
--    (même règle de lecture qu'avant pour eux : la demande doit être lisible).
DROP POLICY IF EXISTS "Read history of readable submissions" ON public.submission_status_history;
CREATE POLICY "Read history of readable submissions" ON public.submission_status_history
  FOR SELECT TO authenticated
  USING (
    private.is_allowed()
    AND private.current_app_role() IN ('admin'::public.app_role, 'manager'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id)
  );

-- Date d'attente par demande : dernier passage à « en attente », pour les demandes que le lecteur
-- peut lire en tant qu'auteur, manager de l'équipe ou admin. Aucune autre colonne de l'historique.
CREATE OR REPLACE FUNCTION public.submission_waiting_since(_ids uuid[])
RETURNS TABLE (submission_id uuid, waiting_since timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  _email text := lower(auth.jwt() ->> 'email');
  _role public.app_role;
BEGIN
  IF NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  _role := private.current_app_role();

  RETURN QUERY
  SELECT h.submission_id, max(h.changed_at)
  FROM public.submission_status_history h
  JOIN public.submissions s ON s.id = h.submission_id
  WHERE h.submission_id = ANY(_ids)
    AND h.new_status = 'en attente'::public.submission_status
    AND (
      _role = 'admin'::public.app_role
      OR (_role = 'manager'::public.app_role AND private.can_review_team(s.team))
      OR s.submitted_by_email = _email
    )
  GROUP BY h.submission_id;
END
$$;

REVOKE ALL ON FUNCTION public.submission_waiting_since(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submission_waiting_since(uuid[]) TO authenticated;
