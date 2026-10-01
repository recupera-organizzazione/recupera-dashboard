// Card demo esistente — NON toccare i numeri mock qui.
// La sostituzione con dati reali avviene in MetricGrid.jsx (KPI reali in testata).
// Ogni valore mock resta marcato demo via aria-label + classe.

export default function MetricCard({ metric }) {
  const trendClass =
    metric.type === 'pressure'
      ? 'warning'
      : metric.type === 'confirmation'
        ? 'neutral'
        : 'positive';

  return (
    <article
      className={`metric-card ${metric.type === 'emphasis' ? 'emphasis' : ''}`}
      aria-label={`${metric.label}: ${metric.value} ${metric.unit || ''} (dati demo)`}
    >
      <div className="metric-head">
        <span>{metric.label}</span>
        <span className={`trend ${trendClass}`}>{metric.trend}</span>
      </div>
      <strong>
        {metric.value}
        {metric.unit && <span className="small-unit">{metric.unit}</span>}
      </strong>
      <p>{metric.note}</p>
      {metric.type === 'emphasis' && (
        <div className="sparkline" aria-hidden="true">
          {[38, 52, 42, 65, 54, 76, 92].map((height) => (
            <i key={height} style={{ height: `${height}%` }} />
          ))}
        </div>
      )}
      {metric.type === 'days' && (
        <div className="line-chart" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      {metric.type === 'confirmation' && (
        <div className="progress" aria-hidden="true">
          <i style={{ width: '78.6%' }} />
        </div>
      )}
      {metric.type === 'pressure' && (
        <div className="mini-tags" aria-hidden="true">
          <span>BA</span>
          <span>LE</span>
          <span>TA</span>
        </div>
      )}
    </article>
  );
}
