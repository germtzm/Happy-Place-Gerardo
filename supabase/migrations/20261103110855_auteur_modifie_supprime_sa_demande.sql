-- B23 (T18, étape 1) : l'auteur peut modifier ou supprimer sa propre demande tant qu'elle est « en attente ».
-- Aucune politique RLS n'est modifiée : l'écriture passe par deux fonctions SECURITY DEFINER qui
-- vérifient elles-mêmes l'utilisateur, l'auteur et le statut. Rien n'est appliqué à l'interface ici.
--
-- Annulation (à exécuter à la main si besoin) :
--   DROP FUNCTION public.update_my_submission(uuid, text, boolean);
--   DROP FUNCTION public.delete_my_submission(uuid);
--   ALTER TABLE public.notifications DROP COLUMN deleted_by_author_at;
--   -- Remettre NOT NULL seulement si aucune ligne n'a submission_id NULL :
--   --   ALTER TABLE public.notifications ALTER COLUMN submission_id SET NOT NULL;
--   -- Rétablir private.notifications_guard_update() à l'identique de 20261101153712
--   -- (version sans l'exception sur submission_id / deleted_by_author_at).
--   -- Puis rétablir private.enforce_submission_review() à l'identique de 20261101173752
--   -- (fonction précédente, sans l'exception « modification de sa propre demande »).

-- 1) Notifications : conserver les lignes quand l'auteur supprime sa demande (décision Q1).
--    La clé étrangère est ON DELETE CASCADE : une suppression de la demande effacerait donc les
--    notifications déjà envoyées. La clé étrangère reste inchangée (la suppression par l'admin garde
--    son comportement) ; la fonction de suppression détache d'abord les notifications
--    (submission_id = NULL) et les marque, avant de supprimer la demande.
ALTER TABLE public.notifications ALTER COLUMN submission_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN deleted_by_author_at timestamptz;
COMMENT ON COLUMN public.notifications.deleted_by_author_at IS
  'Renseigné quand l''auteur a supprimé la demande liée : submission_id est alors NULL (« supprimée par l''auteur »).';

-- 1b) Garde-fou des notifications : le trigger notifications_guard_update refuse toute modification
--     autre que read_at pour une session dont le rôle du jeton n'est pas service_role. Une fonction
--     SECURITY DEFINER appelée par un utilisateur garde ce jeton : sans cette étape, le détachement
--     des notifications de delete_my_submission serait refusé. On autorise UNIQUEMENT la transition
--     exacte « submission_id renseigné -> NULL avec deleted_by_author_at NULL -> renseigné », sans autre
--     colonne modifiée. Les droits de colonne (UPDATE limité à read_at pour authenticated) interdisent
--     déjà tout UPDATE direct de ces colonnes par le client.
CREATE OR REPLACE FUNCTION private.notifications_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Toutes les colonnes sauf read_at et les deux colonnes de la suppression par l'auteur
  IF (to_jsonb(NEW) - 'read_at' - 'submission_id' - 'deleted_by_author_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'read_at' - 'submission_id' - 'deleted_by_author_at') THEN
    RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
  END IF;

  IF (NEW.submission_id IS DISTINCT FROM OLD.submission_id
      OR NEW.deleted_by_author_at IS DISTINCT FROM OLD.deleted_by_author_at)
     AND NOT (OLD.submission_id IS NOT NULL AND NEW.submission_id IS NULL
              AND OLD.deleted_by_author_at IS NULL AND NEW.deleted_by_author_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'Une notification lue ne peut pas redevenir non lue';
  END IF;

  RETURN NEW;
END
$function$;

-- 2) Trigger de relecture : un manager qui est l'auteur de sa demande ne pouvait écrire dessus que pour
--    la décider (interdit). On autorise uniquement une modification qui ne change ni le statut, ni
--    l'équipe, ni le nom d'auteur, ni la date de création. Le chemin direct reste fermé : la politique
--    « Managers review assigned submissions » exige un statut décidé après écriture sur une ligne « en attente ».
CREATE OR REPLACE FUNCTION private.enforce_submission_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF private.current_app_role() = 'manager'::public.app_role THEN
    IF OLD.submitted_by_email IS NOT NULL
       AND lower(OLD.submitted_by_email) = lower(auth.jwt() ->> 'email') THEN
      IF NEW.status = OLD.status
         AND NEW.team = OLD.team
         AND NEW.author_name = OLD.author_name
         AND NEW.created_at = OLD.created_at THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Un manager ne peut pas valider ni refuser sa propre demande';
    END IF;
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

-- 3) Modification : texte et « masquer mon nom » seulement.
--    Mêmes limites qu'à la création (contrainte submissions_content_length_check : 5 à 2000 caractères
--    après suppression des espaces de bord). Les notifications ne sont pas touchées (décision Q2).
CREATE OR REPLACE FUNCTION public.update_my_submission(p_id uuid, p_content text, p_hide_author boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _owner text;
  _status public.submission_status;
  _content text := btrim(coalesce(p_content, ''));
BEGIN
  IF _email IS NULL OR NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_hide_author IS NULL THEN
    RAISE EXCEPTION 'Le choix « masquer mon nom » est obligatoire';
  END IF;
  IF char_length(_content) < 5 OR char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'La proposition doit contenir entre 5 et 2000 caractères';
  END IF;

  SELECT lower(s.submitted_by_email), s.status INTO _owner, _status
  FROM public.submissions s
  WHERE s.id = p_id
  FOR UPDATE;

  -- Même message pour « introuvable » et « pas la vôtre » : on ne révèle pas l'existence de la demande.
  IF NOT FOUND OR _owner IS DISTINCT FROM _email THEN
    RAISE EXCEPTION 'Demande introuvable ou non modifiable par vous';
  END IF;
  IF _status <> 'en attente'::public.submission_status THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée : elle ne peut plus être modifiée';
  END IF;

  UPDATE public.submissions
     SET content = _content,
         hide_author = p_hide_author
   WHERE id = p_id;
END
$$;

-- 4) Suppression : la pièce jointe est mise en file d'effacement par le trigger existant
--    queue_deleted_submission_attachment (AFTER DELETE, comme pour l'admin) ; l'historique de statut part
--    en cascade comme pour l'admin ; les notifications sont conservées, détachées et marquées.
CREATE OR REPLACE FUNCTION public.delete_my_submission(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _owner text;
  _status public.submission_status;
BEGIN
  IF _email IS NULL OR NOT private.is_allowed() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT lower(s.submitted_by_email), s.status INTO _owner, _status
  FROM public.submissions s
  WHERE s.id = p_id
  FOR UPDATE;

  IF NOT FOUND OR _owner IS DISTINCT FROM _email THEN
    RAISE EXCEPTION 'Demande introuvable ou non supprimable par vous';
  END IF;
  IF _status <> 'en attente'::public.submission_status THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée : elle ne peut plus être supprimée';
  END IF;

  UPDATE public.notifications
     SET submission_id = NULL,
         deleted_by_author_at = now()
   WHERE submission_id = p_id;

  DELETE FROM public.submissions WHERE id = p_id;
END
$$;

-- 5) Droits : EXECUTE retiré à PUBLIC et à anon, accordé à authenticated seulement.
REVOKE ALL ON FUNCTION public.update_my_submission(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_submission(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_submission(uuid) TO authenticated;
