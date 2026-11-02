-- B04 (T11, étape 4) : envoi planifié du récapitulatif aux managers (décision D12 : la base pousse
-- les compteurs à Make, Make n'a plus à les lire).
--
-- Secrets : l'URL et la clé du webhook Make sont lues dans Vault, jamais écrites ici. À créer à la
-- main dans le SQL Editor (pour mémoire, ne pas remplir ce fichier) :
--   select vault.create_secret('<VALEUR>', 'make_recap_url');
--   select vault.create_secret('<VALEUR>', 'make_recap_key');
--   select vault.create_secret('<VALEUR>', 'recap_callback_key');
--
-- Corps envoyé à Make, exactement et sans autre champ (jamais de nom d'auteur, de pièce jointe,
-- ni de titre de brouillon ou de départ) :
--   {"recipient_email","first_name","frequency","pending_requests","drafts","departures",
--    "oldest_days","requests":[{"title","days"}] (5 au plus),"channel_app","channel_email"}

-- 1) Créneau d'envoi : fonction pure, sans effet de bord (elle sert aussi au test à blanc).
--    Vrai si la préférence est active, si le jour correspond (quotidien : tous les jours ;
--    hebdomadaire : jour ISO de send_day, fuseau Europe/Paris), si l'heure de Paris est dans
--    [send_time, send_time + 15 min[ et si rien n'a déjà été envoyé aujourd'hui (heure de Paris).
--    Le calcul se fait en secondes depuis minuit pour rester juste sur le créneau 23:45.
CREATE OR REPLACE FUNCTION private.recap_is_due(p public.recap_preferences, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, private
AS $$
DECLARE
  _local timestamp := p_now AT TIME ZONE 'Europe/Paris';
  _elapsed numeric := extract(epoch from _local::time) - extract(epoch from p.send_time);
BEGIN
  RETURN (p.channel_app OR p.channel_email)
    AND (p.frequency = 'quotidien'
         OR (p.frequency = 'hebdomadaire' AND p.send_day = extract(isodow from _local)::int))
    AND _elapsed >= 0
    AND _elapsed < 900
    AND (p.last_sent_at IS NULL
         OR (p.last_sent_at AT TIME ZONE 'Europe/Paris')::date < _local::date);
END
$$;

-- 2) Envoi d'un récapitulatif. Un échec ne bloque rien : simple WARNING, sans message d'erreur
--    détaillé (il pourrait citer l'URL du webhook dans les logs). Sans p_force, rien n'est envoyé
--    quand tous les compteurs sont à 0. last_sent_at n'est mis à jour qu'après l'appel
--    (pg_net est asynchrone : « après l'appel » veut dire requête mise en file).
CREATE OR REPLACE FUNCTION private.send_recap(p_email text, p_force boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions, vault
AS $$
DECLARE
  _email text := lower(btrim(p_email));
  _url text;
  _key text;
  _pref public.recap_preferences;
  _f record;
BEGIN
  BEGIN
    SELECT * INTO _pref FROM public.recap_preferences WHERE email = _email;
    IF NOT FOUND THEN
      RAISE WARNING 'récapitulatif ignoré : aucune préférence enregistrée';
      RETURN;
    END IF;

    SELECT * INTO _f FROM private.recap_facts(_email);
    IF NOT p_force
       AND coalesce(_f.pending_requests, 0) = 0
       AND coalesce(_f.drafts, 0) = 0
       AND coalesce(_f.departures, 0) = 0 THEN
      RETURN;
    END IF;

    SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'make_recap_url';
    SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'make_recap_key';
    IF coalesce(_url, '') = '' OR coalesce(_key, '') = '' THEN
      RAISE WARNING 'récapitulatif ignoré : secret make_recap_url ou make_recap_key absent';
      RETURN;
    END IF;

    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-make-apikey', _key),
      body := jsonb_build_object(
        'recipient_email', _email,
        'first_name', _f.first_name,
        'frequency', _pref.frequency,
        'pending_requests', _f.pending_requests,
        'drafts', _f.drafts,
        'departures', _f.departures,
        'oldest_days', _f.oldest_days,
        'requests', _f.requests,
        'channel_app', _pref.channel_app,
        'channel_email', _pref.channel_email
      )
    );

    UPDATE public.recap_preferences SET last_sent_at = now() WHERE email = _email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'récapitulatif non envoyé (SQLSTATE %)', SQLSTATE;
  END;
END
$$;

-- 3) Envoi des récapitulatifs dus. Appelée toutes les 15 minutes. Une erreur sur un manager
--    n'empêche pas les suivants. Aucun rattrapage : un créneau passé n'est jamais rejoué.
CREATE OR REPLACE FUNCTION private.send_due_recaps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _now timestamptz := now();
  _p public.recap_preferences;
BEGIN
  FOR _p IN SELECT * FROM public.recap_preferences WHERE frequency <> 'desactive' LOOP
    BEGIN
      IF private.recap_is_due(_p, _now) THEN
        PERFORM private.send_recap(_p.email);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'récapitulatif non envoyé (SQLSTATE %)', SQLSTATE;
    END;
  END LOOP;
END
$$;

REVOKE EXECUTE ON FUNCTION private.recap_is_due(public.recap_preferences, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.send_recap(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.send_due_recaps() FROM PUBLIC, anon, authenticated;

-- 4) Tâche pg_cron toutes les 15 minutes. cron.schedule avec un nom déjà pris remplace la tâche
--    (pas de doublon) ; aucune tâche 'send-recaps' n'existait au moment de l'écriture.
SELECT cron.schedule('send-recaps', '*/15 * * * *', 'SELECT private.send_due_recaps()');

-- 5) Fermeture de l'enveloppe get_recap_facts : Make ne lit plus les compteurs. Aucun DROP.
REVOKE EXECUTE ON FUNCTION public.get_recap_facts(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recap_facts(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Annulation (à exécuter à la main si besoin) :
--   SELECT cron.unschedule('send-recaps');
--   DROP FUNCTION IF EXISTS private.send_due_recaps();
--   DROP FUNCTION IF EXISTS private.send_recap(text, boolean);
--   DROP FUNCTION IF EXISTS private.recap_is_due(public.recap_preferences, timestamptz);
--   -- rouvrir l'enveloppe (état de la migration recap_facts_enveloppe) :
--   GRANT EXECUTE ON FUNCTION public.get_recap_facts(text, text) TO anon, authenticated;
--
-- Test à blanc (à exécuter à la main, il se termine par ROLLBACK). Il n'appelle ni send_recap ni
-- net.http_post : il ne teste que le choix des créneaux, avec des dates fixes (lundi 2 novembre
-- 2026, heure d'hiver : 08:05 à Paris = 07:05 UTC). Résultats attendus indiqués à droite.
--
-- BEGIN;
--   WITH cas(libelle, attendu, pref, maintenant) AS (VALUES
--     ('créneau en cours (quotidien 08:00, il est 08:05)', true,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'quotidien', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('créneau pas encore commencé (il est 07:55)', false,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'quotidien', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 06:55+00'::timestamptz),
--     ('créneau passé (il est 08:20)', false,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'quotidien', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 07:20+00'::timestamptz),
--     ('déjà envoyé aujourd''hui (08:01 Paris)', false,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'quotidien', NULL, '2026-11-02 07:01+00'::timestamptz, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('envoyé hier, créneau en cours', true,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'quotidien', NULL, '2026-11-01 07:01+00'::timestamptz, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('hebdomadaire le bon jour (lundi = 1)', true,
--       ROW('x@x', true, true, 1::smallint, '08:00'::time, 'hebdomadaire', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('hebdomadaire un autre jour (mercredi = 3)', false,
--       ROW('x@x', true, true, 3::smallint, '08:00'::time, 'hebdomadaire', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('aucun canal coché', false,
--       ROW('x@x', false, false, 1::smallint, '08:00'::time, 'quotidien', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 07:05+00'::timestamptz),
--     ('créneau 23:45 (il est 23:50 à Paris)', true,
--       ROW('x@x', true, true, 1::smallint, '23:45'::time, 'quotidien', NULL, NULL, now())::public.recap_preferences,
--       '2026-11-02 22:50+00'::timestamptz)
--   )
--   SELECT libelle, attendu, private.recap_is_due(pref, maintenant) AS obtenu,
--          attendu = private.recap_is_due(pref, maintenant) AS ok
--   FROM cas;
-- ROLLBACK;
