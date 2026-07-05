import { AlertTriangle, Grid2X2, Target } from "lucide-react";

export function CoverageMatrix({ matrix, activeChain, onScope }) {
  return (
    <section className="coverageMatrix" aria-label="公司覆盖矩阵">
      <div className="coverageHead">
        <div>
          <span className="eyebrow">覆盖矩阵</span>
          <h2>链路覆盖与证据质量</h2>
        </div>
        <div className="coverageTotals">
          <span>{matrix.totals.companyCount} 公司</span>
          <span>{matrix.totals.mappingCount} 映射</span>
          <span>{matrix.totals.reviewCount} 待审</span>
        </div>
      </div>

      <div className="coverageRows" aria-label="公司覆盖矩阵明细">
        {matrix.rows.map((row) => (
          <button
            key={row.chain.id}
            className={`coverageRow ${activeChain === row.chain.id ? "isActive" : ""}`}
            onClick={() => onScope(activeChain === row.chain.id ? null : row.chain.id)}
          >
            <span className="coverageChain">
              <Grid2X2 size={14} />
              <strong>{row.chain.name}</strong>
              <small>{row.companyCount} 公司 · {row.topNodeName}</small>
            </span>
            <span className="marketCount"><small>A股</small><b>{row.marketCounts.a_share}</b></span>
            <span className="marketCount"><small>美股</small><b>{row.marketCounts.us}</b></span>
            <span className="evidenceStack" aria-label={`L1 ${row.evidenceCounts.L1}，L2 ${row.evidenceCounts.L2}，L3 ${row.evidenceCounts.L3}`}>
              <i className="level-L1" style={{ "--weight": Math.max(1, row.evidenceCounts.L1) }}>{row.evidenceCounts.L1}</i>
              <i className="level-L2" style={{ "--weight": Math.max(1, row.evidenceCounts.L2) }}>{row.evidenceCounts.L2}</i>
              <i className="level-L3" style={{ "--weight": Math.max(1, row.evidenceCounts.L3) }}>{row.evidenceCounts.L3}</i>
            </span>
            <span className="qualityCell">
              <Target size={13} />
              {row.qualityScore}%
              {row.reviewCount > 0 && <small>{row.reviewCount} 待审</small>}
            </span>
          </button>
        ))}
      </div>

      {matrix.insights?.length > 0 && (
        <div className="coverageAlerts" aria-label="覆盖缺口提醒">
          <div className="coverageAlertHead">
            <AlertTriangle size={14} />
            <span>覆盖缺口提醒</span>
          </div>
          <div className="coverageAlertList">
            {matrix.insights.slice(0, 3).map((item) => (
              <button key={`${item.type}:${item.target_id}:${item.title}`} onClick={() => onScope(item.target_id)}>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
