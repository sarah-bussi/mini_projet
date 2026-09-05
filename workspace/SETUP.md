# Mise en service du workspace privé

## 1. Branche de travail

Utiliser `feature/workspace-suite`. Elle contient le portfolio/workspace privé, la bibliothèque/veille accessibilité, le CV Builder et A11Y Copilot.

A11Y Copilot est désormais un produit autonome du workspace. Le dépôt du mémoire reste séparé et hors périmètre de développement. Le seul lien historique possible est l'export local en lecture seule d'une copie du corpus RGAA/RAAM vers `mini_projet`.

## 2. Sécurité du workspace

Dans Supabase > SQL Editor, exécuter une fois :

`supabase/workspace-security.sql`

Ce script crée `workspace_profiles` et `workspace_data`, active RLS et limite les accès à l'utilisateur Supabase autorisé.

## 3. Retrieval A11Y léger

Exécuter ensuite dans Supabase > SQL Editor :

`supabase/workspace-a11y-retrieval.sql`

Ce script crée :

- `workspace_a11y_corpus` : copie serveur du corpus normatif ;
- un index plein texte + trigrammes ;
- `search_workspace_a11y(...)` : fonction de retrieval utilisée uniquement côté serveur.

Le navigateur n'a pas d'accès direct au corpus. La Supabase Edge Function utilise `service_role` côté serveur.

### Générer la copie du corpus

Avec les deux dépôts locaux côte à côte :

```text
C:\Users\...\mini_projet
C:\Users\...\a11y-copilot
```

Depuis `mini_projet` :

```powershell
python scripts/build_workspace_a11y_corpus.py
```

Le script lit uniquement les fichiers structurés RGAA/RAAM et génère :

`supabase/workspace-a11y-corpus.generated.sql`

Si le dépôt source est ailleurs :

```powershell
python scripts/build_workspace_a11y_corpus.py --source "C:\chemin\vers\a11y-copilot"
```

Le script n'écrit jamais dans le dépôt source.

## 4. Edge Function `workspace-ai`

Fichier source :

`supabase/functions/workspace-ai/index.ts`

Dans Supabase > Edge Functions > `workspace-ai`, déployer exactement la version du dépôt.

### Pipeline A11Y Copilot

1. validation de la session et de l'UUID autorisé ;
2. routage Web → RGAA / Mobile → RAAM ;
3. requête documentaire déterministe ;
4. retrieval Supabase de 8 candidats maximum ;
5. appel Groq n°1 : jugement d'applicabilité documentaire avec Structured Outputs ;
6. contrôle serveur d'une preuve textuelle exacte (`supportQuote`) ;
7. downgrade automatique d'une référence annoncée applicable si sa preuve n'est pas réellement présente dans le candidat ;
8. appel Groq n°2 : génération finale uniquement à partir des références autorisées ;
9. formatage serveur, niveau de confiance et validation humaine obligatoire.

Le Copilot utilise donc au maximum deux appels Groq par analyse A11Y. L'expansion de requête par IA a été supprimée pour réduire le coût, la latence et les erreurs 429.

Les candidats non évalués par le juge restent visibles comme `NOT_ASSESSED` au lieu de disparaître silencieusement.

## 5. Clé Groq

Dans Supabase > Edge Functions > Secrets :

- `AI_API_KEY` = clé Groq ;
- `AI_MODEL` = `openai/gpt-oss-20b` (valeur par défaut si absent).

Ne jamais mettre la clé Groq dans le HTML ou le JavaScript public.

Pour le brief hebdomadaire GitHub Actions, le secret séparé reste :

- `GROQ_API_KEY`.

## 6. UX et erreurs

Le frontend :

- bloque les doubles soumissions pendant une génération ;
- place le focus sur le résultat après succès ;
- distingue les erreurs de session, retrieval, Structured Output et rate limit 429 ;
- n'affiche jamais de secret ni de token.

## 7. Cas de non-régression

Les scénarios de référence sont stockés dans :

`tests/workspace-a11y-copilot-cases.json`

Ils couvrent notamment :

- image sans alternative ;
- alternative présente mais non pertinente ;
- bouton icône sans nom accessible ;
- précondition script non établie ;
- routage mobile vers RAAM.

Ces cas doivent être rejoués après toute évolution du retrieval, du prompt ou du formatage.

## 8. Test local

```powershell
python -m http.server 5500
```

Puis :

`http://localhost:5500/workspace/`

Pour vérifier le corpus :

```sql
select standard, count(*)
from public.workspace_a11y_corpus
group by standard
order by standard;
```

## 9. Mise en ligne

Une fois validé, fusionner `feature/workspace-suite` dans `main`.

GitHub Pages servira le workspace à :

`https://sarah-bussi.github.io/mini_projet/workspace/`

Les pages statiques sont publiques par nature, mais les données privées restent protégées par authentification/RLS et le corpus n'est interrogé que côté serveur.
