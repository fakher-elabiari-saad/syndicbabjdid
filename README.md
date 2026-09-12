# Syndic — application de gestion (17 logements)

## Ce que fait l'app
- Tableau de bord : cotisations encaissées / attendues, dépenses, solde de caisse, retards de paiement.
- Logements : fiche par lot (numéro, nom de l'occupant, cotisation mensuelle), historique des paiements, export CSV individuel.
- Cotisations : grille année × mois × logement, saisie des règlements en un clic, export CSV global.
- Dépenses générales : catégories personnalisables, description, fournisseur, montant, filtres par année/catégorie, export CSV.
- Réglages : nom de la résidence, cotisation par défaut, catégories de dépenses, sauvegarde/restauration, réinitialisation.
- Fonctionne hors-ligne une fois ouverte (service worker), installable sur l'écran d'accueil (PWA).
- Toutes les données restent **sur l'appareil** (localStorage) — aucune donnée n'est envoyée à un serveur.

## Important : la sauvegarde
Les données sont stockées uniquement dans le navigateur de l'appareil. Pensez à exporter
régulièrement une sauvegarde (Réglages > Tableau de bord > "Exporter la sauvegarde") et à la
garder au chaud (email, cloud). Vous pourrez la réimporter sur ce même appareil ou un autre.

## Pour l'installer sur le téléphone ("Ajouter à l'écran d'accueil")
Un vrai comportement d'app installée (icône, plein écran, fonctionnement hors-ligne) demande que
les fichiers soient servis en **https** (ou en local via `localhost`) — un simple double-clic sur
`index.html` en local (`file://`) ne suffit pas pour le service worker sur mobile.

Solution la plus simple et gratuite : **GitHub Pages**
1. Créez un dépôt GitHub (public ou privé) et déposez-y tous les fichiers de ce dossier
   (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, le dossier `icons/`).
2. Dans les réglages du dépôt → *Pages*, activez la publication depuis la branche `main`.
3. Ouvrez l'URL fournie (`https://votre-compte.github.io/votre-depot/`) sur le téléphone.
4. Safari (iPhone) : bouton Partager → "Sur l'écran d'accueil".
   Chrome (Android) : menu ⋮ → "Ajouter à l'écran d'accueil" / "Installer l'application".

Alternatives tout aussi simples : glisser le dossier sur **Netlify Drop** (netlify.com/drop),
ou **Vercel**, ou tout hébergement statique existant.

## Structure des fichiers
```
index.html      structure de l'app
style.css       identité visuelle
app.js          toute la logique (données, calculs, écrans)
manifest.json   nom, icônes, couleurs pour l'installation
sw.js           service worker (fonctionnement hors-ligne)
icons/          icônes de l'app
```
