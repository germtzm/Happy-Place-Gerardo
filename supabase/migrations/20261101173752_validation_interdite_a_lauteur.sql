-- B03 : un manager ne peut plus valider ni refuser sa propre demande.
-- Jusqu'ici la politique « Managers review assigned submissions » et ce trigger ne vérifiaient que
-- l'équipe et le statut : un manager de l'équipe pouvait décider de sa propre demande, sans
-- notification ni email (notify_decision ignore l'auteur). Les admins ne sont pas concernés.
-- Une demande sans e-mail d'auteur (données de démo) n'est pas affectée.

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

-- Annulation (à exécuter à la main si besoin) : fonction précédente, sans le contrôle de l'auteur.
--   CREATE OR REPLACE FUNCTION private.enforce_submission_review()
--   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private'
--   AS $function$
--   BEGIN
--     IF private.current_app_role() = 'manager'::public.app_role THEN
--       IF NEW.author_name IS DISTINCT FROM OLD.author_name
--          OR NEW.team IS DISTINCT FROM OLD.team
--          OR NEW.content IS DISTINCT FROM OLD.content
--          OR NEW.created_at IS DISTINCT FROM OLD.created_at
--          OR NEW.hide_author IS DISTINCT FROM OLD.hide_author
--          OR NEW.status NOT IN ('validée'::public.submission_status, 'refusée'::public.submission_status)
--          OR OLD.status <> 'en attente'::public.submission_status
--          OR NOT private.can_review_team(OLD.team) THEN
--         RAISE EXCEPTION 'Un manager peut uniquement valider ou refuser une soumission en attente de ses équipes';
--       END IF;
--     END IF;
--     RETURN NEW;
--   END
--   $function$;

-- Script de test RLS (à exécuter à la main dans l'éditeur SQL, il se termine par ROLLBACK).
-- Remplacer les deux adresses :
--   KESHA  = manager de l'équipe Product
--   SOPHIE = autre manager de l'équipe Product
--
-- BEGIN;
--   -- Kesha soumet une demande pour Product
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   INSERT INTO public.submissions (author_name, team, content)
--     VALUES ('Kesha', 'Product', 'Test auto-validation');
--   RESET ROLE;
--
--   -- Kesha tente de la valider (attendu : erreur « ne peut pas valider ni refuser sa propre demande »)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   DO $t$ BEGIN
--     UPDATE public.submissions SET status = 'validée' WHERE content = 'Test auto-validation';
--     RAISE NOTICE 'Kesha -> sa demande : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Kesha -> sa demande : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
--
--   -- Sophie la valide (attendu : 1 ligne modifiée)
--   SELECT set_config('request.jwt.claims', '{"email":"SOPHIE"}', true);
--   SET LOCAL ROLE authenticated;
--   WITH u AS (UPDATE public.submissions SET status = 'validée'
--              WHERE content = 'Test auto-validation' RETURNING 1)
--   SELECT 'Sophie -> demande de Kesha' AS test, count(*) AS lignes_modifiees FROM u;
--   RESET ROLE;
-- ROLLBACK;
