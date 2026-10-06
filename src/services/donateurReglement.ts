export type ModeReglementNormalise =
  | 'CHEQUE'
  | 'VIREMENT'
  | 'CHORUS'
  | 'INCONNU'

export type DonateurDocumentData = {
  id: string
  code?: string
  nom: string
  contactNom?: string
  contactPrenom?: string
  numeroVoie?: string
  adresse?: string
  cp?: string
  ville?: string
  email?: string
  telephone?: string
  modeReglement: ModeReglementNormalise
  siret?: string
  chorusNumeroEngagement?: string
  chorusCodeService?: string
  raw: Record<string, unknown>
}

function safeArrayFromStorage(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key)

    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}

function firstString(
  item: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = item[key]

    if (
      value === undefined ||
      value === null
    ) {
      continue
    }

    const text = String(value).trim()

    if (text) {
      return text
    }
  }

  return undefined
}

export function normalizeModeReglement(
  value: unknown,
): ModeReglementNormalise {
  const text = String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (text.includes('CHORUS')) {
    return 'CHORUS'
  }

  if (text.includes('VIREMENT')) {
    return 'VIREMENT'
  }

  if (text.includes('CHEQUE')) {
    return 'CHEQUE'
  }

  return 'INCONNU'
}

export function findDonateurForJustificatif(
  donateurId?: string,
  donateurCode?: string,
  donateurNom?: string,
): DonateurDocumentData | null {
  const source =
    safeArrayFromStorage('ob-donateurs')

  const match = source
    .map(
      (value) =>
        value as Record<string, unknown>,
    )
    .find((item) => {
      const id = String(item.id ?? '')
      const code = String(item.code ?? '')
      const nom = String(item.nom ?? '')
        .trim()
        .toLowerCase()

      return Boolean(
        (donateurId &&
          id === String(donateurId)) ||
          (donateurCode &&
            code === String(donateurCode)) ||
          (donateurNom &&
            nom &&
            nom ===
              donateurNom
                .trim()
                .toLowerCase()),
      )
    })

  if (!match) {
    return null
  }

  return {
    id: String(
      match.id ??
        match.code ??
        match.nom ??
        '',
    ),

    code: firstString(
      match,
      ['code'],
    ),

    nom:
      firstString(
        match,
        [
          'nom',
          'raisonSociale',
          'rs',
        ],
      ) || 'Donateur',

    contactNom: firstString(
      match,
      [
        'contactNom',
        'nomContact',
      ],
    ),

    contactPrenom: firstString(
      match,
      [
        'contactPrenom',
        'prenomContact',
        'contactPrénom',
      ],
    ),

    numeroVoie: firstString(
      match,
      [
        'numeroVoie',
        'numero',
        'numVoie',
      ],
    ),

    adresse: firstString(
      match,
      [
        'adresse',
        'voie',
        'adresse1',
      ],
    ),

    cp: firstString(
      match,
      [
        'cp',
        'codePostal',
      ],
    ),

    ville: firstString(
      match,
      ['ville'],
    ),

    email: firstString(
      match,
      [
        'email',
        'mail',
      ],
    ),

    telephone: firstString(
      match,
      [
        'telephone',
        'tel',
      ],
    ),

    modeReglement:
      normalizeModeReglement(
        firstString(
          match,
          [
            'modeReglement',
            'reglement',
            'modePaiement',
          ],
        ),
      ),

    // Ces informations appartiennent au donateur / organisme public.
    // Elles ne sont jamais configurées dans la campagne AEIM.
    siret: firstString(
      match,
      [
        'siret',
        'numeroSiret',
      ],
    ),

    chorusNumeroEngagement:
      firstString(
        match,
        [
          'chorusNumeroEngagement',
          'numeroEngagement',
          'numEngagement',
          'engagementJuridique',
        ],
      ),

    chorusCodeService:
      firstString(
        match,
        [
          'chorusCodeService',
          'codeService',
        ],
      ),

    raw: match,
  }
}

export function getMissingChorusFields(
  donateur: DonateurDocumentData,
): string[] {
  if (
    donateur.modeReglement !== 'CHORUS'
  ) {
    return []
  }

  const missing: string[] = []

  if (!donateur.siret?.trim()) {
    missing.push('SIRET')
  }

  if (
    !donateur.chorusNumeroEngagement?.trim()
  ) {
    missing.push("Numéro d'engagement")
  }

  if (
    !donateur.chorusCodeService?.trim()
  ) {
    missing.push('Code service')
  }

  return missing
}

export function updateDonateurChorusInfo(
  donorId: string,
  values: {
    siret: string
    chorusNumeroEngagement: string
    chorusCodeService: string
  },
) {
  const current =
    safeArrayFromStorage('ob-donateurs')

  let found = false

  const next = current.map((value) => {
    const item =
      value as Record<string, unknown>

    const id = String(
      item.id ??
        item.code ??
        '',
    )

    if (id !== donorId) {
      return value
    }

    found = true

    return {
      ...item,
      siret: values.siret.trim(),
      chorusNumeroEngagement:
        values.chorusNumeroEngagement.trim(),
      chorusCodeService:
        values.chorusCodeService.trim(),
      modeReglement: 'CHORUS',
    }
  })

  if (!found) {
    throw new Error(
      'Donateur introuvable dans la base de données.',
    )
  }

  localStorage.setItem(
    'ob-donateurs',
    JSON.stringify(next),
  )
}

export function createChorusMailDraft(
  donateur: DonateurDocumentData,
  campagne: string,
) {
  const contact = [
    donateur.contactPrenom,
    donateur.contactNom,
  ]
    .filter(Boolean)
    .join(' ')

  const year =
    campagne.match(/20\d{2}/)?.[0] ?? ''

  const missing =
    getMissingChorusFields(donateur)

  const missingList =
    missing.length > 0
      ? missing
          .map(
            (field) => `- ${field} ;`,
          )
          .join('\n')
      : [
          '- votre numéro de SIRET ;',
          "- votre numéro d'engagement ;",
          '- votre code service.',
        ].join('\n')

  const subject =
    `Informations nécessaires pour votre règlement via Chorus Pro - ${campagne}`

  const body = `Bonjour${
    contact ? ` ${contact}` : ''
  },

Dans le cadre de l'Opération Brioches${
    year ? ` ${year}` : ''
  }, nous préparons le justificatif correspondant à votre participation.

Afin de pouvoir finaliser le traitement via Chorus Pro, pourriez-vous nous communiquer les informations suivantes :

${missingList}

Vous pouvez simplement répondre à ce message avec ces éléments.

Nous vous remercions par avance.

Bien cordialement,

AEIM 54
Opération Brioches`

  return {
    to: donateur.email || '',
    subject,
    body,
  }
}
