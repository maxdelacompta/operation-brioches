import type { Commande } from '../types/ob'

export const initialCommandes: Commande[] = [
  {
    id: 1,
    numero: 'CMD-2026-0001',
    donateurId: 139,
    campagne: 'OB 2026',
    dateCommande: '2026-09-15',
    quantite: 50,
    prixUnitaire: 5,
    statut: 'CONFIRMEE',
    conditionReglement:
      'À RÉCEPTION',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
    datePrevueLivraison:
      '2026-09-22',
    remarque:
      'Très bon partenaire, à recontacter l’année prochaine.',
  },

  {
    id: 2,
    numero: 'CMD-2026-0002',
    donateurId: 300,
    campagne: 'OB 2026',
    dateCommande: '2026-09-15',
    quantite: 30,
    prixUnitaire: 5,
    statut: 'A_LIVRER',
    conditionReglement:
      'À RÉCEPTION',
    modeReglement:
      'CHEQUE',
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 3,
    numero: 'CMD-2026-0003',
    donateurId: 301,
    campagne: 'OB 2026',
    dateCommande: '2026-09-15',
    quantite: 100,
    prixUnitaire: 5,
    statut: 'CONFIRMEE',
    conditionReglement:
      'MANDAT ADMINISTRATIF',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'NON',
    rf: 'OUI',
  },

  {
    id: 4,
    numero: 'CMD-2026-0004',
    donateurId: 302,
    campagne: 'OB 2026',
    dateCommande: '2026-09-15',
    quantite: 20,
    prixUnitaire: 5,
    statut: 'BROUILLON',
    conditionReglement:
      'À RÉCEPTION',
    modeReglement:
      'ESPECES',
    jdi: 'NON',
    jdp: 'NON',
    rf: 'NON',
  },

  {
    id: 5,
    numero: 'CMD-2026-0005',
    donateurId: 124,
    campagne: 'OB 2026',
    dateCommande: '2026-09-16',
    quantite: 40,
    prixUnitaire: 5,
    statut: 'CONFIRMEE',
    conditionReglement:
      'SUR JUSTIFICATIF',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 6,
    numero: 'CMD-2026-0006',
    donateurId: 136,
    campagne: 'OB 2026',
    dateCommande: '2026-09-16',
    quantite: 60,
    prixUnitaire: 5,
    statut: 'A_LIVRER',
    conditionReglement:
      'SUR JUSTIFICATIF',
    modeReglement:
      'CHEQUE',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 7,
    numero: 'CMD-2026-0007',
    donateurId: 218,
    campagne: 'OB 2026',
    dateCommande: '2026-09-16',
    quantite: 70,
    prixUnitaire: 5,
    statut: 'BROUILLON',
    conditionReglement:
      'JUSTIFICATIF',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',
  },

  /* Démo pour MEUBLE FOISSEY */
  {
    id: 8,
    numero: 'CMD-2026-0008',
    donateurId: 222,
    campagne: 'OB 2026',
    dateCommande: '2026-09-17',
    quantite: 60,
    prixUnitaire: 5,
    statut: 'CONFIRMEE',
    conditionReglement:
      'À RÉCEPTION',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 9,
    numero: 'CMD-2026-0009',
    donateurId: 222,
    campagne: 'OB 2026',
    dateCommande: '2026-09-19',
    quantite: 40,
    prixUnitaire: 5,
    statut: 'A_LIVRER',
    conditionReglement:
      'À RÉCEPTION',
    modeReglement:
      'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },
]