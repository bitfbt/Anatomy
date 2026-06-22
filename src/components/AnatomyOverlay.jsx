import { useState } from 'react';

export default function AnatomyOverlay({ parts, layer, visible }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!visible || !parts || parts.length === 0) return null;

    const isMuscles = layer === 'muscles';
    const fillColor = isMuscles ? 'rgba(255, 68, 102, 0.25)' : 'rgba(224, 232, 255, 0.2)';
    const strokeColor = isMuscles ? 'rgba(255, 68, 102, 0.6)' : 'rgba(224, 232, 255, 0.5)';
    const hoverFill = isMuscles ? 'rgba(255, 68, 102, 0.45)' : 'rgba(224, 232, 255, 0.4)';
    const hoverStroke = isMuscles ? 'rgba(255, 68, 102, 0.9)' : 'rgba(224, 232, 255, 0.8)';
    const glowFilter = isMuscles
        ? 'drop-shadow(0 0 4px rgba(255, 68, 102, 0.5))'
        : 'drop-shadow(0 0 4px rgba(224, 232, 255, 0.5))';

    return (
        <svg
            className="anatomy-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ filter: glowFilter }}
        >
            <defs>
                {/* Glow filter for shapes */}
                <filter id="anatomy-glow">
                    <feGaussianBlur stdDeviation="0.3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {parts.map((part, i) => {
                if (!part.shape || part.shape.length < 3) return null;

                const points = part.shape.map(pt => `${pt[0]},${pt[1]}`).join(' ');
                const isHovered = hoveredIndex === i;

                return (
                    <polygon
                        key={`${layer}-shape-${i}`}
                        points={points}
                        fill={isHovered ? hoverFill : fillColor}
                        stroke={isHovered ? hoverStroke : strokeColor}
                        strokeWidth="0.3"
                        strokeLinejoin="round"
                        filter="url(#anatomy-glow)"
                        className="anatomy-shape"
                        style={{
                            animationDelay: `${i * 200}ms`,
                            cursor: 'pointer',
                        }}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onTouchStart={() => setHoveredIndex(i)}
                    />
                );
            })}
        </svg>
    );
}
