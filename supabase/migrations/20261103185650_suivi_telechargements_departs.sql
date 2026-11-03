-- Suivi par document des téléchargements d'un avis de départ ; « tous téléchargés » renseigne downloaded_at.
-- Annulation :
--   DROP FUNCTION public.record_departure_downloads(uuid, text[]);
--   DROP TABLE public.departure_notice_downloads;   -- supprime aussi sa politique

CREATE TABLE public.departure_notice_downloads (
  notice_id uuid NOT NULL REFERENCES public.departure_notices(id) ON DELETE CASCADE,
  doc_path text NOT NULL,
  downloaded_by_email text NOT NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, doc_path)
);

ALTER TABLE public.departure_notice_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.departure_notice_downloads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.departure_notice_downloads TO authenticated;

-- Lecture : le destinataire de l'avis ou un admin (même règle que departure_notices).
CREATE POLICY "Recipients and admins read departure downloads"
  ON public.departure_notice_downloads FOR SELECT TO authenticated
  USING (
    private.is_allowed()
    AND EXISTS (
      SELECT 1 FROM public.departure_notices n
       WHERE n.id = notice_id
         AND (n.recipient_email = lower(auth.jwt() ->> 'email') OR private.is_admin())
    )
  );

-- Écriture uniquement par cette fonction (aucune politique INSERT/UPDATE/DELETE).
CREATE FUNCTION public.record_departure_downloads(_notice_id uuid, _paths text[])
RETURNS TABLE (done_count integer, total_count integer, is_complete boolean, completed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _role public.app_role := private.current_app_role();
  _me text := lower(auth.jwt() ->> 'email');
  _n public.departure_notices%ROWTYPE;
  _total integer;
  _done integer;
  _complete boolean;
  _at timestamptz;
BEGIN
  IF _role IS NULL OR _role NOT IN ('manager'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès refusé : réservé aux managers et aux admins';
  END IF;

  SELECT * INTO _n FROM public.departure_notices WHERE id = _notice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avis de départ introuvable'; END IF;

  -- Manager : son propre avis ET une équipe qu'il valide ; admin : tout avis.
  IF NOT (_role = 'admin'::public.app_role
          OR (_n.recipient_email = _me AND private.can_review_team(_n.team))) THEN
    RAISE EXCEPTION 'Accès refusé : cet avis ne concerne pas tes équipes';
  END IF;
  IF _n.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Cet avis de départ est clos'; END IF;
  IF _paths IS NULL OR cardinality(_paths) = 0 THEN
    RAISE EXCEPTION 'Aucun document indiqué';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_paths) AS p
     WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_n.documents) d WHERE d ->> 'path' = p)
  ) THEN
    RAISE EXCEPTION 'Un document ne fait pas partie de cet avis';
  END IF;

  INSERT INTO public.departure_notice_downloads (notice_id, doc_path, downloaded_by_email)
  SELECT _notice_id, p, _me FROM unnest(_paths) AS p
  ON CONFLICT (notice_id, doc_path) DO NOTHING;      -- retélécharger reste possible, sans effet

  SELECT count(DISTINCT d ->> 'path') INTO _total FROM jsonb_array_elements(_n.documents) d;
  SELECT count(*) INTO _done FROM public.departure_notice_downloads x
   WHERE x.notice_id = _notice_id
     AND x.doc_path IN (SELECT d ->> 'path' FROM jsonb_array_elements(_n.documents) d);

  -- Règle « tous téléchargés » : au moins un document et chacun enregistré.
  _complete := _total > 0 AND _done >= _total;
  IF _complete THEN
    UPDATE public.departure_notices
       SET downloaded_at = coalesce(downloaded_at, now())
     WHERE id = _notice_id
    RETURNING departure_notices.downloaded_at INTO _at;
  ELSE
    _at := _n.downloaded_at;
  END IF;

  RETURN QUERY SELECT _done, _total, _complete, _at;
END $$;

REVOKE ALL ON FUNCTION public.record_departure_downloads(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_departure_downloads(uuid, text[]) TO authenticated;
