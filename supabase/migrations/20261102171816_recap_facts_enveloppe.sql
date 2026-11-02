-- B04 (T11, étape 2) : enveloppe public pour que Make lise les compteurs d'un manager.
-- Make n'a pas de clé service_role : il s'authentifie avec la clé publique du projet, et
-- l'enveloppe vérifie le secret Vault 'recap_callback_key' (même mécanisme que store_recap,
-- valeur jamais lue ni affichée ici). Clé absente, vide ou fausse : même erreur.
-- Le schéma private n'est pas exposé par l'API : seule l'enveloppe est appelable.

-- 1) recap_facts : le contrôle de JWT interne est retiré. L'enveloppe appelle la fonction avec le
--    JWT anon de Make, que ce contrôle aurait refusé. La fonction reste protégée par le REVOKE :
--    ni PUBLIC, ni anon, ni authenticated ne peuvent l'appeler directement.
--    Corps identique à 20261102083325, sans le bloc IF ... RAISE sur auth.jwt() ->> 'role'.
CREATE OR REPLACE FUNCTION private.recap_facts(p_email text)
RETURNS TABLE (
  first_name text,
  pending_requests int,
  drafts int,
  departures int,
  oldest_days int,
  requests jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
#variable_conflict use_column
DECLARE
  _email text := lower(btrim(p_email));
BEGIN
  RETURN QUERY
  WITH me AS (
    SELECT u.id, u.first_name
    FROM public.allowed_users u
    WHERE lower(u.email) = _email
  ),
  teams AS (
    SELECT DISTINCT lower(btrim(mt.team)) AS team
    FROM me
    JOIN public.manager_teams mt ON mt.allowed_user_id = me.id
  ),
  pend AS (
    SELECT s.created_at,
           btrim(regexp_replace(coalesce(s.content, ''), '\s+', ' ', 'g')) AS txt
    FROM public.submissions s
    WHERE s.status = 'en attente'::public.submission_status
      AND lower(btrim(s.team)) IN (SELECT team FROM teams)
      AND lower(coalesce(s.submitted_by_email, '')) <> _email
  ),
  top5 AS (
    SELECT p.created_at, p.txt FROM pend p ORDER BY p.created_at ASC LIMIT 5
  )
  SELECT
    (SELECT me.first_name FROM me LIMIT 1),
    (SELECT count(*)::int FROM pend),
    (SELECT count(*)::int FROM public.news n
      WHERE n.status = 'brouillon'::public.news_status AND lower(n.author_email) = _email),
    (SELECT count(*)::int FROM public.departure_notices d
      WHERE lower(d.recipient_email) = _email AND d.closed_at IS NULL AND d.downloaded_at IS NULL),
    coalesce((SELECT floor(extract(epoch from now() - min(p.created_at)) / 86400)::int FROM pend p), 0),
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', CASE WHEN char_length(t.txt) <= 80 THEN t.txt
                        ELSE rtrim(left(t.txt, 80)) || '…' END,
          'days', floor(extract(epoch from now() - t.created_at) / 86400)::int
        ) ORDER BY t.created_at ASC)
      FROM top5 t
    ), '[]'::jsonb);
END
$$;

REVOKE EXECUTE ON FUNCTION private.recap_facts(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.recap_facts(text) TO service_role;

-- 2) Enveloppe appelée par Make (POST /rest/v1/rpc/get_recap_facts, corps {"p_key":…, "p_email":…}).
--    Mêmes champs que recap_facts, rien d'autre.
CREATE OR REPLACE FUNCTION public.get_recap_facts(p_key text, p_email text)
RETURNS TABLE (
  first_name text,
  pending_requests int,
  drafts int,
  departures int,
  oldest_days int,
  requests jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
#variable_conflict use_column
DECLARE
  _secret text;
BEGIN
  SELECT s.decrypted_secret INTO _secret
  FROM vault.decrypted_secrets s
  WHERE s.name = 'recap_callback_key';

  IF _secret IS NULL OR p_key IS NULL OR p_key <> _secret THEN
    RAISE EXCEPTION 'Clé invalide' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL THEN
    RAISE EXCEPTION 'Paramètres manquants';
  END IF;

  RETURN QUERY SELECT f.* FROM private.recap_facts(p_email) f;
END
$$;

REVOKE EXECUTE ON FUNCTION public.get_recap_facts(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recap_facts(text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Annulation (à exécuter à la main si besoin) :
--   DROP FUNCTION IF EXISTS public.get_recap_facts(text, text);
--   -- puis recréer private.recap_facts avec le contrôle de JWT : rejouer le bloc
--   -- CREATE OR REPLACE FUNCTION private.recap_facts de la migration 20261102083325_recap_preferences.sql
--   -- (avec ses REVOKE / GRANT).
--
-- Script de test (à exécuter à la main, il se termine par ROLLBACK). Le cas « bonne clé » ne se teste
-- pas ici (la valeur du secret n'est jamais lue) : il se teste depuis Make.
-- Remplacer KESHA par l'adresse d'un manager. Résultats attendus : erreur, erreur, erreur, erreur.
--
-- BEGIN;
--   SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
--   SET LOCAL ROLE anon;
--   -- 1) fausse clé -> attendu : erreur « Clé invalide »
--   DO $t$ BEGIN
--     PERFORM * FROM public.get_recap_facts('mauvaise-cle', 'KESHA');
--     RAISE NOTICE '1) fausse clé : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '1) fausse clé : erreur attendue (%)', SQLERRM;
--   END $t$;
--   -- 2) clé nulle -> attendu : erreur
--   DO $t$ BEGIN
--     PERFORM * FROM public.get_recap_facts(NULL, 'KESHA');
--     RAISE NOTICE '2) clé nulle : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '2) clé nulle : erreur attendue (%)', SQLERRM;
--   END $t$;
--   -- 3) appel direct de la fonction private par anon -> attendu : erreur « permission denied »
--   DO $t$ BEGIN
--     PERFORM * FROM private.recap_facts('KESHA');
--     RAISE NOTICE '3) private.recap_facts anon : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '3) private.recap_facts anon : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
--   -- 4) idem pour un utilisateur connecté -> attendu : erreur « permission denied »
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--   DO $t$ BEGIN
--     PERFORM * FROM private.recap_facts('KESHA');
--     RAISE NOTICE '4) private.recap_facts authenticated : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '4) private.recap_facts authenticated : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
-- ROLLBACK;
