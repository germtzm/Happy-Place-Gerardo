-- B23 (T18, étape 3) :
--  (a) l'auteur peut remplacer ou retirer la pièce jointe de sa demande « en attente »
--      (update_my_submission passe de 3 à 6 arguments ; les trois nouveaux ont une valeur par défaut,
--      donc l'appel actuel de l'interface à 3 arguments nommés continue de fonctionner) ;
--  (b) la suppression par l'auteur remet les notifications détachées en non lues (read_at = NULL),
--      pour que le manager revoie l'information une fois.
-- Aucune politique RLS n'est modifiée. Rien ne change dans l'interface.
--
-- Annulation (à exécuter à la main si besoin) :
--   -- 1) Ancienne update_my_submission à 3 arguments
--   DROP FUNCTION public.update_my_submission(uuid, text, boolean, boolean, text, text);
--   CREATE OR REPLACE FUNCTION public.update_my_submission(p_id uuid, p_content text, p_hide_author boolean)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
--   AS $f$
--   DECLARE
--     _email text := lower(nullif(auth.jwt() ->> 'email', ''));
--     _owner text;
--     _status public.submission_status;
--     _content text := btrim(coalesce(p_content, ''));
--   BEGIN
--     IF _email IS NULL OR NOT private.is_allowed() THEN RAISE EXCEPTION 'Accès refusé'; END IF;
--     IF p_hide_author IS NULL THEN RAISE EXCEPTION 'Le choix « masquer mon nom » est obligatoire'; END IF;
--     IF char_length(_content) < 5 OR char_length(_content) > 2000 THEN
--       RAISE EXCEPTION 'La proposition doit contenir entre 5 et 2000 caractères'; END IF;
--     SELECT lower(s.submitted_by_email), s.status INTO _owner, _status
--       FROM public.submissions s WHERE s.id = p_id FOR UPDATE;
--     IF NOT FOUND OR _owner IS DISTINCT FROM _email THEN
--       RAISE EXCEPTION 'Demande introuvable ou non modifiable par vous'; END IF;
--     IF _status <> 'en attente'::public.submission_status THEN
--       RAISE EXCEPTION 'Cette demande a déjà été traitée : elle ne peut plus être modifiée'; END IF;
--     UPDATE public.submissions SET content = _content, hide_author = p_hide_author WHERE id = p_id;
--   END $f$;
--   REVOKE ALL ON FUNCTION public.update_my_submission(uuid, text, boolean) FROM PUBLIC, anon;
--   GRANT EXECUTE ON FUNCTION public.update_my_submission(uuid, text, boolean) TO authenticated;
--   -- 2) delete_my_submission : réexécuter la définition de 20261103110855 (sans read_at = NULL).
--   -- 3) private.notifications_guard_update() : réexécuter la définition de 20261103110855 (section 1b).

-- 1) update_my_submission : remplacement de l'ancienne signature à 3 arguments.
DROP FUNCTION public.update_my_submission(uuid, text, boolean);

CREATE FUNCTION public.update_my_submission(
  p_id uuid,
  p_content text,
  p_hide_author boolean,
  p_change_attachment boolean DEFAULT false,
  p_attachment_path text DEFAULT NULL,
  p_attachment_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _uid uuid := auth.uid();
  _owner text;
  _status public.submission_status;
  _old_path text;
  _content text := btrim(coalesce(p_content, ''));
  _change boolean := coalesce(p_change_attachment, false);
  _name text := nullif(btrim(coalesce(p_attachment_name, '')), '');
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

  -- Pièce jointe : chemin dans le dossier de l'utilisateur (comme la politique de stockage et le
  -- trigger check_submission_attachment), fichier .pdf, nom de 200 caractères au plus.
  IF _change AND p_attachment_path IS NOT NULL THEN
    IF _uid IS NULL
       OR left(p_attachment_path, char_length(_uid::text) + 1) <> _uid::text || '/'
       OR char_length(p_attachment_path) <= char_length(_uid::text) + 1 + 4
       OR lower(right(p_attachment_path, 4)) <> '.pdf' THEN
      RAISE EXCEPTION 'Pièce jointe invalide : un fichier PDF de votre dossier est attendu';
    END IF;
    IF _name IS NOT NULL AND char_length(_name) > 200 THEN
      RAISE EXCEPTION 'Le nom de la pièce jointe doit faire 200 caractères au plus';
    END IF;
  END IF;

  SELECT lower(s.submitted_by_email), s.status, s.attachment_path INTO _owner, _status, _old_path
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

  IF _change THEN
    UPDATE public.submissions
       SET content = _content,
           hide_author = p_hide_author,
           attachment_path = p_attachment_path,
           attachment_name = CASE WHEN p_attachment_path IS NULL THEN NULL ELSE _name END
     WHERE id = p_id;

    -- Ancien fichier remplacé ou retiré : mis en file d'effacement, comme à la suppression d'une demande
    -- (même ON CONFLICT que le trigger queue_deleted_submission_attachment).
    IF _old_path IS NOT NULL AND _old_path IS DISTINCT FROM p_attachment_path THEN
      INSERT INTO public.attachment_deletion_queue (path, delete_after)
      VALUES (_old_path, now())
      ON CONFLICT (path) DO UPDATE
        SET delete_after = least(public.attachment_deletion_queue.delete_after, now());
    END IF;
  ELSE
    UPDATE public.submissions
       SET content = _content,
           hide_author = p_hide_author
     WHERE id = p_id;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.update_my_submission(uuid, text, boolean, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_submission(uuid, text, boolean, boolean, text, text) TO authenticated;

-- 2) delete_my_submission : les notifications détachées redeviennent non lues.
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
         deleted_by_author_at = now(),
         read_at = NULL
   WHERE submission_id = p_id;

  DELETE FROM public.submissions WHERE id = p_id;
END
$$;

-- 3) Garde-fou des notifications : read_at peut repasser à NULL uniquement dans la transition exacte
--    de la suppression par l'auteur (submission_id renseigné -> NULL avec deleted_by_author_at
--    NULL -> renseigné). Tout autre passage de read_at vers NULL reste refusé.
CREATE OR REPLACE FUNCTION private.notifications_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _detach boolean;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  _detach := OLD.submission_id IS NOT NULL AND NEW.submission_id IS NULL
         AND OLD.deleted_by_author_at IS NULL AND NEW.deleted_by_author_at IS NOT NULL;

  -- Toutes les colonnes sauf read_at et les deux colonnes de la suppression par l'auteur
  IF (to_jsonb(NEW) - 'read_at' - 'submission_id' - 'deleted_by_author_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'read_at' - 'submission_id' - 'deleted_by_author_at') THEN
    RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
  END IF;

  IF (NEW.submission_id IS DISTINCT FROM OLD.submission_id
      OR NEW.deleted_by_author_at IS DISTINCT FROM OLD.deleted_by_author_at)
     AND NOT _detach THEN
    RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL AND NOT _detach THEN
    RAISE EXCEPTION 'Une notification lue ne peut pas redevenir non lue';
  END IF;

  RETURN NEW;
END
$function$;
