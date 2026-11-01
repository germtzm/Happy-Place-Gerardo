-- B03 : rattrapage des notifications « nouvelle_demande » pour les demandes encore en attente qui
-- ont été soumises avant le trigger notify_new_submission (31/10) et n'ont donc jamais notifié.
-- Même règle que le trigger : une ligne par manager de l'équipe de la demande, sauf l'auteur.
-- Rejouable : une ligne n'est créée que si elle n'existe pas déjà pour ce manager et cette demande.
-- Aucun email : seules les lignes 'decision' appellent Make (trigger notify_make, clause WHEN).
-- Les lignes créées ici portent l'horodatage de la migration (created_at par défaut), ce qui permet
-- de les retrouver pour l'annulation ci-dessous.

INSERT INTO public.notifications (recipient_email, type, submission_id)
SELECT DISTINCT lower(u.email), 'nouvelle_demande', s.id
FROM public.submissions s
JOIN public.manager_teams mt
  ON lower(btrim(mt.team)) = lower(btrim(s.team))
JOIN public.allowed_users u
  ON u.id = mt.allowed_user_id
JOIN public.allowed_user_roles r
  ON r.allowed_user_id = u.id AND r.role = 'manager'::public.app_role
WHERE s.status = 'en attente'::public.submission_status
  AND lower(u.email) IS DISTINCT FROM lower(s.submitted_by_email)
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.submission_id = s.id
      AND n.type = 'nouvelle_demande'
      AND n.recipient_email = lower(u.email)
  );

-- Annulation (à exécuter à la main si besoin). Relever d'abord l'horodatage des lignes créées par
-- cette migration (le plus récent created_at commun à plusieurs lignes, juste après l'application) :
--   select created_at, count(*) from public.notifications
--   where type = 'nouvelle_demande' group by created_at order by created_at desc limit 3;
-- puis, avec cet horodatage et après vérification du nombre de lignes :
--   delete from public.notifications
--   where type = 'nouvelle_demande' and created_at = '<HORODATAGE_RELEVÉ>' and read_at is null;
