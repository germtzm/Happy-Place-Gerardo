-- B17 (T23, étape 1), correctif : les privilèges par défaut du projet avaient donné tous les droits de table
-- à anon et à authenticated sur blocker_teams et metric_teams. On ramène les droits au strict nécessaire :
-- authenticated garde SELECT, INSERT, DELETE (l'écriture reste limitée à l'admin par la politique « Admin write »),
-- anon n'a aucun droit, service_role n'est pas touché. Aucune politique ni autre droit n'est modifié.
--
-- Annulation (à exécuter à la main si besoin) :
--   GRANT ALL ON public.blocker_teams, public.metric_teams TO anon;
--   GRANT UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.blocker_teams, public.metric_teams TO authenticated;

REVOKE ALL ON public.blocker_teams, public.metric_teams FROM anon;
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.blocker_teams, public.metric_teams FROM authenticated;
