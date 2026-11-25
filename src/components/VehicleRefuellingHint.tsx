import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Fuel, MapPin } from 'lucide-react'
import { type Asset } from '../services/communicationAssets'
import {
  energiesForVehicle, pointSupportsVehicle, readRefuellingPoints,
} from '../services/vehicleRefuelling'

/** Aide logistique non bloquante : les points sont renseignés manuellement par la Communication. */
export default function VehicleRefuellingHint({ vehicle }: { vehicle?: Asset }) {
  const [points, setPoints] = useState(readRefuellingPoints)
  useEffect(() => {
    const reload = () => setPoints(readRefuellingPoints())
    window.addEventListener('focus', reload)
    window.addEventListener('storage', reload)
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('storage', reload) }
  }, [])
  if (!vehicle) return null
  const knownEnergy = energiesForVehicle(vehicle.fuelType).length > 0
  const compatible = knownEnergy ? points.filter(point => point.active && pointSupportsVehicle(point, vehicle.fuelType)) : []
  return <aside className="lr-refuelling-hint">
    <strong><Fuel size={15}/> Ravitaillement / recharge — {vehicle.name}</strong>
    {!knownEnergy ? <p>Motorisation à préciser dans Gestion → Véhicules pour voir les points compatibles.</p>
      : compatible.length === 0 ? <p>Aucun point compatible renseigné pour ce véhicule.</p>
      : <ul>{compatible.slice(0, 3).map(point => <li key={point.id}>
          <MapPin size={13}/> <span><b>{point.name}</b> — {point.address}
            {point.access && <small> · {point.access}</small>}</span>
        </li>)}</ul>}
    {compatible.length > 3 && <p>{compatible.length - 3} autre(s) point(s) disponible(s) dans le Parc auto.</p>}
    <Link to="/gestion/vehicules">Voir tous les points de ravitaillement et recharge</Link>
  </aside>
}
