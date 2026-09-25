import { CARPAL_LABELS } from '../services/carpalLabels';

export default function WristLegend() {
    return (
        <aside className="wrist-legend" aria-label="Wrist bone letter key">
            <details open>
                <summary>Wrist bones · A–H</summary>
                <dl>
                    {CARPAL_LABELS.map(bone => (
                        <div key={bone.id}>
                            <dt>{bone.letter}</dt><dd>{bone.name}</dd>
                        </div>
                    ))}
                </dl>
            </details>
        </aside>
    );
}
