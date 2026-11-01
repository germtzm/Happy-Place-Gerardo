-- B03 : retrait des droits inutiles sur public.notifications.
-- Ils viennent des privilèges par défaut de Supabase. La RLS neutralise déjà SELECT/INSERT/UPDATE/
-- DELETE (aucune politique pour anon, aucune politique INSERT/DELETE pour authenticated), mais pas
-- TRUNCATE ni TRIGGER, qui ne passent pas par la RLS : on retire donc les droits eux-mêmes.
-- Aucune donnée touchée. service_role n'est pas modifié.
--
-- État constaté avant la migration (table) :
--   anon          : DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--   authenticated : DELETE, REFERENCES, SELECT, TRIGGER, TRUNCATE (+ UPDATE (read_at), 20261101153712)

-- 1) anon : plus aucun droit
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL (id, recipient_email, type, submission_id, created_at, read_at)
  ON public.notifications FROM anon;

-- 2) authenticated : on garde SELECT, REFERENCES et UPDATE (read_at) ; on retire DELETE, TRUNCATE, TRIGGER
REVOKE DELETE, TRUNCATE, TRIGGER ON TABLE public.notifications FROM authenticated;

-- Annulation (à exécuter à la main si besoin) :
--   GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO anon;
--   GRANT DELETE, TRUNCATE, TRIGGER ON public.notifications TO authenticated;

-- Contrôle après application (attendu : anon = aucune ligne ; authenticated = REFERENCES, SELECT) :
--   select grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'notifications' and grantee in ('anon', 'authenticated')
--   group by grantee;
--   select privilege_type, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'notifications' and grantee in ('anon', 'authenticated')
--     and privilege_type = 'UPDATE';   -- attendu : seulement authenticated / read_at
