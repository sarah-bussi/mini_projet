# Mise en service du workspace privé

## 1. Branche intégrée

Utiliser `feature/workspace-suite`. Elle contient la bibliothèque/veille accessibilité, le workspace privé et la version workspace d’A11Y Copilot.

Le dépôt du mémoire `sarah-bussi/a11y-copilot` reste séparé. La version workspace est explicitement une implémentation post-évaluation : elle peut lire une copie exportée de son corpus local, mais le script n’écrit jamais dans le dépôt du mémoire.

## 2. Sécurité du workspace

Dans Supabase > SQL Editor, exécuter une fois :

`supabase/workspace-security.sql`

Ce script crée `workspace_profiles` et `workspace_data`, active RLS et limite les accès à l’utilisateur Supabase autorisé.

## 3. Retrieval A11Y léger

Exécuter ensuite dans Supabase > SQL Editor :

`supabase/workspace-a11y-retrieval.sql`

Ce script crée :

- `workspace_a11y_corpus` : copie serveur du corpus normatif ;
- un index plein texte + trigrammes ;
- `search_workspace_a11y(...)` : fonction de retrieval utilisée uniquement côté serveur.

Le navigateur n’a pas d’accès direct au corpus. La Supabase Edge Function utilise la clé `service_role` fournie automatiquement par Supabase.

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

Le script lit uniquement :

- `../a11y-copilot/backend/knowledge/normative/RGAA/structured/rgaa_sections.json`
- `../a11y-copilot/backend/knowledge/normative/RAAM/structured/raam_criteres.json`

et génère :

`supabase/workspace-a11y-corpus.generated.sql`

Si le dépôt `a11y-copilot` est ailleurs :

```powershell
python scripts/build_workspace_a11y_corpus.py --source "C:\chemin\vers\a11y-copilot"
```

Ouvrir ensuite `supabase/workspace-a11y-corpus.generated.sql`, copier son contenu dans Supabase SQL Editor et l’exécuter. Le fichier généré appartient uniquement à `mini_projet`.

## 4. Edge Function `workspace-ai`

Le proxy IA est la Supabase Edge Function :

`supabase/functions/workspace-ai/index.ts`

Dans Supabase > Edge Functions > `workspace-ai` :

1. remplacer le contenu de `index.ts` par la version du dépôt ;
2. redéployer la fonction.

Pour le mode A11Y Copilot, la fonction :

1. vérifie la session et l’UUID autorisé ;
2. route Web vers RGAA et Mobile vers RAAM ;
3. prépare une requête documentaire ;
4. interroge `search_workspace_a11y` ;
5. transmet uniquement les candidats récupérés à Groq ;
6. supprime de la réponse toute référence qui ne faisait pas partie des candidats ;
7. rappelle que la validation humaine reste obligatoire.

Cette chaîne est une implémentation workspace légère ; elle ne reproduit pas les scores de benchmark du pipeline expérimental du mémoire.

## 5. Clé Groq

Dans Supabase > Edge Functions > Secrets :

- `AI_API_KEY` = clé Groq ;
- `AI_MODEL` = `openai/gpt-oss-20b` (optionnel : valeur par défaut).

Ne jamais mettre la clé Groq dans le HTML/JavaScript public.

Pour le brief hebdomadaire GitHub Actions, ajouter séparément dans GitHub > Settings > Secrets and variables > Actions :

- `GROQ_API_KEY` = la même clé Groq.

Les secrets Supabase et GitHub Actions sont deux stockages différents.

## 6. Test local

```powershell
python -m http.server 5500
```

Puis :

`http://localhost:5500/workspace/`

Après connexion, tester `CV Builder` et `A11Y Copilot`.

Pour vérifier le corpus dans Supabase :

```sql
select standard, count(*)
from public.workspace_a11y_corpus
group by standard
order by standard;
```

Il faut obtenir des lignes RGAA et, si le fichier RAAM est disponible localement, RAAM.

## 7. Mise en ligne

Une fois validé, fusionner `feature/workspace-suite` dans `main`. GitHub Pages servira le workspace à :

`https://sarah-bussi.github.io/mini_projet/workspace/`

Les pages statiques sont publiques par nature, mais les données privées sont protégées par RLS, la génération par authentification Supabase et le corpus normatif n’est interrogé que côté Edge Function.
