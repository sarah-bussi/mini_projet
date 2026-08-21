# Mise en service des témoignages

Le code du portfolio est prêt. Cette procédure relie le formulaire, la modération et l'affichage public à un projet Supabase.

## 1. Créer le projet Supabase

Créer un projet depuis le tableau de bord Supabase. Conserver :

- **Project URL** ;
- **anon / public key**.

La clé `anon` est publique et peut être utilisée dans le navigateur. Ne jamais copier la clé `service_role` dans le dépôt.

## 2. Créer la base et les règles de sécurité

Dans **SQL Editor**, exécuter tout le fichier `supabase-testimonials.sql`.

Ce script :

- crée la table ;
- force chaque soumission publique au statut `pending` ;
- protège les coordonnées de vérification ;
- n'expose au portfolio que les champs autorisés des témoignages validés ;
- limite la modération aux comptes possédant le rôle `moderator`.

## 3. Créer le compte administrateur

Dans **Authentication > Users**, créer le compte de Sarah, puis exécuter dans SQL Editor :

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"moderator"}'::jsonb
where email = 'ADRESSE_ADMIN';
```

Remplacer `ADRESSE_ADMIN` par l'adresse du compte créé.

## 4. Relier le site

Dans `testimonials-config.js`, renseigner :

```js
window.TESTIMONIALS_CONFIG = Object.freeze({
  supabaseUrl: 'https://PROJECT.supabase.co',
  supabaseAnonKey: 'CLE_ANON_PUBLIQUE'
});
```

## 5. Tester le circuit complet

1. Soumettre un témoignage depuis `recommendation.html`.
2. Ouvrir `admin-testimonials.html`.
3. Se connecter et vérifier que le témoignage apparaît dans **En attente**.
4. Choisir **Publier**.
5. Recharger le portfolio : le témoignage doit apparaître dans **Témoignages validés**.
6. Vérifier que le contact de vérification est vide après la décision.

## Sécurité complémentaire avant une forte diffusion

Le formulaire contient un honeypot et des limites de longueur. Si le site reçoit beaucoup de trafic, ajouter un CAPTCHA accessible ou un contrôle serveur avec limitation de débit via une Edge Function.
