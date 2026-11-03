-- B29 (T21, étape 3) : un manager voit, en lecture seule, tous les départs de personnel de ses équipes,
-- même quand l'avis est adressé à un autre destinataire.
--
-- Constat : l'équipe d'un salarié n'existe que dans allowed_users.team, et la ligne est supprimée au
-- départ effectif : l'équipe d'un départ sans préavis était perdue. On la conserve donc sur l'avis.
--  (a) departure_notices.team : équipe du salarié au moment de l'avis (nullable : un salarié sans équipe
--      reste sans équipe, aucun manager ne le voit alors, seuls les admins) ;
--  (b) rattrapage des avis existants depuis allowed_users.team (UPDATE, aucune ligne supprimée) ;
--  (c) private.notify_departure renseigne la colonne (seul changement : la colonne team) ;
--  (d) public.my_team_departures() : manager = départs ouverts de ses équipes ; admin = tous les départs
--      ouverts ; autre rôle ou anonyme = refus. Une ligne par personne (les avis sont par destinataire),
--      sans documents ni destinataire.
-- Aucune politique RLS n'est modifiée ; departure_notices reste lisible par le destinataire et les admins.
-- Rien ne change dans l'interface.
--
-- Annulation (à exécuter à la main si besoin) :
--   DROP FUNCTION public.my_team_departures();
--   -- Ancienne private.notify_departure (définition de 20261008000003) :
--   CREATE OR REPLACE FUNCTION private.notify_departure(_user_id uuid, _email text, _team text, _date date, _kind text)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
--   DECLARE _docs jsonb := private.departure_documents(_email);
--   BEGIN
--     UPDATE public.departure_notices SET closed_at = now()
--      WHERE departing_user_id = _user_id AND closed_at IS NULL;
--     INSERT INTO public.departure_notices (departing_user_id, departing_label, recipient_email, departure_date, kind, documents)
--     SELECT _user_id, _email, rcpt, _date, _kind, _docs FROM private.departure_recipients(_email, _team) AS rcpt;
--   END $function$;
--   ALTER TABLE public.departure_notices DROP COLUMN team;

-- 1) Équipe du salarié sur l'avis
ALTER TABLE public.departure_notices ADD COLUMN team text;

-- 2) Rattrapage des avis existants (le salarié existe encore pour les départs avec préavis)
UPDATE public.departure_notices n
   SET team = nullif(btrim(u.team), '')
  FROM public.allowed_users u
 WHERE u.id = n.departing_user_id
   AND n.team IS NULL;

-- 3) notify_departure : même corps qu'avant, plus la colonne team
CREATE OR REPLACE FUNCTION private.notify_departure(_user_id uuid, _email text, _team text, _date date, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
DECLARE _docs jsonb := private.departure_documents(_email);
BEGIN
  UPDATE public.departure_notices SET closed_at = now()
   WHERE departing_user_id = _user_id AND closed_at IS NULL;
  INSERT INTO public.departure_notices (departing_user_id, departing_label, recipient_email, departure_date, kind, documents, team)
  SELECT _user_id, _email, rcpt, _date, _kind, _docs, nullif(btrim(_team), '')
    FROM private.departure_recipients(_email, _team) AS rcpt;
END $function$;

-- 4) Départs de mes équipes, en lecture seule
CREATE FUNCTION public.my_team_departures()
RETURNS TABLE (departing_label text, departure_date date, kind text, team text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _role public.app_role := private.current_app_role();
BEGIN
  IF _role IS NULL OR _role NOT IN ('manager'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux managers et aux admins';
  END IF;

  RETURN QUERY
  SELECT x.departing_label, x.departure_date, x.kind, x.team
    FROM (
      SELECT DISTINCT n.departing_user_id, n.departing_label, n.departure_date, n.kind, n.team
        FROM public.departure_notices n
       WHERE n.closed_at IS NULL
         AND (
           _role = 'admin'::public.app_role
           OR EXISTS (
             SELECT 1
               FROM public.allowed_users au
               JOIN public.manager_teams mt ON mt.allowed_user_id = au.id
              WHERE au.email = lower(auth.jwt() ->> 'email')
                AND n.team IS NOT NULL
                AND lower(btrim(mt.team)) = lower(btrim(n.team))
           )
         )
    ) x
   ORDER BY x.departure_date, x.departing_label;
END
$$;

REVOKE ALL ON FUNCTION public.my_team_departures() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_departures() TO authenticated;

-- 5) Cas de test (à jouer après accord, dans un bloc qui se termine par une exception d'annulation).
--    Comptes : KESHA = manager Product, JULIE = manager People et Pôle Data et IA, GONTRAN = collaborateur,
--    OLIVIA = admin. Données de test insérées par le propriétaire (aucun trigger sur departure_notices) :
--    départ "test-product" (équipe Product, 3 avis, un par destinataire, dont un déjà téléchargé),
--    départ "test-people" (équipe People, 1 avis), départ "test-sans-equipe" (équipe NULL, 1 avis),
--    départ "test-clos" (équipe Product, avis clos).
--      T1 Kesha  : voit test-product (1 ligne malgré 3 avis), ne voit ni test-people, ni test-sans-equipe, ni test-clos
--      T2 Julie  : voit test-people, ne voit pas test-product (autre équipe)
--      T3 Gontran: erreur « Accès refusé »
--      T4 Olivia : voit test-product, test-people et test-sans-equipe, pas test-clos
--      T5 anonyme: erreur permission denied
--      T6 colonnes renvoyées : exactement departing_label, departure_date, kind, team (ni documents ni destinataire)
--      T7 private.notify_departure(uuid, 'test-notify@example.test', 'Product', date, 'préavis') : les avis créés
--         portent team = 'Product' ; avec _team = '  ' : team NULL
--      T8 rattrapage : aucun avis dont departing_user_id existe encore dans allowed_users n'a team NULL
--         quand allowed_users.team est renseignée
--    Puis : select * from private.run_smoke_tests(); (toutes les lignes à ok = true).
