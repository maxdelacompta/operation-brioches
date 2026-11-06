import { FinanceRegister } from '../components/FinanceRegister'
import { useObData } from '../contexts/ObDataContext'
import './TableauxComplementaires.css'

export default function Mecenat() {
  const { selectedCampagne } = useObData()
  return <FinanceRegister key={`mecenat-${selectedCampagne?.id ?? 'aucune'}`} kind="mecenat" />
}
