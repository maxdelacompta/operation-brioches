import { FinanceRegister } from '../components/FinanceRegister'
import { useObData } from '../contexts/ObDataContext'
import './TableauxComplementaires.css'

export default function PertesEcarts() {
  const { selectedCampagne } = useObData()
  return <FinanceRegister key={`ecarts-${selectedCampagne?.id ?? 'aucune'}`} kind="ecarts" />
}
