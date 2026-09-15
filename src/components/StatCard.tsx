type StatCardProps = {
  title: string
  value: number
}

function StatCard({ title, value }: StatCardProps) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <p>{value.toLocaleString('fr-FR')}</p>
    </article>
  )
}

export default StatCard