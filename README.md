# Embassy Pass 🎫

Embassy Pass est une application moderne de gestion d'événements et de contrôle d'accès, conçue spécifiquement pour la gestion des invitations et des entrées. Elle permet de générer des invitations sécurisées, de scanner des QR codes pour l'enregistrement (check-in) et de gérer les données des invités (y compris les numéros de passeport) via une interface d'administration.

## 🚀 Fonctionnalités Principales

- **Gestion des Invitations :** Création, modification et suppression des invités.
- **Contrôle d'Accès par QR Code :** Génération de QR codes uniques pour chaque invité et scanner intégré pour un contrôle rapide à l'entrée.
- **Suivi des Présences :** Enregistrement des types de check-in et suivi en temps réel des accès.
- **Export et Rapports :** Génération de documents PDF et visualisation de statistiques.
- **Authentification & Sécurité :** Gestion sécurisée des sessions avec Supabase.
- **Interface Réactive :** Design moderne et accessible utilisant Tailwind CSS et shadcn/ui.

## 🛠️ Technologies Utilisées

- **Frontend :** [React](https://reactjs.org/) (v18), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **UI & Style :** [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix UI), [Lucide React](https://lucide.dev/)
- **Backend & Base de données :** [Supabase](https://supabase.com/) (PostgreSQL, Authentification, Edge Functions)
- **Scan QR :** `@yudiel/react-qr-scanner`, `qrcode`
- **Utilitaires :** `react-hook-form`, `zod`, `recharts`, `date-fns`, `jspdf`

## 📦 Installation et Lancement

### Prérequis

- [Node.js](https://nodejs.org/) (version 18+ recommandée)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Un compte et un projet [Supabase](https://supabase.com/)

### Étapes d'installation

1. **Cloner le dépôt :**
   ```bash
   git clone <URL_DU_DEPOT>
   cd embassy-pass
   ```

2. **Installer les dépendances :**
   ```bash
   npm install
   ```

3. **Configuration de l'environnement :**
   Créez un fichier `.env` à la racine du projet et ajoutez vos clés publiques Supabase :
   ```env
   VITE_SUPABASE_URL=votre_url_supabase
   VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
   ```

4. **Lancer le serveur de développement :**
   ```bash
   npm run dev
   ```
   L'application sera accessible sur `http://localhost:5173`.

## 📜 Scripts Disponibles

- `npm run dev` : Lance le serveur de développement avec rechargement à chaud.
- `npm run build` : Compile l'application pour la production.
- `npm run preview` : Permet de prévisualiser la version de production en local.
- `npm run lint` : Vérifie le code avec ESLint.
- `npm run test` : Lance les tests avec Vitest.
- `npm run deploy` : Déploie l'application sur GitHub Pages (`gh-pages`).

## 🗄️ Structure du projet

- `/src`: Code source de l'application React.
  - `/pages`: Composants principaux correspondant aux différentes vues (ex: `Scan.tsx`).
  - `/components`: Composants réutilisables de l'interface utilisateur.
- `/supabase`: Configuration et scripts Supabase.
  - `/migrations`: Fichiers SQL pour la structure de la base de données.
  - `/functions`: Fonctions *Serverless* (Edge Functions).
- `/public`: Fichiers statiques et assets globaux.

## 🤝 Contribution

Les contributions, les signalements de bugs et les demandes de fonctionnalités sont les bienvenus pour améliorer ce projet !
