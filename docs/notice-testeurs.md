# MDS Emprunts — notice pour les testeurs

## Ce que vous testez

Un **prototype** d’emprunt de matériel pour l’école. Rien n’est réel : ni vos saisies ni vos photos ne sont envoyées nulle part, tout reste dans le navigateur de votre téléphone.

## Comment y accéder

1. Ouvrez `https://<compte>.github.io/mds-emprunts/` dans le navigateur de votre téléphone, puis touchez **Interface mobile**.
2. Pour l’ouvrir comme une application, faites-le depuis cette page : dans le menu de votre navigateur, choisissez **Ajouter à l’écran d’accueil** (le libellé varie un peu selon le téléphone). Sur certains téléphones, l’application ainsi installée a ses propres données : ce que vous auriez emprunté depuis le navigateur n’y apparaîtra pas. Choisissez l’un ou l’autre et restez-y.

## Votre compte

Sur l’écran « Qui êtes-vous ? », choisissez un nom dans la liste : il n’y a pas de mot de passe. Le plus simple est **Camille Dubois** (tapez « Dubois » dans le champ de recherche). Les autres noms marchent aussi, mais certains peuvent être refusés — un exemplaire du même matériel déjà emprunté, ou un retard en cours. C’est voulu.

Chaque téléphone a ses propres données : **deux testeurs ne se voient pas l’un l’autre**.

## Ce qu’on vous demande de faire

Trois parcours courts, sans demander d’aide, puis répondez à la question de chacun.

1. **Emprunter un objet avec le QR code d’une étiquette.** Touchez **Scanner un QR code**, visez l’étiquette qu’on vous a remise, puis suivez l’écran jusqu’à la confirmation. Rendez-le ensuite de la même façon. *Avez-vous su quoi faire sans explication ?*
2. **Réserver un créneau de la salle photo.** Onglet **Salle** : touchez un ou plusieurs créneaux libres qui se suivent, puis **Réserver**. *Avez-vous compris quels créneaux étaient libres et lesquels étaient pris ?*
3. **Réserver un objet de valeur.** Onglet **Catalogue** : choisissez un objet marqué « Sur réservation », puis **Réserver** et **Confirmer la réservation**. *Avez-vous compris ce qui se passe ensuite et quand vous viendriez le récupérer ?*

## Ce qu’on veut savoir

- Qu’est-ce qui vous a fait hésiter, ou vous a surpris ?
- Qu’avez-vous cherché sans le trouver ?
- Qu’est-ce qui manque pour que vous l’utilisiez pour de vrai ?

## Si ça coince

- **La caméra demande une autorisation** : acceptez. Sans caméra, ou si vous refusez, l’écran **Scanner** propose de saisir le code imprimé sous le QR code (champ **Ou saisir un code**, puis **Valider le code**), et la photo peut être remplacée par une image de démonstration.
- **« Le bureau de la pédagogie est fermé… »** : le prototype applique les horaires du bureau, du lundi au vendredi de 8h à 12h et de 13h à 17h. En dehors, l’emprunt en self-service est refusé, et le week-end la salle photo n’offre que la semaine suivante. C’est voulu ; pour tester à toute heure, voir « Pour la pédagogie » ci-dessous (**Jour ouvré 9h**).
- **Pour repartir de zéro** : dans `admin.html` (voir ci-dessous), **Paramètres** puis **Régénérer les données**, ou supprimez les données du site dans les réglages de votre navigateur.

## Pour la pédagogie

Ajoutez `admin.html` à l’adresse (`https://<compte>.github.io/mds-emprunts/admin.html`) : l’interface de la pédagogie s’ouvre dans le navigateur du téléphone. Elle est conçue pour un ordinateur : l’affichage y est serré. Choisissez un nom dans « Qui êtes-vous ? » (par exemple **Alexis Bengel**).

Ouvrez-la dans le **même navigateur** que l’application, dans un second onglet : ce que fait l’un apparaît dans l’autre. Si les données diffèrent, c’est sans doute que l’icône de l’écran d’accueil garde ses propres données : ouvrez alors les deux pages dans le navigateur.

Depuis le **Tableau de bord**, **Jour ouvré 9h** place l’horloge de démonstration à 9h un jour ouvré, ce qui permet de tester le self-service le soir ou le week-end. L’horloge vaut pour tout le prototype sur ce téléphone ; **Temps réel** la remet à l’heure du téléphone.
