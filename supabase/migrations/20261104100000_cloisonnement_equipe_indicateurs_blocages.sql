-- B17 (T23, étape 1) : cloisonnement par équipe de la lecture des points bloquants et des indicateurs.
-- Décisions du 2026-11-04 : table de liaison (un élément peut concerner plusieurs équipes) ; un élément sans
-- aucune équipe liée reste visible de tout le cabinet ; l'admin voit tout ; aucun rattachement par
-- allowed_users.team (l'équipe d'un manager = ses lignes manager_teams, les admins restent à NULL).
-- Les politiques d'écriture « Admin write » ne changent pas. Aucune donnée supprimée.
--
-- Note de conception : les politiques de lecture de blockers / metrics / metrics_history passent par deux
-- fonctions SECURITY DEFINER (private.can_read_blocker, private.can_read_metric). Sans cela, la sous-requête
-- « existe-t-il une liaison ? » serait elle-même filtrée par la RLS des tables de liaison, et un élément lié
-- à une autre équipe passerait pour « sans équipe », donc visible de tous.
--
-- Annulation (à exécuter à la main si besoin) :
--   DROP POLICY "Scoped read" ON public.blockers;
--   CREATE POLICY "Allowed read" ON public.blockers FOR SELECT TO authenticated USING (private.is_allowed());
--   DROP POLICY "Scoped read" ON public.metrics;
--   CREATE POLICY "Allowed read" ON public.metrics FOR SELECT TO authenticated USING (private.is_allowed());
--   DROP POLICY "Scoped read metrics history" ON public.metrics_history;
--   CREATE POLICY "Allowed read metrics history" ON public.metrics_history FOR SELECT TO authenticated USING (private.is_allowed());
--   DROP TRIGGER keep_one_manager_team ON public.manager_teams;
--   DROP FUNCTION private.keep_one_manager_team();
--   DROP TABLE public.blocker_teams;  -- emporte ses GRANT, sa clé étrangère RESTRICT vers teams, ses politiques et son index
--   DROP TABLE public.metric_teams;   -- idem
--   DROP FUNCTION private.can_read_blocker(uuid);
--   DROP FUNCTION private.can_read_metric(text);
--   DROP FUNCTION private.in_my_scope(text);
--   DELETE FROM public.teams WHERE name = 'Cloud et Cybersécurité';  -- seulement si aucune ligne ne l'utilise

-- a) Équipe manquante
INSERT INTO public.teams (name, is_reserved)
SELECT 'Cloud et Cybersécurité', false
WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE name = 'Cloud et Cybersécurité');

-- b) Tables de liaison
CREATE TABLE public.blocker_teams (
  blocker_id uuid NOT NULL REFERENCES public.blockers(id) ON DELETE CASCADE,
  team text NOT NULL REFERENCES public.teams(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (blocker_id, team)
);
CREATE TABLE public.metric_teams (
  metric_key text NOT NULL REFERENCES public.metrics(key) ON UPDATE CASCADE ON DELETE CASCADE,
  team text NOT NULL REFERENCES public.teams(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (metric_key, team)
);
CREATE INDEX blocker_teams_team_idx ON public.blocker_teams (team);
CREATE INDEX metric_teams_team_idx ON public.metric_teams (team);

ALTER TABLE public.blocker_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_teams ENABLE ROW LEVEL SECURITY;
-- Écriture réservée à l'admin par la politique « Admin write » (les droits de table seuls ne suffisent pas).
GRANT SELECT, INSERT, DELETE ON public.blocker_teams, public.metric_teams TO authenticated;
GRANT ALL ON public.blocker_teams, public.metric_teams TO service_role;

-- c) Périmètre de l'utilisateur : admin, son équipe (allowed_users.team) ou ses lignes manager_teams
CREATE OR REPLACE FUNCTION private.in_my_scope(_team text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT coalesce(private.is_admin(), false)
    OR EXISTS (
      SELECT 1
      FROM public.allowed_users au
      WHERE au.email = lower(auth.jwt() ->> 'email')
        AND au.team IS NOT NULL
        AND lower(btrim(au.team)) = lower(btrim(_team))
    )
    OR EXISTS (
      SELECT 1
      FROM public.allowed_users au
      JOIN public.manager_teams mt ON mt.allowed_user_id = au.id
      WHERE au.email = lower(auth.jwt() ->> 'email')
        AND lower(btrim(mt.team)) = lower(btrim(_team))
    )
$function$;

-- Visibilité d'un élément : admin, ou aucune liaison, ou une liaison dans mon périmètre
CREATE OR REPLACE FUNCTION private.can_read_blocker(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.is_allowed()
    AND (
      private.is_admin()
      OR NOT EXISTS (SELECT 1 FROM public.blocker_teams bt WHERE bt.blocker_id = _id)
      OR EXISTS (SELECT 1 FROM public.blocker_teams bt WHERE bt.blocker_id = _id AND private.in_my_scope(bt.team))
    )
$function$;

CREATE OR REPLACE FUNCTION private.can_read_metric(_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT private.is_allowed()
    AND (
      private.is_admin()
      OR NOT EXISTS (SELECT 1 FROM public.metric_teams mt WHERE mt.metric_key = _key)
      OR EXISTS (SELECT 1 FROM public.metric_teams mt WHERE mt.metric_key = _key AND private.in_my_scope(mt.team))
    )
$function$;

REVOKE ALL ON FUNCTION private.in_my_scope(text), private.can_read_blocker(uuid), private.can_read_metric(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.in_my_scope(text), private.can_read_blocker(uuid), private.can_read_metric(text) TO authenticated;

-- d) Politiques de lecture (« Admin write » inchangées)
DROP POLICY "Allowed read" ON public.blockers;
CREATE POLICY "Scoped read" ON public.blockers FOR SELECT TO authenticated
  USING (private.can_read_blocker(id));

DROP POLICY "Allowed read" ON public.metrics;
CREATE POLICY "Scoped read" ON public.metrics FOR SELECT TO authenticated
  USING (private.can_read_metric(key));

DROP POLICY "Allowed read metrics history" ON public.metrics_history;
CREATE POLICY "Scoped read metrics history" ON public.metrics_history FOR SELECT TO authenticated
  USING (private.can_read_metric(metric_key));

CREATE POLICY "Scoped read" ON public.blocker_teams FOR SELECT TO authenticated
  USING (private.is_allowed() AND private.in_my_scope(team));
CREATE POLICY "Admin write" ON public.blocker_teams FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE POLICY "Scoped read" ON public.metric_teams FOR SELECT TO authenticated
  USING (private.is_allowed() AND private.in_my_scope(team));
CREATE POLICY "Admin write" ON public.metric_teams FOR ALL TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());

-- e) Rattachement des points bloquants (la colonne department ne change pas). Indicateurs : aucune liaison.
INSERT INTO public.blocker_teams (blocker_id, team)
SELECT b.id, m.team
FROM public.blockers b
JOIN (VALUES
  ('DATA & IA',             'Pôle Data et IA'),
  ('DIRECTION RECRUTEMENT', 'Direction recrutement'),
  ('OPÉRATIONS',            'Opérations'),
  ('PRODUCT TEAM',          'Product'),
  ('RELATIONS CLIENTS',     'Relation clients'),
  ('CLOUD & CYBERSÉCURITÉ', 'Cloud et Cybersécurité')
) AS m(dept, team) ON b.department = m.dept
ON CONFLICT DO NOTHING;

-- f) Un manager garde au moins une équipe
-- Laisse passer : un compte dont le rôle n'est plus manager, un utilisateur supprimé (le trigger s'exécute alors
-- après la suppression de la ligne allowed_users, qui n'existe plus ici) et ses suppressions en cascade.
-- Suppression d'une équipe : manager_teams_team_fkey est ON DELETE RESTRICT, aucune cascade n'atteint ce trigger.
CREATE OR REPLACE FUNCTION private.keep_one_manager_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF EXISTS (
       SELECT 1
       FROM public.allowed_users au
       JOIN public.allowed_user_roles aur ON aur.allowed_user_id = au.id
       WHERE au.id = OLD.allowed_user_id
         AND aur.role = 'manager'::public.app_role
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.manager_teams mt
       WHERE mt.allowed_user_id = OLD.allowed_user_id AND mt.id <> OLD.id
     )
  THEN
    RAISE EXCEPTION 'Un manager doit garder au moins une équipe.';
  END IF;
  RETURN OLD;
END
$function$;

CREATE TRIGGER keep_one_manager_team
  BEFORE DELETE ON public.manager_teams
  FOR EACH ROW EXECUTE FUNCTION private.keep_one_manager_team();
