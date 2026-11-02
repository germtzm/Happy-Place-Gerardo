-- B04 (T11, étape 1) : préférences de récapitulatif d'un manager + compteurs d'actions en attente.
-- Aucune écriture directe pour authenticated : tout passe par get_my_recap / save_my_recap.
-- Heure d'envoi (send_time) : heure de Paris, créneaux de 15 minutes. send_day : ISO (1 = lundi … 7 = dimanche).

-- 1) Table
CREATE TABLE public.recap_preferences (
  email text PRIMARY KEY CHECK (email = lower(email)),
  channel_app boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT true,
  send_day smallint NOT NULL DEFAULT 1 CHECK (send_day BETWEEN 1 AND 7),
  send_time time NOT NULL DEFAULT '08:00'
    CHECK (extract(minute from send_time)::int % 15 = 0 AND extract(second from send_time) = 0),
  frequency text NOT NULL DEFAULT 'desactive'
    CHECK (frequency IN ('desactive', 'quotidien', 'hebdomadaire')),
  last_text text,
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recap_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recap_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.recap_preferences TO authenticated;
GRANT ALL ON TABLE public.recap_preferences TO service_role;

CREATE POLICY "Recipients read own recap preferences" ON public.recap_preferences
  FOR SELECT TO authenticated
  USING (private.is_allowed() AND email = lower(auth.jwt() ->> 'email'));

-- 2) Lire ma préférence (ou la ligne par défaut, non enregistrée). Managers et admins.
CREATE OR REPLACE FUNCTION public.get_my_recap()
RETURNS public.recap_preferences
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _email text := lower(auth.jwt() ->> 'email');
  _row public.recap_preferences;
BEGIN
  IF NOT private.is_allowed()
     OR private.current_app_role() NOT IN ('manager'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _row FROM public.recap_preferences WHERE email = _email;
  IF NOT FOUND THEN
    _row := ROW(_email, true, true, 1::smallint, '08:00'::time, 'desactive', NULL, NULL, now());
  END IF;
  RETURN _row;
END
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_recap() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_recap() TO authenticated;

-- 3) Enregistrer ma préférence. Managers et admins.
CREATE OR REPLACE FUNCTION public.save_my_recap(
  p_channel_app boolean,
  p_channel_email boolean,
  p_frequency text,
  p_send_day smallint,
  p_send_time time
)
RETURNS public.recap_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _email text := lower(auth.jwt() ->> 'email');
  _row public.recap_preferences;
BEGIN
  IF NOT private.is_allowed()
     OR private.current_app_role() NOT IN ('manager'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_channel_app IS NULL OR p_channel_email IS NULL OR p_frequency IS NULL
     OR p_send_day IS NULL OR p_send_time IS NULL THEN
    RAISE EXCEPTION 'Paramètres manquants';
  END IF;
  IF p_frequency NOT IN ('desactive', 'quotidien', 'hebdomadaire') THEN
    RAISE EXCEPTION 'Fréquence invalide';
  END IF;
  IF p_send_day NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'Jour invalide (1 = lundi … 7 = dimanche)';
  END IF;
  IF extract(minute from p_send_time)::int % 15 <> 0 OR extract(second from p_send_time) <> 0 THEN
    RAISE EXCEPTION 'Heure invalide (créneaux de 15 minutes, heure de Paris)';
  END IF;
  IF p_frequency <> 'desactive' AND NOT p_channel_app AND NOT p_channel_email THEN
    RAISE EXCEPTION 'Choisis au moins un canal';
  END IF;

  INSERT INTO public.recap_preferences
    (email, channel_app, channel_email, frequency, send_day, send_time, updated_at)
  VALUES
    (_email, p_channel_app, p_channel_email, p_frequency, p_send_day, p_send_time, now())
  ON CONFLICT (email) DO UPDATE SET
    channel_app = EXCLUDED.channel_app,
    channel_email = EXCLUDED.channel_email,
    frequency = EXCLUDED.frequency,
    send_day = EXCLUDED.send_day,
    send_time = EXCLUDED.send_time,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END
$$;

REVOKE EXECUTE ON FUNCTION public.save_my_recap(boolean, boolean, text, smallint, time)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_recap(boolean, boolean, text, smallint, time) TO authenticated;

-- 4) Compteurs d'un manager. Appelée uniquement côté serveur (service_role) : le REVOKE bloque
--    authenticated et anon ; le contrôle interne refuse en plus tout appel portant un JWT
--    anon/authenticated, au cas où un GRANT serait ajouté plus tard.
--    Ne renvoie ni nom d'auteur, ni pièce jointe, ni titre de brouillon ou de départ (décision D4).
--    pending_requests : demandes « en attente » des équipes du manager, hors les siennes.
--    drafts : brouillons d'actualités dont il est l'auteur (news.author_email).
--    departures : avis de départ ouverts et non téléchargés dont il est destinataire.
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
  IF coalesce(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

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

-- 5) Mémoriser le dernier texte envoyé. Appelée par Make avec la clé du secret Vault
--    'recap_callback_key' (jamais lue ni affichée ici). Clé absente, vide ou fausse : même erreur.
CREATE OR REPLACE FUNCTION public.store_recap(p_key text, p_email text, p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _secret text;
BEGIN
  SELECT s.decrypted_secret INTO _secret
  FROM vault.decrypted_secrets s
  WHERE s.name = 'recap_callback_key';

  IF _secret IS NULL OR p_key IS NULL OR p_key <> _secret THEN
    RAISE EXCEPTION 'Clé invalide' USING ERRCODE = '42501';
  END IF;
  IF p_email IS NULL OR p_text IS NULL THEN
    RAISE EXCEPTION 'Paramètres manquants';
  END IF;
  IF char_length(p_text) > 1000 THEN
    RAISE EXCEPTION 'Texte trop long (1 000 caractères au plus)';
  END IF;

  UPDATE public.recap_preferences
     SET last_text = p_text, last_sent_at = now()
   WHERE email = lower(btrim(p_email));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune préférence enregistrée pour cet e-mail';
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.store_recap(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_recap(text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Annulation (à exécuter à la main si besoin) :
--   DROP FUNCTION IF EXISTS public.store_recap(text, text, text);
--   DROP FUNCTION IF EXISTS private.recap_facts(text);
--   DROP FUNCTION IF EXISTS public.save_my_recap(boolean, boolean, text, smallint, time);
--   DROP FUNCTION IF EXISTS public.get_my_recap();
--   DROP TABLE IF EXISTS public.recap_preferences;
--
-- Script de test RLS (à exécuter à la main, il se termine par ROLLBACK).
-- Remplacer les trois adresses :
--   KESHA   = manager de l'équipe Product
--   GONTRAN = collaborateur de l'équipe Product
--   AUTRE   = manager d'une autre équipe
-- Résultats attendus : 1, erreur, 0, erreur, erreur.
--
-- BEGIN;
--   -- 1) Kesha enregistre jour 3 (mercredi) à 09:15 -> attendu : 1 ligne
--   SELECT set_config('request.jwt.claims', '{"email":"KESHA","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT public.save_my_recap(true, true, 'hebdomadaire', 3::smallint, '09:15'::time);
--   SELECT '1) Kesha lit sa ligne' AS test, count(*) AS lignes FROM public.recap_preferences;
--
--   -- 2) Jour 8 -> attendu : erreur
--   DO $t$ BEGIN
--     PERFORM public.save_my_recap(true, true, 'hebdomadaire', 8::smallint, '09:15'::time);
--     RAISE NOTICE '2) jour 8 : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '2) jour 8 : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
--
--   -- 3) Gontran lit la ligne de Kesha -> attendu : 0
--   SELECT set_config('request.jwt.claims', '{"email":"GONTRAN","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT '3) Gontran lit la ligne de Kesha' AS test, count(*) AS lignes FROM public.recap_preferences;
--
--   -- 4) Gontran appelle save_my_recap -> attendu : erreur
--   DO $t$ BEGIN
--     PERFORM public.save_my_recap(true, true, 'quotidien', 1::smallint, '08:00'::time);
--     RAISE NOTICE '4) Gontran save : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '4) Gontran save : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
--
--   -- 5) Un manager d'une autre équipe appelle recap_facts de Kesha -> attendu : erreur
--   SELECT set_config('request.jwt.claims', '{"email":"AUTRE","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--   DO $t$ BEGIN
--     PERFORM * FROM private.recap_facts('KESHA');
--     RAISE NOTICE '5) recap_facts : PAS D''ERREUR (anormal)';
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE '5) recap_facts : erreur attendue (%)', SQLERRM;
--   END $t$;
--   RESET ROLE;
-- ROLLBACK;
