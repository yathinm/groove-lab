/**
 * Analyze a time-domain buffer for an onset using peak thresholding
 * with a simple dynamic adjustment based on average absolute amplitude.
 */
export function detectOnset(
  timeDomainData: Float32Array,
  threshold: number
): { detected: boolean; peak: number; dynamicThreshold: number } {
  let maxAbsValue = 0;
  let sumAbs = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const absVal = Math.abs(timeDomainData[i]);
    sumAbs += absVal;
    if (absVal > maxAbsValue) {
      maxAbsValue = absVal;
    }
  }

  const averageAbs = sumAbs / timeDomainData.length;
  const dynamicThreshold = Math.max(threshold, averageAbs * 1.5);

  return {
    detected: maxAbsValue > dynamicThreshold,
    peak: maxAbsValue,
    dynamicThreshold,
  };
}


