# Synchronisation multi-appareils (code de synchro anonyme)

Principe : l'utilisateur génère un **code secret** (ex. `K7QM-4WPX-93RT`).
Le client n'envoie jamais le code : il envoie son **hash SHA-256**, qui sert
de clé de ligne dans une table Supabase. Connaître le code = pouvoir lire et
écrire sa propre ligne ; rien d'autre n'est accessible ni identifiable
(aucun e-mail, aucun compte). Code perdu = synchro perdue (la progression
locale reste sur chaque appareil).

## Mise en place (une fois, ~10 minutes)

1. Créer un compte sur https://supabase.com (gratuit) puis un projet
   (région Europe, mot de passe DB quelconque : il ne sert pas ici).
2. Dans SQL Editor, exécuter :

```sql
create table public.progress (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- accès anonyme : la sécurité repose sur l'impossibilité de deviner l'id
-- (hash SHA-256 d'un code aléatoire de 60 bits)
create policy "acces par code" on public.progress
  for all to anon using (true) with check (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();
```

3. Dans Project Settings > API, copier l'« URL » du projet et la clé
   « anon public », puis les coller dans `app/data/sync-config.js` :

```js
window.SYNC_CONFIG = {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJ...",
};
```

4. Redéployer (commit + push). La section « Synchronisation » de Paramètres
   devient active.
5. Keep-alive du tier gratuit (mise en veille après ~7 jours d'inactivité) :
   dans le dépôt GitHub, Settings > Secrets and variables > Actions, créer le
   secret `SUPABASE_PING_URL` avec la valeur
   `https://xxxx.supabase.co/rest/v1/progress?select=id&limit=1` et le secret
   `SUPABASE_ANON_KEY` (la clé anon). Le workflow `keepalive.yml` fait un
   ping hebdomadaire.

## Notes

- Fusion côté client, par élément : carte SRS = plus grand nombre de
  répétitions (à égalité : échéance la plus récente) ; journal = max par
  jour ; auto-évaluations = horodatage le plus récent.
- Périmètre : SRS + journal + auto-évaluations. Les réglages restent par
  appareil, le feedback garde le circuit d'export.
- Vie privée : la ligne ne contient que des identifiants de cartes et des
  horodatages. Pas d'IP stockée par l'appli, pas de nom, pas d'e-mail.
