// La palette du site de design system, déclarée ici en paires texte/fond pour qu'un test
// la mesure. Le site s'impose 4,5:1 partout : il documente une dette de contraste, il ne
// l'imite pas (spec §6).
//
// Les noms sont ceux des variables `--ds-*` du `:root` de `../css/site.css`. Les valeurs
// restent là-bas, en un seul endroit : ce module dit quelles paires existent, pas de quelle
// couleur elles sont.
//
// `px` et `gras` sont la taille RÉELLE du texte à l'écran, pas une taille commode : c'est
// elle qui décide si WCAG autorise 3:1 au lieu de 4,5:1, et le site n'a aucune paire qui
// dépend de cette tolérance.

export const PAIRES = [
  // Le corps du site, posé sur blanc. `--ds-texte-secondaire` sur blanc donne 4,55:1 ;
  // sur `--bg-canvas` il tomberait à 4,13:1. C'est la raison pour laquelle le site est
  // blanc et non gris clair comme l'outil d'emprunt.
  { nom: 'Texte courant sur blanc', texte: '--ds-texte', fond: '--ds-fond', px: 16, gras: false },
  { nom: 'Texte secondaire sur blanc', texte: '--ds-texte-secondaire', fond: '--ds-fond', px: 16, gras: false },
  { nom: 'Étiquette en capitales sur blanc', texte: '--ds-texte-secondaire', fond: '--ds-fond', px: 11, gras: true },
  { nom: 'Lien sur blanc', texte: '--ds-lien', fond: '--ds-fond', px: 16, gras: false },

  // Les aplats pastel. `--ds-fond-doux` est aussi le point le plus sombre du dégradé du
  // hero, qui ne va jamais au-delà : mesurer cette paire suffit à couvrir tout le dégradé.
  { nom: 'Texte courant sur aplat violet clair', texte: '--ds-texte', fond: '--ds-fond-doux', px: 16, gras: false },
  { nom: 'Lien sur aplat violet clair', texte: '--ds-lien', fond: '--ds-fond-doux', px: 16, gras: false },
  { nom: 'Texte courant sur aplat turquoise clair', texte: '--ds-texte', fond: '--ds-fond-frais', px: 16, gras: false },

  // Le seul aplat saturé du site : le violet plein, sous du blanc. Le survol compte aussi —
  // un bouton qu'on survole se lit encore.
  { nom: 'Texte sur aplat violet', texte: '--ds-texte-inverse', fond: '--ds-violet', px: 16, gras: false },
  { nom: 'Texte sur aplat violet survolé', texte: '--ds-texte-inverse', fond: '--ds-violet-fonce', px: 16, gras: false },
];
