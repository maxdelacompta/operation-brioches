/**
 * Filtre local de premier niveau pour la messagerie interne.
 * Les règles sont volontairement ciblées : ne pas bloquer des mots comme
 * « conseil », « classe », « assistant », « Sussex » ou « cucumber ».
 * Ce filtre lexical ne remplace PAS une modération de contexte côté serveur.
 */

const FR_TERMS = [
  'putain', 'putains', 'merde', 'merdes', 'bordel',
  'connard', 'connards', 'connasse', 'connasses', 'con', 'cons', 'conne', 'connes',
  'enfoire', 'enfoires', 'enfoiree', 'enfoirees', 'encule', 'encules', 'enculee', 'enculees',
  'salope', 'salopes', 'salaud', 'salauds', 'pute', 'putes',
  'couillon', 'couillons', 'couillonne', 'couillonnes',
  'batard', 'batards', 'batarde', 'batardes',
  'foutre', 'nique', 'niquer', 'abruti', 'abrutis', 'abrutie', 'abruties',
  'imbecile', 'imbeciles', 'idiot', 'idiote', 'idiots', 'idiotes', 'debile', 'debiles', 'cretin', 'cretins', 'cretine', 'cretines',
  'ta gueule', 'ferme ta gueule', 'fils de pute', 'va te faire foutre',
  'nique ta mere', 'va chier',
  'bougnoule', 'bougnoules', 'negro', 'negros', 'negre', 'negres',
] as const

const EN_TERMS = [
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shitty', 'bullshit', 'horseshit',
  'asshole', 'assholes', 'arsehole', 'arseholes',
  'dumbass', 'jackass', 'dipshit', 'shithead', 'shitheads',
  'bitch', 'bitches', 'bastard', 'bastards',
  'wanker', 'wankers', 'twat', 'twats', 'cunt', 'cunts',
  'dickhead', 'dickheads', 'prick', 'pricks',
  'moron', 'morons', 'stupid', 'loser', 'losers', 'scumbag', 'scumbags',
  'nigger', 'niggers', 'faggot', 'faggots',
  'son of a bitch', 'piece of shit', 'shut the fuck up',
] as const

/** Substitution des variantes courantes, séparateurs et accents. */
export function normalizeForModeration(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const TERMS = [...FR_TERMS, ...EN_TERMS].map(normalizeForModeration)
const TERM_SET = new Set(TERMS)

function squashRepeats(value: string): string {
  return value.replace(/([a-z])\1+/g, '$1')
}

const NORMALIZED_TERMS = new Set([...TERM_SET].map(squashRepeats))

/** Regroupe les lettres espacées volontairement : f.u.c.k, p u t a i n. */
function expandSeparatedLetters(normalized: string): string {
  return normalized.replace(/(?:\b[a-z]\b\s+){2,}\b[a-z]\b/g, sequence => sequence.replace(/\s/g, ''))
}

export function containsInappropriateLanguage(input: string): boolean {
  const normalized = normalizeForModeration(input)
  if (!normalized) return false
  const candidateTexts = [normalized, expandSeparatedLetters(normalized)]
  for (const value of candidateTexts) {
    const words = value.split(' ')
    const squashed = words.map(squashRepeats)
    for (let i = 0; i < words.length; i++) {
      if (TERM_SET.has(words[i]) || NORMALIZED_TERMS.has(squashed[i])) return true
    }
    for (const term of TERMS) {
      if (!term.includes(' ')) continue
      if (` ${value} `.includes(` ${term} `)) return true
    }
  }
  // Abréviation grossière masquée utilisée seule ou entre ponctuations.
  if (/(?:^|[^a-z])f[\W_]*\*[\W_]*c[\W_]*k(?:$|[^a-z])/i.test(input)) return true
  return false
}

export type ModeratedChatContent = {
  poll?: { question: string; options: string[] }
  meeting?: { title: string; location?: string }
}

/** Texte visible dans un message, une réunion ou un sondage. */
export function shouldBlockChatContent(text: string, content?: ModeratedChatContent): boolean {
  if (containsInappropriateLanguage(text)) return true
  if (content?.poll && [content.poll.question, ...content.poll.options].some(containsInappropriateLanguage)) return true
  if (content?.meeting && [content.meeting.title, content.meeting.location ?? ''].some(containsInappropriateLanguage)) return true
  return false
}

export const CHAT_MODERATION_ERROR = 'Message non envoyé : une expression insultante ou grossière a été détectée (français/anglais). Modifie ton texte avant de réessayer.'
export const CHAT_GROUP_NAME_ERROR = 'Nom de groupe refusé : retire les expressions insultantes ou grossières.'
