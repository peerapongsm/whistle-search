interface ResultCardProps {
  rank: number;
  name: string;
  confidence: number;
}

/** One top-k match result: rank + name + a confidence bar (0-100%). */
export default function ResultCard({ rank, name, confidence }: ResultCardProps) {
  const percent = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  return (
    <div className={`result-card ${rank === 1 ? "result-card-rank1" : ""}`}>
      <div className="result-card-top">
        <span className="result-card-name">
          <span className="result-card-rank">{rank.toString().padStart(2, "0")}</span> {name}
        </span>
        <span className="result-card-confidence">{percent}%</span>
      </div>
      <div className="confidence-bar">
        <div className="confidence-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
