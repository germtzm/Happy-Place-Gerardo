-- B03 (T10, étape 1) : l'utilisateur peut marquer ses notifications comme lues, et rien d'autre.
-- Pas de DELETE, pas d'INSERT : les lignes restent créées par les triggers (SECURITY DEFINER).
--
-- Migration rejouable : une version antérieure de ce changement est déjà en base (politique,
-- trigger et fonction présents, droits INSERT/UPDATE accordés sur toutes les colonnes).
-- Elle aligne la base sur ce fichier.

-- 1) Droits : retirer INSERT et UPDATE (table et colonnes), puis n'accorder que UPDATE (read_at).
--    SELECT reste accordé (migration 20261031160000).
REVOKE INSERT, UPDATE ON public.notifications FROM authenticated;
REVOKE INSERT (id, recipient_email, type, submission_id, created_at, read_at),
       UPDATE (id, recipient_email, type, submission_id, created_at, read_at)
  ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- 2) Politique : seulement ses propres lignes, avant comme après la modification
DROP POLICY IF EXISTS "Recipients mark own notifications read" ON public.notifications;
CREATE POLICY "Recipients mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (private.is_allowed() AND recipient_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (private.is_allowed() AND recipient_email = lower(auth.jwt() ->> 'email'));

-- 3) Garde-fou : seule read_at peut changer, et elle ne peut pas repasser à NULL.
--    Seul le service_role n'est pas concerné ; toute autre session (y compris sans JWT) est soumise
--    à la règle.
CREATE OR REPLACE FUNCTION private.notifications_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Comparaison sur toutes les colonnes sauf read_at : couvre aussi les colonnes ajoutées plus tard.
  IF (to_jsonb(NEW) - 'read_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read_at') THEN
    RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
  END IF;

  IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'Une notification lue ne peut pas redevenir non lue';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.notifications_guard_update() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_guard_update ON public.notifications;
CREATE TRIGGER notifications_guard_update
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.notifications_guard_update();

-- 4) Annulation (à exécuter à la main si besoin). Retour à l'état antérieur de la base :
--    GRANT INSERT, UPDATE ON public.notifications TO authenticated;
--    CREATE OR REPLACE FUNCTION private.notifications_guard_update() RETURNS trigger
--    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $f$
--    BEGIN
--      IF coalesce(auth.jwt() ->> 'role', '') = 'service_role'
--         OR nullif(auth.jwt() ->> 'email', '') IS NULL THEN
--        RETURN NEW;
--      END IF;
--      IF (NEW.id, NEW.recipient_email, NEW.type, NEW.submission_id, NEW.created_at)
--         IS DISTINCT FROM
--         (OLD.id, OLD.recipient_email, OLD.type, OLD.submission_id, OLD.created_at) THEN
--        RAISE EXCEPTION 'Seule la colonne read_at d''une notification peut être modifiée';
--      END IF;
--      IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
--        RAISE EXCEPTION 'Une notification lue ne peut pas redevenir non lue';
--      END IF;
--      RETURN NEW;
--    END $f$;
--    Pour retirer entièrement le marquage « lu » (état de 20261031160000) :
--    DROP TRIGGER notifications_guard_update ON public.notifications;
--    DROP FUNCTION private.notifications_guard_update();
--    DROP POLICY "Recipients mark own notifications read" ON public.notifications;
--    REVOKE UPDATE (read_at) ON public.notifications FROM authenticated;

-- 5) Script de test RLS (à exécuter à la main dans l'éditeur SQL, il se termine par ROLLBACK).
--    Remplacer les deux adresses :
--      GONTRAN = collaborateur de l'équipe Product
--      KESHA   = manager de l'équipe Product
--    Les cas d'erreur sont dans des blocs DO qui interceptent l'exception, pour ne pas
--    interrompre la transaction ; chaque bloc affiche un NOTICE avec le résultat.
--
-- BEGIN;
--   -- Gontran soumet
--   SELECT set_config('request.jwt.claims', '{"email":"GONTRAN"}', true);
--   SET LOCAL ROLE authenticated;
--   INSERT INTO public.submissions (author_name, team, content) VALUES ('Gontran', 'x', 'Test marquage lu');
--   RESET ROLE;
--
--   -- Kesha valide (Kesha a 1 notification nouvelle_demande, Gontran 1 decision)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   UPDATE public.submissions SET status = 'validée' WHERE content = 'Test marquage lu';
--   RESET ROLE;
--
--   -- Gontran tente de marquer la notification de Kesha (attendu : 0 ligne)
--   SELECT set_config('request.jwt.claims', '{"email":"GONTRAN"}', true);
--   SET LOCAL ROLE authenticated;
--   WITH u AS (UPDATE public.notifications SET read_at = now()
--              WHERE recipient_email = lower('KESHA')
--                AND submission_id IN (SELECT id FROM public.submissions WHERE content = 'Test marquage lu')
--              RETURNING 1)
--   SELECT 'Gontran -> notification de Kesha' AS test, count(*) AS lignes_modifiees FROM u;
--   RESET ROLE;
--
--   -- Kesha marque la sienne (attendu : 1 ligne)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   WITH u AS (UPDATE public.notifications SET read_at = now()
--              WHERE recipient_email = lower('KESHA')
--                AND submission_id IN (SELECT id FROM public.submissions WHERE content = 'Test marquage lu')
--              RETURNING 1)
--   SELECT 'Kesha -> sa notification' AS test, count(*) AS lignes_modifiees FROM u;
--   RESET ROLE;
--
--   -- Kesha tente de modifier type (attendu : erreur, droit refusé sur la colonne)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   DO $t$ BEGIN
--     UPDATE public.notifications SET type = 'decision' WHERE recipient_email = lower('KESHA');
--     RAISE NOTICE 'Kesha -> type : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Kesha -> type : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
--
--   -- Kesha tente de remettre read_at à NULL (attendu : erreur « ne peut pas redevenir non lue »)
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA"}', true);
--   SET LOCAL ROLE authenticated;
--   DO $t$ BEGIN
--     UPDATE public.notifications SET read_at = NULL WHERE recipient_email = lower('KESHA');
--     RAISE NOTICE 'Kesha -> read_at NULL : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Kesha -> read_at NULL : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
-- ROLLBACK;
