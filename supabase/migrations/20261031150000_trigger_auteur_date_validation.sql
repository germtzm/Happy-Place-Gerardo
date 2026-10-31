-- 1) Trigger d'auteur : le prénom du compte connecté est posé comme author_name à la création d'une demande.
--    Ordre des triggers BEFORE INSERT (alphabétique) : check_submission_attachment, set_revalidate_at,
--    set_submission_owner, puis set_submission_owner_author. Sans effet sur l'ordre : ce trigger relit le JWT
--    lui-même et ne touche ni submitted_by_email ni team.
--    Inchangé si : JWT vide (smoke tests, tâches planifiées), compte inconnu, prénom vide,
--    ou admin qui fournit un author_name (saisie pour quelqu'un depuis « Gestion des données »).
CREATE OR REPLACE FUNCTION private.set_submission_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _role public.app_role;
  _first text;
  _found boolean;
BEGIN
  IF _email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.role, nullif(btrim(u.first_name), ''), true INTO _role, _first, _found
  FROM public.allowed_users u
  LEFT JOIN public.allowed_user_roles r ON r.allowed_user_id = u.id
  WHERE u.email = _email;

  IF _found IS NOT TRUE OR _first IS NULL THEN
    RETURN NEW;
  END IF;
  IF _role = 'admin'::public.app_role AND nullif(btrim(NEW.author_name), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.author_name := _first;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS set_submission_owner_author ON public.submissions;
CREATE TRIGGER set_submission_owner_author
BEFORE INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION private.set_submission_author();

-- 2) validated_submissions() : identique à 20261031140000, plus validated_at
--    (dernier passage à « validée » dans l'historique, lu côté base : SECURITY DEFINER).
--    Le type de retour change : DROP puis CREATE.
DROP FUNCTION IF EXISTS public.validated_submissions();
CREATE FUNCTION public.validated_submissions()
RETURNS TABLE (
  id uuid,
  author_name text,
  team text,
  content text,
  status public.submission_status,
  created_at timestamptz,
  rejection_category public.rejection_category,
  rejection_note text,
  submitted_by_email text,
  attachment_path text,
  attachment_name text,
  hide_author boolean,
  validated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _email text := lower(auth.jwt() ->> 'email');
  _role public.app_role;
  _own_team text;
BEGIN
  IF NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  _role := private.current_app_role();
  _own_team := private.own_team();

  RETURN QUERY
  SELECT
    s.id,
    CASE WHEN m.masked THEN 'Anonyme' ELSE s.author_name END,
    s.team,
    s.content,
    s.status,
    s.created_at,
    s.rejection_category,
    s.rejection_note,
    CASE WHEN m.masked THEN NULL ELSE s.submitted_by_email END,
    CASE WHEN m.masked THEN NULL ELSE s.attachment_path END,
    CASE WHEN m.masked THEN NULL ELSE s.attachment_name END,
    s.hide_author,
    (SELECT max(h.changed_at)
       FROM public.submission_status_history h
      WHERE h.submission_id = s.id
        AND h.new_status = 'validée'::public.submission_status)
  FROM public.submissions s
  CROSS JOIN LATERAL (
    SELECT s.hide_author
           AND _role = 'collaborateur'::public.app_role
           AND s.submitted_by_email IS DISTINCT FROM _email AS masked
  ) m
  WHERE s.status = 'validée'::public.submission_status
    AND (
      _role = 'admin'::public.app_role
      OR (_role = 'manager'::public.app_role AND private.can_review_team(s.team))
      OR (_role = 'collaborateur'::public.app_role AND s.team = _own_team)
      OR s.submitted_by_email = _email
    )
  ORDER BY s.created_at DESC;
END
$$;

REVOKE ALL ON FUNCTION public.validated_submissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validated_submissions() TO authenticated;
