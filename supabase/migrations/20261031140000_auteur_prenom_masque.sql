-- Prénom de l'auteur (envoyé par l'app), avec option « masquer aux autres collaborateurs de l'équipe ».
-- Le masquage se fait en base : un collaborateur ne lit plus les demandes validées des autres
-- dans la table, il passe par public.validated_submissions().

-- a) Case « masquer mon prénom »
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS hide_author boolean NOT NULL DEFAULT false;

-- Nettoyage d'une version précédente de cette migration (trigger d'auteur abandonné) : sans effet s'il n'existe pas.
DROP TRIGGER IF EXISTS set_submission_owner_author ON public.submissions;
DROP FUNCTION IF EXISTS private.set_submission_author();

-- b) Garde du manager : identique à 20261006114933, plus hide_author
CREATE OR REPLACE FUNCTION private.enforce_submission_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF private.current_app_role() = 'manager'::public.app_role THEN
    IF NEW.author_name IS DISTINCT FROM OLD.author_name
       OR NEW.team IS DISTINCT FROM OLD.team
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.hide_author IS DISTINCT FROM OLD.hide_author
       OR NEW.status NOT IN ('validée'::public.submission_status, 'refusée'::public.submission_status)
       OR OLD.status <> 'en attente'::public.submission_status
       OR NOT private.can_review_team(OLD.team) THEN
      RAISE EXCEPTION 'Un manager peut uniquement valider ou refuser une soumission en attente de ses équipes';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- c) Demandes validées lisibles, avec masquage appliqué côté base.
--    Lecture : admin toutes ; manager celles de ses équipes ; collaborateur celles de son équipe ;
--    et chacun les siennes (comme la politique de lecture).
--    Masqué (hide_author, lecteur collaborateur, pas l'auteur) : author_name = 'Anonyme',
--    submitted_by_email = NULL, et pièce jointe retirée (son chemin commence par l'identifiant
--    du compte auteur et son nom est le nom du fichier d'origine).
CREATE OR REPLACE FUNCTION public.validated_submissions()
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
  hide_author boolean
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
    s.hide_author
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

-- d) Politique de lecture : identique à 20261031110000, sans la clause
--    « le collaborateur lit les demandes validées de son équipe » (désormais via validated_submissions()).
--    Elle protège aussi submission_status_history, dont la lecture dépend de celle de submissions.
DROP POLICY IF EXISTS "Allowed read submissions" ON public.submissions;
CREATE POLICY "Allowed read submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    private.is_allowed() AND (
      private.is_admin()
      OR (private.current_app_role() = 'manager'::public.app_role AND private.can_review_team(team))
      OR submitted_by_email = lower(auth.jwt() ->> 'email')
    )
  );
