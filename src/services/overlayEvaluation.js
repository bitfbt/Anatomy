export function evaluateJointAlignment(model, expectedJoints = {}) {
    const errors = Object.entries(expectedJoints)
        .map(([landmarkId, expected]) => {
            const actual = model.landmarks[Number(landmarkId)];
            if (!actual || !expected) return null;
            return {
                landmarkId: Number(landmarkId),
                expected,
                actual,
                pixelError: distance(actual, expected),
            };
        })
        .filter(Boolean);

    const averagePixelError = errors.length
        ? errors.reduce((sum, item) => sum + item.pixelError, 0) / errors.length
        : null;

    return {
        sampleCount: errors.length,
        averagePixelError,
        maxPixelError: errors.length ? Math.max(...errors.map(item => item.pixelError)) : null,
        errors,
    };
}

export const DEBUG_SCENARIOS = [
    'left hand open palm',
    'right hand open palm',
    'rotated hand',
    'low light hand',
    'partially bent fingers',
    'partially outside frame',
];

function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
