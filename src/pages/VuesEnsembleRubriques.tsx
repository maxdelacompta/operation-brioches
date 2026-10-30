import { Link, useParams } from 'react-router-dom'
import { ArrowRight, LayoutGrid } from 'lucide-react'
import { useAccess } from '../lib/useAccess'
import './VuesEnsembleRubriques.css'

const sections: Array<{id:string;title:string;description:string;links:Array<{label:string;to:string}>}> = [
  { id: "gestion", title: "Gestion", description: "Retrouvez les outils de pilotage quotidien.", links: [{"label": "Tableau de bord", "to": "/dashboard"}, {"label": "Suivi caisse et TPE", "to": "/gestion/suivi-caisse-tpe"}, {"label": "Stands Brioches", "to": "/gestion/stands-brioches"}] },
  { id: "bdd", title: "BDD", description: "Consultez et gérez vos référentiels.", links: [{"label": "Donateurs", "to": "/bdd/donateurs"}, {"label": "Mairies", "to": "/bdd/mairies"}, {"label": "Bénévoles", "to": "/bdd/benevoles"}] },
  { id: "commandes-dons", title: "Commandes dons", description: "Suivez les commandes et les distributions.", links: [{"label": "Commandes entreprises", "to": "/commandes"}, {"label": "Livraisons / Retraits", "to": "/commandes/livraisons-retraits"}, {"label": "Suivi global entreprises", "to": "/commandes/suivi-global-entreprises"}, {"label": "Commandes Mairies & RS", "to": "/commandes/mairies-rs"}] },
  { id: "commandes-achats", title: "Commandes achats", description: "Pilotez les fournisseurs, achats et livraisons.", links: [{"label": "Suivi global achats", "to": "/commandes-achats/suivi-global"}, {"label": "Fournisseurs", "to": "/commandes-achats/fournisseurs"}, {"label": "Artisans", "to": "/commandes-achats/artisans"}, {"label": "GMS", "to": "/commandes-achats/gms"}, {"label": "Industriels", "to": "/commandes-achats/industriels"}] },
  { id: "etablissements", title: "Établissements", description: "Suivez les brioches et les stocks des établissements.", links: [{"label": "Stock Brioches", "to": "/etablissements/stock-brioches"}, {"label": "Suivi Brioches", "to": "/etablissements/suivi-brioches"}, {"label": "Récap global", "to": "/etablissements/recap-global"}] },
  { id: "dons-percus", title: "Dons perçus", description: "Suivez les encaissements et remises.", links: [{"label": "Fiches de caisse", "to": "/encaissements/fiches-caisse"}, {"label": "Coffre", "to": "/encaissements/coffre"}, {"label": "Gestion des chèques", "to": "/encaissements/gestion-cheques"}, {"label": "Suivi banque", "to": "/encaissements/suivi-banque"}, {"label": "Récapitulatif global", "to": "/encaissements/recapitulatif-global"}] },
  { id: "finance", title: "Documents", description: "Retrouvez les documents et justificatifs de campagne.", links: [{"label": "Vue comptable", "to": "/comptabilite"}, {"label": "Factures & Paiements", "to": "/finance/factures-paiements"}, {"label": "Justificatifs de dons", "to": "/finance/justificatifs-dons"}, {"label": "Mécénat", "to": "/finance/mecenat"}, {"label": "Pertes / Écarts", "to": "/finance/pertes-ecarts"}] }
]

export default function VuesEnsembleRubriques() {
  const { rubrique } = useParams<{rubrique: string}>()
  const { canVisit } = useAccess()
  const section = sections.find(item => item.id === rubrique)
  if (!section) return <div className="ob-rubrique-overview"><h1>Rubrique introuvable</h1></div>
  const links = section.links.filter(item => canVisit(item.to))
  return (
    <main className="ob-rubrique-overview">
      <header className="ob-rubrique-overview__header">
        <div className="ob-rubrique-overview__symbol"><LayoutGrid size={25}/></div>
        <div><span className="ob-rubrique-overview__eyebrow">VUE D'ENSEMBLE</span><h1>{section.title}</h1><p>{section.description}</p></div>
      </header>
      <div className="ob-rubrique-overview__grid">
        {links.map(item => <Link key={item.to} to={item.to} className="ob-rubrique-overview__card">
          <span className="ob-rubrique-overview__icon"><LayoutGrid size={19}/></span>
          <span className="ob-rubrique-overview__label">{item.label}</span>
          <ArrowRight className="ob-rubrique-overview__arrow" size={18}/>
        </Link>)}
      </div>
      {links.length === 0 && <p>Aucune page accessible avec vos autorisations actuelles.</p>}
    </main>
  )
}
