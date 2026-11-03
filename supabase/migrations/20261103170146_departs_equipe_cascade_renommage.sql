-- Correctif : un renommage d'équipe (UPDATE teams.name) doit aussi mettre à jour departure_notices.team.
-- Retour arrière :
--   ALTER TABLE public.departure_notices DROP CONSTRAINT departure_notices_team_fkey;

-- Normalise les valeurs existantes sur le nom exact de l'équipe (casse et espaces).
UPDATE public.departure_notices n
   SET team = t.name
  FROM public.teams t
 WHERE n.team IS NOT NULL
   AND n.team <> t.name
   AND lower(btrim(n.team)) = lower(btrim(t.name));

-- Une valeur sans équipe correspondante bloquerait la contrainte : elle devient NULL (non rattachée).
UPDATE public.departure_notices n
   SET team = NULL
 WHERE n.team IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.name = n.team);

ALTER TABLE public.departure_notices
  ADD CONSTRAINT departure_notices_team_fkey
  FOREIGN KEY (team) REFERENCES public.teams(name)
  ON UPDATE CASCADE ON DELETE SET NULL;
