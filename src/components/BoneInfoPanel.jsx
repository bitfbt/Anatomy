export default function BoneInfoPanel({ bone, wristBones, quiz, onClose }) {
    if (!bone && !quiz) return null;

    return (
        <div className="bone-info-panel">
            <button className="bone-info-close" onClick={onClose}>x</button>
            {quiz && (
                <div className={`quiz-status ${quiz.correct ? 'correct' : ''}`}>
                    {quiz.message}
                </div>
            )}
            {bone && (
                <>
                    <h3>{bone.info.name}</h3>
                    {bone.info.alias && <div className="bone-info-alias">{bone.info.alias}</div>}
                    <div className="bone-info-group">{bone.info.group}</div>
                    <dl>
                        <dt>Side</dt>
                        <dd>{bone.info.handSide} / {bone.info.anatomicalSide}</dd>
                        <dt>Location</dt>
                        <dd>{bone.info.location}</dd>
                        <dt>Function</dt>
                        <dd>{bone.info.function}</dd>
                        <dt>Connected joints</dt>
                        <dd>{bone.info.connectedJoints}</dd>
                        <dt>Memory trick</dt>
                        <dd>{bone.info.memory}</dd>
                    </dl>
                    {wristBones?.length > 0 && (
                        <div className="wrist-detail">
                            <h4>Wrist detail</h4>
                            <div className="wrist-grid">
                                {wristBones.map(item => (
                                    <span
                                        key={item.id}
                                        className={item.id === bone.id ? 'active' : ''}
                                    >
                                        {item.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="edu-disclaimer">
                        Educational landmark overlay only. This is not an X-ray or medical diagnosis.
                    </p>
                </>
            )}
        </div>
    );
}
