import type { Donateur } from '../types/ob'

export const initialDonateurs: Donateur[] = [
  {
    id: 139,
    code: '139',
    type: 'ENTREPRISE',
    nom: 'SCEA HARAUX',

    numeroVoie: '34',
    adresse: 'VAYRINGE',
    cp: '54000',
    ville: 'NANCY',

    contactNom: 'HARAUX',
    contactPrenom: 'FRANCIS',

    email:
      'FRANCIS.HARAUX@WANADOO.FR',

    telephone:
      '06 87 89 95 74',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 136,
    code: '136',
    type: 'ENTREPRISE',
    nom: 'OPCO SANTE',

    numeroVoie: '2',
    adresse:
      'RUE JACQUES VILLERMAUX',

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'FELLRATH',
    contactPrenom: 'FREDERIC',

    email:
      'LAURENCE.GIRARD@OPCO-SANTE.FR',

    telephone:
      '03 90 22 22 39',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 218,
    code: '218',
    type: 'MAIRIE',
    nom: 'MAIRIE DE BRULEY',

    numeroVoie: '36',
    adresse:
      'RUE VICTOR HUGO',

    cp: '54200',
    ville: 'BRULEY',

    contactNom: 'BUGNET',
    contactPrenom: 'MIREILLE',

    email:
      'COMMUNE.DE.BRULEY@ORANGE.FR',

    conditionReglement:
      'JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',

    archive: false,
  },

  {
    id: 124,
    code: '124',
    type: 'ENTREPRISE',
    nom:
      'HOTEL IBIS STYLES NANCY CENTRE GARE',

    numeroVoie: '3',
    adresse:
      "RUE DE L'ARMEE PATTON",

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'GIRARD',
    contactPrenom: 'CHARLES',

    email:
      'charles.girard@groupesphb.fr',

    telephone:
      '06 60 44 93 36',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 300,
    code: '300',
    type: 'ENTREPRISE',
    nom: 'ENTREPRISE MARTIN',

    adresse:
      'RUE DE LA GARE',

    cp: '54520',
    ville: 'LAXOU',

    contactNom: 'MARTIN',
    contactPrenom: 'PIERRE',

    email:
      'contact@martin.fr',

    telephone:
      '03 83 00 00 01',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'CHEQUE',

    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 301,
    code: '301',
    type: 'MAIRIE',
    nom: 'MAIRIE DE VILLERS',

    adresse:
      'PLACE DE LA MAIRIE',

    cp: '54600',
    ville:
      'VILLERS-LES-NANCY',

    contactNom: 'DUPONT',
    contactPrenom: 'MARIE',

    email:
      'mairie@villers.fr',

    telephone:
      '03 83 00 00 02',

    conditionReglement:
      'MANDAT ADMINISTRATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'OUI',

    archive: false,
  },

  {
    id: 302,
    code: '302',
    type: 'ENTREPRISE',
    nom: 'PHARMACIE DU PARC',

    adresse:
      'AVENUE DU PARC',

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'BERNARD',
    contactPrenom: 'SOPHIE',

    email:
      'contact@pharmacieduparc.fr',

    telephone:
      '03 83 00 00 03',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'ESPECES',

    jdi: 'NON',
    jdp: 'NON',
    rf: 'NON',

    archive: false,
  },

  {
    id: 222,
    code: '222',
    type: 'ENTREPRISE',
    nom: 'MEUBLE FOISSEY',

    cp: '54000',
    ville: 'NANCY',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },
]