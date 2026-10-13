import { Link } from 'react-router-dom'
import { Database, Users, Landmark, HandHeart, ArrowRight } from 'lucide-react'
import { useAccess } from '../lib/useAccess'
import './Bdd.css'

const databases = [
  { label: 'Donateurs', url: '/bdd/donateurs', icon: Users, description: 'Consulter et gérer les donateurs.' },
  { label: 'Mairies', url: '/bdd/mairies', icon: Landmark, description: 'Retrouver les communes et mairies partenaires.' },
  { label: 'Bénévoles', url: '/bdd/benevoles', icon: HandHeart, description: 'Gérer les bénévoles et leurs rattachements.' },
]
export default function Bdd() {
  const { canVisit } = useAccess()
  return <div className="ob-bdd-page"><div className="ob-bdd-eyebrow"><Database size={18}/> GESTION DES DONNÉES</div><h1>Bases de données</h1><p>Accédez à vos référentiels depuis un seul espace.</p><div className="ob-bdd-grid">{databases.filter(db => canVisit(db.url)).map(db => { const Icon = db.icon; return <Link key={db.url} className="ob-bdd-card" to={db.url}><Icon size={26}/><h2>{db.label}</h2><p>{db.description}</p><span>Ouvrir la base <ArrowRight size={16}/></span></Link> })}</div></div>
}
