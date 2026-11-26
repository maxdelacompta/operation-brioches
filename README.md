# Opération Brioche

**Application de gestion des campagnes Opération Brioche de l’AEIM**  
**Documentation technique et fonctionnelle — état au 26 novembre 2026**

> **État du projet : prototype fonctionnel en cours de stabilisation.** L’interface et les modules métier sont développés principalement en React et TypeScript ; une grande partie des données et des pièces jointes reste enregistrée dans le navigateur. **Le projet fourni ne constitue pas encore une application multi-utilisateurs centralisée et sécurisée prête à être exposée sur Internet.**
>
> **Référence documentaire :** archive `src(20261125-161407).zip`, transmise le 25/11/2026. Les corrections distinctes de compilation et de stocks du 25/11 sont décrites plus bas ; elles ne sont **pas présumées présentes dans cette archive source**. Le contenu de la racine du projet, le backend éventuel et les données réelles n’ont pas été fournis.

## Sommaire

1. [Objectif et périmètre](#1-objectif-et-périmètre)
2. [État et points de vigilance](#2-état-et-points-de-vigilance)
3. [Technologies et dépendances](#3-technologies-et-dépendances)
4. [Installer et lancer le projet](#4-installer-et-lancer-le-projet)
5. [Architecture du code](#5-architecture-du-code)
6. [Modules fonctionnels](#6-modules-fonctionnels)
7. [Parcours métier et règles de calcul](#7-parcours-métier-et-règles-de-calcul)
8. [Données, stockage et campagnes](#8-données-stockage-et-campagnes)
9. [Utilisateurs, rôles et sécurité](#9-utilisateurs-rôles-et-sécurité)
10. [Documents et intégrations externes](#10-documents-et-intégrations-externes)
11. [Journal d’activité et traçabilité](#11-journal-dactivité-et-traçabilité)
12. [Tests et recette](#12-tests-et-recette)
13. [Travaux à réaliser avant déploiement](#13-travaux-à-réaliser-avant-déploiement)
14. [Exploitation et dépannage](#14-exploitation-et-dépannage)
15. [Historique des corrections et évolution](#15-historique-des-corrections-et-évolution)

## 1. Objectif et périmètre

Opération Brioche regroupe les informations nécessaires à l’organisation et au suivi de la campagne : interlocuteurs, commandes de brioches, achats fournisseurs, livraisons, stands, établissements, stocks, dons, fiches de caisse, remises de fonds, chèques, pièces justificatives, suivi financier, cartographie et administration.

L’objectif fonctionnel est d’éviter la multiplication de fichiers Excel et de pouvoir suivre les événements depuis la commande jusqu’au rapprochement comptable, en conservant les liens entre les étapes.

Le logiciel comporte des **campagnes distinctes**, dont 2025, 2026 et des possibilités de test. Il faut maintenir cette séparation dans l’ensemble des données et des écrans.

### Public visé

- Responsables et collaborateurs du pôle Communication.
- Comptabilité et services financiers.
- Établissements AEIM et intervenants autorisés.
- Bénévoles / coordinateurs terrain selon leurs droits.
- Administrateurs et développeurs autorisés.

Les accès doivent être restreints aux besoins du rôle et, lorsque pertinent, au périmètre d’établissement.

## 2. État et points de vigilance

| Sujet | État constaté dans le code fourni | Conséquence |
| --- | --- | --- |
| Interface métier | Nombreuses pages React, routes et contextes métier présents | Le parcours peut être testé localement. |
| Données | `localStorage` et `IndexedDB` employés par de nombreux modules | Pas de base centrale fournie dans l’archive. |
| Authentification | Identifiants, hachages et session gérés côté navigateur | Ne suffit pas à sécuriser un usage partagé. |
| Rôles / permissions | Catalogue, garde de routes et contrôles de campagne côté front | À reproduire et imposer côté serveur. |
| Chat | Conversations, groupes, mentions, signalements et modération locale | Pas de synchronisation inter-postes garantie. |
| Commandes établissements | Création, remises, règlements et PDF dans les services | Les écritures locales ne sont pas des transactions serveur. |
| Stocks fournisseurs | Correctif distinct du 25/11/2026 pour doublons et campagnes | Contrôler son installation et les données historiques. |
| Microsoft 365 | Point de raccordement frontend prévu via `/api/justificatifs/send` | Backend AEIM non inclus dans le dossier transmis. |
| Tests et build | Scripts et configuration racine non transmis | Le build de production n’a pas été certifié avec la configuration réelle. |
| Responsive mobile | À développer comme chantier ultérieur | Ne pas confondre affichage mobile et accès distant sécurisé. |

**Important :** ce README explique le projet tel qu’il ressort des sources disponibles. Il ne constitue ni une recette complète ni une certification de sécurité.

## 3. Technologies et dépendances

### Socle identifié

- **React**, **React DOM**, **TypeScript/TSX** : interface.
- **React Router DOM** : navigation par routes.
- **Vite** : outillage de développement attendu d’après le projet et `import.meta.env` ; configuration exacte non transmise.
- **CSS** : styles généraux et styles par page/composant.
- **Lucide React** : icônes.
- **Recharts** : graphiques.
- **MapLibre GL** : cartographie.

### Bibliothèques importées dans `src/`

| Usage | Bibliothèques observées |
| --- | --- |
| Excel / imports et exports | `exceljs` |
| PDF | `jspdf`, `jspdf-autotable`, `pdf-lib` |
| Lecture de PDF / OCR | `pdfjs-dist`, `tesseract.js`, `@embedpdf/engines`, `@embedpdf/pdfium` |
| Codes QR | `qrcode` |
| Modèles Word `.docx` | `docxtemplater`, `pizzip` |
| Géodonnées et cartes | `maplibre-gl`, types `geojson` |

**Ne pas copier une liste de versions depuis ce fichier :** le `package.json` et son fichier de verrouillage sont absents de l’archive transmise. Les versions doivent être reprises du projet réel. Les imports `docxtemplater` et `pizzip` étaient non résolus dans l’environnement provisoire de l’audit initial ; leur état doit être vérifié dans le projet réel.

## 4. Installer et lancer le projet

### Prérequis

1. Disposer de la **racine complète du projet**, pas seulement du dossier `src/` : notamment `package.json`, fichier de verrouillage, `index.html`, éventuels fichiers `tsconfig*`, configuration Vite et ressources publiques.
2. Installer une version de **Node.js compatible avec les contraintes `engines`** du `package.json` et le gestionnaire de paquets réellement utilisé par le projet.
3. Disposer d’un navigateur récent prenant en charge JavaScript, `crypto.subtle`, `localStorage` et `IndexedDB`.
4. Utiliser une origine adaptée (par exemple `localhost` en développement ou HTTPS pour un hébergement sécurisé).

### Procédure de développement (à vérifier avec le `package.json`)

Depuis la **racine du projet** :

```bash
# Consulter les scripts et les versions requises avant toute installation
cat package.json

# Si npm est le gestionnaire du projet et que son lockfile est présent
npm ci

# Si le script "dev" est défini
npm run dev
```

Sous PowerShell, utiliser `Get-Content package.json` à la place de `cat` si nécessaire. Si le projet utilise un autre gestionnaire de paquets, employer celui indiqué par son lockfile. **Ne pas recréer un `package.json` arbitraire** à partir de la liste de dépendances ci-dessus.

Pour une vérification de production, si les scripts existent :

```bash
npm run build
npm run preview
```

Les noms de scripts doivent être confirmés sur le projet fourni. **Ne pas déployer les fichiers sources ni un serveur de développement Vite comme serveur de production.** Une mise en production exige aussi les services backend et la stratégie de données décrits en section 13.

### Variables d’environnement observées

Le code `src/services/justificatifMailWorkflow.ts` lit :

```dotenv
# Exemple de paramètre frontend ; n'active pas à lui seul le service d'envoi.
VITE_OB_MICROSOFT_MAIL_ENABLED=false
```

Quand ce paramètre vaut `true`, le frontend tente d’utiliser l’API `/api/justificatifs/send`. Cette API **doit déjà être fournie et sécurisée côté AEIM**. Ne jamais placer de secret Microsoft, mot de passe, jeton privé ou clé d’API sensible dans une variable `VITE_*` : ces valeurs sont exposées au navigateur.

### Vérification rapide après démarrage

- Ouvrir la page de connexion et tester un **compte de démonstration autorisé**.
- Vérifier le chargement du tableau de bord et de la barre de navigation.
- Sélectionner une campagne de test avant toute saisie.
- Ouvrir **Établissements → Stock Brioches** puis **Suivi Brioches**.
- Vérifier la création d’un bon, son PDF, une remise et un règlement sur **données de test uniquement**.
- Examiner les erreurs de console et les éventuels échecs de chargement de ressources.

## 5. Architecture du code

```text
projet/                           # Racine complète : non fournie dans l'archive
├── package.json                  # À récupérer
├── index.html                    # À récupérer
├── vite.config.*                 # S'il existe : à récupérer
├── tsconfig*.json                # À récupérer
└── src/
    ├── main.tsx                  # Entrée React et activation du journal automatique
    ├── App.tsx                   # Providers, routeur et pages chargées à la demande
    ├── layouts/
    │   └── AppLayout.tsx         # Auth, sidebar, topbar, chat, garde de campagne
    ├── components/               # UI commune, chat, permissions et widgets
    │   └── ui/                   # Cartes KPI, filtres, en-têtes, onglets...
    ├── pages/                    # Écrans par domaine métier
    ├── contexts/                 # États et providers partagés
    ├── services/                 # Stockages spécialisés, PDF, OCR, mails...
    ├── lib/                      # Calculs métier, stock, permissions, rapprochements
    ├── security/                 # Cartographie des routes et permissions
    ├── types/                    # Types des entités métier
    ├── data/                     # Données initiales / exemples
    ├── styles/                   # Styles généraux
    └── assets/                   # Ressources graphiques
```

### Flux d’exécution

```text
src/main.tsx
   └─ installAutomaticAudit()
   └─ src/App.tsx
       └─ UsersProvider / AuthProvider / BrowserRouter
       └─ ObDataProvider / PermissionsProvider / autres providers métier
       └─ routes React Router
           └─ AppLayout
               ├─ garde d'authentification
               ├─ contrôle de permission (routes reconnues)
               ├─ campagne active / lecture seule
               ├─ Sidebar + Topbar + Chat
               └─ page métier
                   ├─ contextes React
                   ├─ fonctions src/lib/
                   └─ services src/services/ et stockage navigateur
```

Les pages sont principalement chargées par `lazy()` dans `src/App.tsx`. Ajouter une page suppose généralement de vérifier **trois endroits** : sa route dans `App.tsx`, son accès dans `Sidebar.tsx` et sa correspondance dans `src/security/accessPolicy.ts` / le catalogue des permissions.

### Conventions recommandées pour les développements suivants

- Conserver un **identifiant stable** pour chaque entité métier, distinct de son libellé affiché.
- Éviter de mettre des calculs complexes à la fois dans plusieurs pages : isoler la règle dans `lib/` ou `services/`.
- Préserver la compatibilité avec les données existantes et prévoir une migration avant tout changement de clé.
- Limiter un correctif à un domaine fonctionnel identifié, avec test de régression.
- Ne pas dupliquer les réceptions, remises ou paiements entre modules : chaque événement doit avoir une **source d’écriture de référence**.

## 6. Modules fonctionnels

La liste ci-dessous décrit les routes et composants **présents dans le code examiné**. La présence d’une page n’implique pas que son fonctionnement ait été entièrement testé.

| Domaine | Principales routes / vues | Finalité |
| --- | --- | --- |
| Tableau de bord | `/dashboard` | Indicateurs et suivi de la campagne. |
| Gestion terrain | `/gestion/stands-brioches`, compteur par stand | Planning, suivi des stands, comptage, opérations. |
| Caisse et TPE | `/gestion/suivi-caisse-tpe` | Affectation et suivi du matériel de caisse / TPE. |
| Référentiels (BDD) | `/bdd/donateurs`, `/bdd/mairies`, `/bdd/benevoles` | Donateurs, mairies et bénévoles. |
| Commandes dons | `/commandes`, `/commandes/livraisons-retraits`, `/commandes/mairies-rs` | Commandes entreprises, mairies / RS et acheminement. |
| Commandes achats | `/commandes-achats/artisans`, `/gms`, `/industriels`, `/fournisseurs` | Commandes fournisseurs et réceptions. |
| Établissements | `/etablissements/stock-brioches` | Mouvements et disponibilité des brioches. |
| Établissements | `/etablissements/suivi-brioches` | Dons directs, bons de commande, remises, règlements, historique. |
| Établissements | `/etablissements/recap-global` | Consolidation par établissement. |
| Encaissements | `/encaissements/fiches-caisse`, `/coffre`, `/gestion-cheques`, `/suivi-banque` | Retour de fonds, chèques et banque. |
| Documents / finance | `/finance/factures-paiements`, `/justificatifs-dons`, `/mecenat`, `/sponsoring`, `/pertes-ecarts` | Justificatifs, factures, conventions, écarts et mécénat. |
| Écoles | `/gestion/ecoles` | Commandes des classes, supports et retours. |
| Matériel / véhicules | `/gestion/materiel-communication`, `/gestion/vehicules` | Matériel, réservations et suivi des véhicules. |
| Géographie | `/geographie/carte` et vues associées | Visualisation cartographique des lieux / secteurs. |
| Administration | `/administration/utilisateurs`, `/roles`, `/campagnes`, `/etablissements`, `/parametres`, `/journal` | Utilisateurs, permissions, campagnes, paramètres et audit. |
| Chat | Composant global dans `AppLayout` | Conversations, groupes, pièces jointes et actions sur messages. |

Les pages d’import/export Excel, les PDF, les modules OCR et les écrans de justificatifs complètent ces parcours.

## 7. Parcours métier et règles de calcul

### 7.1 Flux général des brioches

```text
Commande auprès d'un fournisseur
    │
    ▼
Livraison / réception réellement validée
    │                  (une réception physique = une seule écriture)
    ▼
Stock de l'établissement
    ├──► Transfert vers un autre lieu (sortie + entrée cohérentes)
    ├──► Remise sur commande d'établissement
    ├──► Don direct avec contrepartie
    └──► Ajustement justifié / perte / écart

Parcours financier distinct :
Don direct encaissé ──────────────────────┐
Règlement de bon d'établissement ────────┼──► Récapitulatif des fonds reçus
Fiche de caisse / coffre / banque ───────┘    (rapprocher, ne pas compter deux fois)
```

Les modalités de rapprochement avec les fiches de caisse et la banque nécessitent une recette transversale complète avant production.

### 7.2 Commandes des établissements

Références de code :

- `src/services/etablissementsCommandesStore.ts`
- `src/services/etablissementsCommandesPdf.ts`
- `src/pages/SuiviBrioches.tsx`
- `src/services/etablissementsRecap.ts`

| Action | Brioches remises / stock | Comptabilité de la commande |
| --- | --- | --- |
| Créer un bon | **Aucune sortie** | Montant de commande créé, non encaissé. |
| Remettre une partie ou la totalité | Sortie du **nombre réellement remis** | Aucun encaissement automatique. |
| Enregistrer un règlement | Stock inchangé | Ajout d’un paiement réel au montant réglé. |
| Payer avant de recevoir | Stock inchangé tant que la remise n’a pas eu lieu | Commande *réglée*, mais pas forcément *terminée*. |
| Terminer | Quantité totalement remise | Totalité du montant réglée également. |

Formules métier dans le service :

```text
montant prévu       = quantité commandée × prix unitaire
quantité remise     = somme des remises enregistrées
reste à remettre    = max(0, quantité commandée − quantité remise)
montant réglé       = somme des règlements enregistrés
reste à régler      = max(0, montant prévu − montant réglé)
commande réglée     = reste à régler = 0
commande terminée   = reste à régler = 0 ET reste à remettre = 0
```

**Ne jamais** enregistrer une seconde fois un règlement de commande comme nouveau don direct : cela doublerait l’encaissement. Les montants des commandes sont stockés en **centimes entiers** dans ce service pour limiter les écarts d’arrondi.

### 7.3 Dons directs

Le suivi d’établissement distingue un don **avec contrepartie** (brioches réellement remises) d’un don **sans contrepartie**. Un don sans contrepartie est encaissé mais **ne retire pas de brioche** du stock. Une commande n’est pas un don direct.

### 7.4 Stock et mouvements

Références : `src/lib/briochesStock.ts`, `src/pages/StockBrioches.tsx`, services `commande*Stock.ts`, `stocksBriochesFlux.ts`, `stocksBriochesLots.ts`.

Le stock est calculé à partir des **mouvements** et des dons avec contrepartie. Les transferts doivent entraîner une sortie à l’origine et une entrée à destination, sans création de brioches fictives. Les réceptions doivent être créées **à la livraison effective**, une seule fois, et dans la bonne campagne.

**Anomalies historiques :** le correctif du 25/11 a été conçu pour éviter les doubles réceptions et les écritures sur la mauvaise campagne. Il ne supprime volontairement pas les anciens doublons potentiels : ils doivent faire l’objet d’un rapprochement manuel avant une migration.

### 7.5 Comptage, stands, fiches de caisse et banque

Les stands et les fiches de caisse utilisent notamment `src/lib/standOperations.ts`, `src/lib/compteurBrioches.ts`, `src/pages/FichesCaisse.tsx`, `src/pages/Coffre.tsx` et les pages de suivi bancaire. L’objectif est de rapprocher :

1. Les quantités sorties et remises.
2. Les compteurs / fiches des stands.
3. Les espèces, chèques, TPE et autres règlements constatés.
4. Les remises au coffre et en banque.
5. Les éventuels écarts, justifiés plutôt que masqués.

**Ne pas déduire automatiquement qu’une brioche remise correspond à un montant encaissé fixe** : les dons sans contrepartie, les paiements différés et les paiements partiels rendent ces notions distinctes.

## 8. Données, stockage et campagnes

### 8.1 Stockage actuel

**`localStorage`** : utilisé par les contextes et services pour de nombreux référentiels et événements métier (utilisateurs, campagnes, commandes, stocks, dons, suivi financier, chat, matériel, etc.).  
**`sessionStorage`** : notamment pour la session locale d’authentification.  
**`IndexedDB`** : utilisé pour certains fichiers ou collections, entre autres pièces jointes du chat, modèles Word, documents, écoles et registres de chèques.

Exemples de clés vérifiées :

| Données | Clé / mécanisme |
| --- | --- |
| Utilisateurs | `ob-users-v1` |
| Identifiants locaux | `ob2026-local-credentials-v1` |
| Session | `ob2026-auth-session-v1` (`sessionStorage`) |
| Campagne sélectionnée | `ob-campagne-selection-v1` |
| Stocks 2026 | `ob2026-stock-brioches-demo-v1` |
| Dons établissements 2026 | `ob2026-demo-dons-contrepartie-v1` |
| Commandes établissements | `ob-<année>-commandes-etablissements-v1` |
| Chat (messages) | `ob-chat-message-v1:` + identifiant |
| Chat (groupes) | `ob-chat-group-v1:` + identifiant |
| Pièces jointes du chat | Base IndexedDB `ob-chat-attachments-v1` |
| Modèles de convention | Base IndexedDB `ob-conventions-documents-v1` |

Cette liste **n’est pas exhaustive**. Pour une migration, faire d’abord un inventaire technique complet des clés, des versions de format et des relations entre enregistrements.

### 8.2 Conséquences du stockage navigateur

- Deux postes ne partagent pas automatiquement leurs données.
- L’effacement des données du site peut supprimer des informations qui n’ont pas été exportées.
- Les écritures sur plusieurs clés ne sont pas atomiques entre navigateurs.
- Les permissions front-end ne protègent pas une base centrale.
- Les pièces jointes enregistrées dans IndexedDB ne sont pas automatiquement sauvegardées par un simple export JSON de `localStorage`.

**Avant toute intervention ou migration :** réaliser une sauvegarde contrôlée des données du navigateur de référence **et** des fichiers IndexedDB pertinents, selon une procédure validée par la DSI. Ne pas vider les caches / stockages pour « réparer » une anomalie sans sauvegarde.

### 8.3 Campagnes

La campagne active est portée par `ObDataProvider` ; la lecture seule des campagnes non actives est calculée dans `src/lib/campaignAccess.ts` et appliquée dans `AppLayout` avec des exceptions de rubriques transversales (BDD, administration, fournisseurs, connexion).

Les clés de stocks et de commandes établissement sont en partie dérivées de **l’année extraite** de l’identifiant de campagne (`stockCampaignYear`). **Deux campagnes distinctes partageant la même année pourraient entrer en collision** : la DSI doit décider d’une clé fondée sur l’identifiant de campagne complet, puis documenter la migration si ce cas est possible.

## 9. Utilisateurs, rôles et sécurité

### 9.1 Rôles présents dans le modèle

Fichier : `src/contexts/UsersContext.tsx`.

- Administrateur.
- Communication.
- Comptabilité.
- Établissement.
- Coordinateur terrain.
- Direction.
- Stagiaire Communication.
- Stagiaire Comptabilité.
- Développeur.

Le modèle inclut le périmètre d’établissement, le pôle et une notion de responsable de pôle. Les permissions sont associées aux routes et aux actions (voir `src/security/`, `src/components/PermissionGate.tsx`, `src/contexts/PermissionsProvider.tsx`).

### 9.2 Situation actuelle : prototype local

L’authentification existante utilise un hachage de mot de passe par **PBKDF2** côté navigateur et stocke les informations correspondantes localement. Elle gère également un **profil administrateur de démonstration** identifié dans le code. **C’est un mécanisme de prototype, pas un système d’authentification adapté à une production partagée.**

### 9.3 Exigences avant tout accès réel multi-utilisateurs

- Authentification centralisée de l’AEIM (solution retenue par la DSI ; SSO Microsoft Entra ID envisageable **mais non implémenté dans les sources remises**).
- Contrôle des droits côté serveur pour **chaque** lecture, création, modification, suppression et export.
- Filtrage serveur des périmètres d’établissement et des campagnes autorisées.
- Journaux d’accès et d’événements sensibles stockés côté serveur, avec conservation adaptée.
- Protection des pièces jointes et des exports, TLS/HTTPS, gestion de session et des erreurs.
- Politique de sauvegarde, restauration, archivage et durée de conservation des données.
- Vérification des données personnelles et procédures internes de conformité (RGPD / règles AEIM).
- Aucun secret, mot de passe ou jeton privilégié dans le bundle React.

Le filtre français/anglais de la messagerie constitue une aide d’interface, **pas une protection inviolable** : les règles de modération et les signalements devront être contrôlés et traités côté serveur.

## 10. Documents et intégrations externes

### 10.1 Exports, PDF et OCR

Les services génèrent notamment des **bons de commande d’établissement** (`etablissementsCommandesPdf.ts`), documents d’écoles (`ecolesPdf.ts`, `ecolesTemplate.ts`), justificatifs et autres PDF. L’import/export Excel utilise `exceljs` sur plusieurs écrans. Les parcours OCR s’appuient sur `tesseract.js`, `pdfjs-dist` ou PDFium selon la page.

La fiabilité de l’OCR doit être **contrôlée humainement** pour des documents comptables ou des chèques ; la sortie OCR ne constitue pas une preuve ni une validation automatique.

### 10.2 Courriel Microsoft 365 / Outlook

Fichier : `src/services/justificatifMailWorkflow.ts`.

- Le frontend prépare une demande d’envoi avec justificatif PDF.
- L’option `VITE_OB_MICROSOFT_MAIL_ENABLED` commande l’activation de l’interface.
- Le service appelle `POST /api/justificatifs/send` avec authentification attendue du backend.
- Ce backend doit contrôler droits et destinataires, journaliser et appeler Microsoft Graph avec ses propres secrets.
- La réponse « accepté par Microsoft » ne prouve **pas** la livraison dans la boîte du destinataire.

**Le backend de cet endpoint n’est pas présent dans l’archive `src/`.** Il faut le fournir, le sécuriser et le tester avant d’activer cette fonctionnalité.

### 10.3 Cartographie et services externes

La cartographie utilise MapLibre ; `src/services/geocodage.ts` appelle notamment `data.geopf.fr` et `geo.api.gouv.fr`. La page de carte charge également des ressources GeoJSON externes. Certains moteurs de lecture PDF peuvent télécharger des ressources WASM.

En environnement AEIM, vérifier : disponibilité des domaines, filtrage réseau, disponibilité hors ligne, politique de confidentialité, performance et mécanisme de secours en cas de coupure.

## 11. Journal d’activité et traçabilité

- Le point d’entrée `src/main.tsx` lance `installAutomaticAudit()` avant le rendu React.
- `src/services/automaticAudit.ts` intercepte certaines écritures locales pour tracer un événement **sans stocker les valeurs métier** dans cet événement automatique.
- `src/services/activityLog.ts` et `auditPersistence.ts` gèrent des éléments de journalisation applicative.

**Limite :** ce dispositif de navigateur n’est pas un journal d’audit central, inaltérable ou inter-postes. Pour la production, les événements métier critiques doivent être consignés côté serveur : qui a fait quoi, sur quelle campagne, quand, avec la référence du document et, si pertinent, le motif de correction.

Pour les stocks et les paiements, privilégier des **mouvements de correction tracés** plutôt qu’un écrasement silencieux de l’historique.

## 12. Tests et recette

### 12.1 Éléments déjà vérifiés lors des audits précédents

- **Audit initial (25/11)** : 7 scénarios ciblés sur les commandes établissements réussis.
- **Audit stocks (25/11)** : 23 contrôles ciblés sur les stocks + 7 tests de régression commandes réussis.
- **Compilation** : dans l’environnement d’audit, après les corrections ciblées, aucune nouvelle erreur TypeScript dans les fichiers concernés ; `docxtemplater` et `pizzip` restaient à vérifier dans la configuration réelle.

Ces contrôles sont des tests ciblés sur copies de code et/ou assertions statiques. Ils **ne remplacent pas** les tests avec la configuration complète, un navigateur et des comptes réels de test.

### 12.2 Checklist de recette fonctionnelle

- [ ] Connexion, déconnexion, changement de mot de passe et compte inactif.
- [ ] Chaque rôle : affichage, ouverture directe d’une URL, création, modification, suppression et export.
- [ ] Campagnes 2025 / 2026 / test : aucune écriture sur la mauvaise campagne ; campagne close réellement non modifiable sauf exception autorisée.
- [ ] Création / confirmation / réception **Artisans, GMS, Industriels** : une seule réception physique, dans la bonne campagne.
- [ ] Livraison partielle à deux établissements ; refus des quantités négatives et des sorties impossibles.
- [ ] Transfert de stock entre établissements : bilan global inchangé.
- [ ] Don direct avec contrepartie : sortie de brioches et encaissement cohérents.
- [ ] Don sans contrepartie : encaissement sans sortie de stock.
- [ ] Création d’un bon établissement : ni sortie de stock ni encaissement artificiel.
- [ ] Remise partielle d’un bon ; refus d’une remise supérieure au reste ou au stock.
- [ ] Règlement partiel ; refus d’un paiement supérieur au solde.
- [ ] Commande réglée mais non remise : **réglée** oui, **terminée** non.
- [ ] Récapitulatif global : comparer le détail de chaque établissement, les non-attribués et les totaux.
- [ ] Stands et compteurs : ouvertures, clôtures, fiches de caisse, pièces jointes et rapprochements.
- [ ] Coffre, chèques, banque : absence de double comptage.
- [ ] Écoles : commandes et PDF, import / contrôle des retours.
- [ ] Chat : groupe, entrée/sortie de membres, pièces jointes, lecture, modération, édition, suppression et signalements.
- [ ] Import/export Excel : colonnes, montants, doublons, caractère réversible des opérations.
- [ ] PDF / Word : génération, ouverture, lisibilité et compatibilité des modèles.
- [ ] Test de rafraîchissement / reprise de session sans perte de données de test.
- [ ] Tests clavier, contrastes et affichage sur différents écrans (le responsive complet reste un chantier distinct).

### 12.3 Tests techniques à mettre en place

- Tests unitaires de règles métier (stock, commandes, rapprochements, campagnes, permissions).
- Tests d’intégration des mutations et compensations de stockage ; puis transactions serveur.
- Tests E2E des parcours prioritaires sous navigateur.
- Analyse de dépendances, tests de sécurité, contrôles d’accès et non-régression.
- Recette sur **jeu de données anonymisé**, pas sur données réelles en production.

## 13. Travaux à réaliser avant déploiement

Les éléments ci-dessous sont des **recommandations d’architecture**, pas des composants déjà présents dans l’archive.

### P0 — Préparer un référentiel complet du projet

- Récupérer la racine React/Vite, son lockfile, les configurations et un dépôt Git de référence.
- Vérifier la compilation complète et la compatibilité Node / dépendances.
- Consolider les correctifs appliqués en une **version identifiée**, au lieu d’empiler des ZIP.
- Définir des environnements distincts : développement, préproduction et production.

### P1 — Mettre les données et les règles métier côté serveur

- Choisir et déployer un backend et une base de données gérés par la DSI.
- Définir les entités : campagnes, établissements, utilisateurs, dons, commandes, remises, règlements, mouvements de stock, stands, caisses, documents, chats.
- Rendre les remises/encaissements **atomiques** et leurs opérations **idempotentes** (référence d’événement unique), avec verrouillage ou contrôle de version pour les accès simultanés.
- Garantir les contraintes d’intégrité : impossibilité de stock négatif, de remise supérieure au restant, de paiement supérieur au solde, et de réception fournisseur dupliquée.
- Revoir les identifiants de campagne pour éviter les collisions par année.
- Prévoir une procédure de rapprochement des éventuels doublons historiques **avant** migration.

### P1 — Sécuriser les accès et documents

- Authentification et autorisation **côté serveur**, y compris pour le chat et les téléchargements.
- Gestion des secrets et paramètres par environnement.
- Journal d’audit central, sauvegardes vérifiées, restauration testée et politique de conservation.
- Protection et contrôles antivirus / type / taille des documents téléversés.
- Vérification des règles de confidentialité et de conservation par les services compétents.

### P2 — Intégrations et exploitation

- Installer/tester l’API d’envoi de justificatifs Microsoft 365.
- Centraliser les documents et pièces jointes.
- Réaliser les tests inter-postes et de montée en charge raisonnable.
- Ajouter la supervision, un système de remontée d’erreurs et une procédure de support.
- Effectuer une recette métier avec Communication, Comptabilité et établissements pilotes.

### P3 — Responsive mobile, après stabilisation

- Adapter navigation, tableaux, formulaires et actions tactiles dans une seule base React.
- Donner la priorité aux opérations terrain : stands, compteur, dons, livraisons, stock et chat.
- Tester les autorisations et l’ergonomie sur téléphone et tablette.
- Étudier une PWA seulement si utile, **après** la sécurisation du service et de ses données.

## 14. Exploitation et dépannage

### La page reste blanche / le chat ne démarre pas

1. Ouvrir les outils développeur et relever **la première erreur** de console.
2. Vérifier la version consolidée des fichiers réellement installés.
3. Vérifier les imports manquants, la compilation et les dépendances.
4. Tester avec une sauvegarde des données locales ; **ne pas effacer le stockage immédiatement**.

### Un montant ou un stock semble faux

1. Identifier la campagne et l’établissement concernés.
2. Reconstituer les mouvements par document source (commande, réception, remise, règlement).
3. Vérifier qu’il n’existe pas deux écritures pour un même événement.
4. Vérifier les anciennes réceptions fournisseurs et les clés par campagne.
5. Corriger par une opération documentée et autorisée ; ne pas supprimer directement un mouvement automatique lié à une commande.

### Une fonction documentaire échoue

- Vérifier les versions de `docxtemplater` / `pizzip` et les autres bibliothèques dans le vrai `package.json`.
- Vérifier IndexedDB, l’espace disponible et l’intégrité des fichiers.
- Pour l’email, contrôler la configuration, l’API backend et l’acceptation Microsoft.
- Pour l’OCR ou la carte, vérifier le chargement des ressources externes et les restrictions réseau.

### Sauvegarde et restauration

En phase prototype, la sauvegarde du **seul** dossier `src/` ne suffit pas à préserver les données du navigateur. Une copie d’un ZIP de code ne remplace pas une sauvegarde de `localStorage` et d’IndexedDB. En production, sauvegardes automatiques, restauration testée, rétention et contrôle des accès doivent être définis et exploités par la DSI.

## 15. Historique des corrections et évolution

| Date | Sujet | Références |
| --- | --- | --- |
| 25/11/2026 | Audit initial : imports d’une ancienne copie du Dashboard et typage d’aperçu de thème | `Audit_Initial_Operation_Brioche_2026-11-25.md`, correctif initial distinct |
| 25/11/2026 | Commandes établissements et PDF, historique des opérations, ergonomie et récapitulatif global | Modules correspondants visibles dans l’archive source utilisée |
| 25/11/2026 | Chat : groupes, lecture, modération, signalements et actions | Composants `Chat*`, services `chat*` visibles dans l’archive source |
| 25/11/2026 | Audit stocks : prévention des doublons, campagne correcte, livraison industrielle effective | `Operation_Brioche_Correctif_Stocks_Campagnes_Doublons_2026-11-25.zip` — **correctif distribué séparément, installation à confirmer dans la version consolidée** |
| 26/11/2026 | Création de ce README technique | Basé sur l’archive de code du 25/11 et les rapports d’audit disponibles |

### Informations à compléter lors de la passation à la DSI

- **Dépôt Git et branche de référence :** à renseigner.
- **Version / tag de livraison :** à renseigner après consolidation.
- **Node.js, package manager et scripts de build :** à compléter depuis le `package.json` réel.
- **Responsable technique / référent métier :** à désigner et documenter dans les supports internes.
- **Environnements et URL de préproduction / production :** à renseigner.
- **Base de données / backend / stockage des documents :** à choisir ou documenter après validation DSI.
- **Gestion des secrets, sauvegardes et supervision :** à définir.
- **Procédure de migration des historiques locaux :** à préparer et tester.
- **Résultats de la recette complète et décision de mise en production :** à documenter.

---

**En synthèse :** Opération Brioche dispose d’un périmètre fonctionnel large et d’une interface métier structurée. Le travail prioritaire avant ouverture aux équipes consiste à **consolider le code**, **centraliser les données**, **imposer les permissions côté serveur**, **fiabiliser les transactions stock/finances** et **effectuer une recette complète**. Le responsive mobile vient ensuite, sur ce socle stabilisé.
