import { Store, CalendarDays, Users, Landmark, Plus } from 'lucide-react'
import './StandsBrioches.css'

export default function StandsBrioches() {
  return (
    <div className="ob-stand-page">
      <div className="ob-stand-heading">
        <div><div className="ob-stand-overline">GESTION · OPÉRATION BRIOCHES</div><h1>Stands Brioches</h1><p>Planification et suivi des stands de l'opération.</p></div>
        <button type="button" disabled title="La création des stands sera disponible dans la prochaine étape"><Plus size={18}/> Nouveau stand</button>
      </div>
      <div className="ob-stand-stats">
        <div><Store size={23}/><strong>0</strong><span>Stands enregistrés</span></div>
        <div><CalendarDays size={23}/><strong>0</strong><span>Créneaux planifiés</span></div>
        <div><Users size={23}/><strong>0</strong><span>Bénévoles affectés</span></div>
      </div>
      <section className="ob-stand-empty"><Store size={38}/><h2>Vos stands apparaîtront ici</h2><p>Ce module est indépendant des bases de données. Il pourra être relié aux bénévoles et aux mairies lors du développement du planning.</p><div><span><Users size={16}/> BDD Bénévoles</span><span><Landmark size={16}/> BDD Mairies</span></div></section>
    </div>
  )
}
