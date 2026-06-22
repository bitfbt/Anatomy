import { useState } from 'react';

export default function Labels({ parts, visible, layer }) {
    const [expandedIndex, setExpandedIndex] = useState(null);

    if (!visible || !parts || parts.length === 0) return null;

    const handleTap = (index) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const layerClass = layer === 'skeleton' ? 'layer-skeleton' : 'layer-muscles';

    return (
        <div className="label-container">
            {parts.map((part, i) => {
                const isLeft = part.x < 50;
                const side = isLeft ? 'right' : 'left';
                const isExpanded = expandedIndex === i;

                return (
                    <div
                        key={`${layer}-${i}`}
                        className={`label-pin label-animate-in ${layerClass}`}
                        style={{
                            left: `${part.x}%`,
                            top: `${part.y}%`,
                            animationDelay: `${i * 280}ms`,
                        }}
                        onClick={() => handleTap(i)}
                    >
                        {/* Glowing dot */}
                        <div className="label-dot" />

                        {/* Connector line */}
                        <div className={`label-connector ${side}`} />

                        {/* Label tag */}
                        <div className={`label-tag ${side} ${isExpanded ? 'expanded' : ''}`}>
                            {part.name}
                            {isExpanded && (
                                <span className="label-detail">{part.detail}</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
