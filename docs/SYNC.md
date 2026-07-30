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
-- (hash SHA-256 d'un code aléatoire de ~59 bits : 12 caractères tirés d'un
--  alphabet de 31 signes, I/L/O/0/1 exclus pour qu'il se recopie à la main)
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

## Ce qui voyage, et comment ça fusionne

Le serveur n'arbitre rien : c'est un casier clé-valeur. **Toute la fusion se fait
dans le client** (`mergeRemote()`), et elle doit donc converger sans arbitre.
La charge utile reste en `v: 1`, un ajout de clé étant purement additif : un
appareil resté en arrière ignore ce qu'il ne connaît pas et ne réécrit que ses
propres clés.

| clé | contenu | règle de fusion |
|---|---|---|
| `srs` | état FSRS par carte (stabilité, difficulté, intervalle, échéance, répétitions, rechutes) | plus grand nombre de répétitions ; à égalité, échéance la plus tardive |
| `journal` | total quotidien, ratés, temps de révision, écoute | le plus grand nombre de réponses par jour |
| `eval` | auto-évaluation par verset | horodatage le plus récent |
| `vues` | règles de tajwid cochées | union, horodatage le plus récent |
| `evalLog` | historique des changements d'auto-évaluation | union dédupliquée sur (instant, verset), reborné à 4000 entrées |
| `revLog` | détail de chaque révision, pour l'optimiseur FSRS | union dédupliquée sur (instant, carte), **sans élagage** ; les index de carte étant locaux à chaque appareil, chaque entrée distante repasse par le dictionnaire qui l'accompagne |
| `epochs` | horodatage de la dernière remise à zéro, par domaine | la plus récente gagne, et les données antérieures sont écartées |
| `fsrs` | réglages qui pilotent la planification : nombre de boutons, souvenir visé, 21 poids | le plus récemment changé gagne, **avec deux horodatages distincts** pour que déplacer un curseur sur un appareil n'efface pas les poids calculés sur un autre |

Les époques existent parce qu'une fusion qui garde toujours le maximum ne sait
pas exprimer une suppression : sans elles, effacer sa progression puis se
synchroniser la ferait revenir depuis le premier appareil resté en arrière.

**Hors périmètre** : les autres réglages (thème, police, taille, style de
récitation) restent propres à chaque appareil, et les avis gardent leur circuit
d'export manuel.

## Vie privée

La ligne ne contient que des identifiants de cartes, des horodatages, des notes
de 1 à 4 et les réglages de planification. Aucun nom, aucun e-mail, aucun compte,
aucune adresse IP stockée par l'application. Le code secret lui-même ne quitte
jamais l'appareil : seul son hash voyage.
