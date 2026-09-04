# Mise en service du workspace privé

## 1. Branche intégrée

Utiliser `feature/workspace-suite`. Elle contient à la fois la bibliothèque/veille accessibilité et le workspace privé.

## 2. Sécurité base de données

Dans Supabase > SQL Editor > New query, exécuter le contenu de :

`supabase/workspace-security.sql`

Ce script crée `workspace_profiles` et `workspace_data`, active RLS et limite les accès à l’utilisateur Supabase autorisé.

## 3. API IA gratuite

Le proxy IA est une Supabase Edge Function nommée `workspace-ai`.

Le code source est ici :

`supabase/functions/workspace-ai/index.ts`

Dans Supabase > Edge Functions > Deploy a new function > Via Editor :

1. nommer la fonction `workspace-ai`
2. coller le contenu de `index.ts`
3. déployer

## 4. Clé Groq

Créer une clé API Groq, puis dans Supabase > Edge Functions > Secrets ajouter :

- `AI_API_KEY` = clé Groq
- `AI_MODEL` = `openai/gpt-oss-20b` (optionnel, c’est déjà la valeur par défaut)

Ne jamais mettre la clé Groq dans GitHub, le HTML ou le JavaScript du navigateur.

## 5. Test

Lancer le site localement :

```powershell
python -m http.server 5500
```

Puis ouvrir :

`http://localhost:5500/workspace/`

Après connexion, tester `CV Builder` et `A11Y Copilot`.

## 6. Mise en ligne

Une fois validé, fusionner `feature/workspace-suite` dans `main`. GitHub Pages servira alors le workspace à :

`https://sarah-bussi.github.io/mini_projet/workspace/`

Les pages statiques restent techniquement accessibles par URL, mais les données privées sont protégées par RLS et les appels IA par vérification de session côté Edge Function.
