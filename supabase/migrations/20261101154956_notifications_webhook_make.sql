-- B03 (T10, étape 3) : chaque nouvelle notification de type 'decision' appelle le webhook Make.
-- Règle d'envoi : seules les lignes 'decision' appellent Make. Une ligne 'nouvelle_demande' ne
-- déclenche aucun appel (le manager est prévenu par email via son récapitulatif, T11).
--
-- Secrets : l'URL et la clé du webhook sont lues dans Vault, jamais écrites ici. À créer à la main
-- dans le SQL Editor (pour mémoire, ne pas remplir ce fichier) :
--   select vault.create_secret('<VALEUR>', 'make_webhook_url');
--   select vault.create_secret('<VALEUR>', 'make_webhook_key');
--
-- Corps envoyé, exactement et sans autre champ (jamais le texte de la demande ni le nom de l'auteur) :
--   {"type":"INSERT","table":"notifications","schema":"public",
--    "record":{"id","type","recipient_email","submission_id","created_at","read_at"},"old_record":null}

-- 1) Extension d'appels HTTP asynchrones (sans erreur si déjà présente)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Fonction d'envoi. Un échec ne bloque jamais la soumission ni la décision : simple WARNING,
--    sans message d'erreur détaillé (il pourrait citer l'URL du webhook dans les logs).
CREATE OR REPLACE FUNCTION private.send_notification_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions, vault
AS $$
DECLARE
  _url text;
  _key text;
BEGIN
  BEGIN
    IF NEW.type IS DISTINCT FROM 'decision' THEN
      RETURN NEW;
    END IF;

    SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'make_webhook_url';
    SELECT decrypted_secret INTO _key FROM vault.decrypted_secrets WHERE name = 'make_webhook_key';

    IF coalesce(_url, '') = '' OR coalesce(_key, '') = '' THEN
      RAISE WARNING 'webhook Make ignoré : secret make_webhook_url ou make_webhook_key absent';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-make-apikey', _key),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'schema', 'public',
        'record', jsonb_build_object(
          'id', NEW.id,
          'type', NEW.type,
          'recipient_email', NEW.recipient_email,
          'submission_id', NEW.submission_id,
          'created_at', NEW.created_at,
          'read_at', NEW.read_at
        ),
        'old_record', NULL::jsonb
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'webhook Make non envoyé (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NEW;
END
$$;

-- 3) Trigger (la clause WHEN évite même d'appeler la fonction pour 'nouvelle_demande')
REVOKE EXECUTE ON FUNCTION private.send_notification_webhook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_make ON public.notifications;
CREATE TRIGGER notify_make
AFTER INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.type = 'decision')
EXECUTE FUNCTION private.send_notification_webhook();

-- Annulation (à exécuter à la main si besoin ; l'extension pg_net est laissée en place) :
--   DROP TRIGGER notify_make ON public.notifications;
--   DROP FUNCTION private.send_notification_webhook();
