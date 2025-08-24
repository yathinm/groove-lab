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
  let peakCount = 0;
  
  // Calculate RMS and find peaks
  for (let i = 0; i < timeDomainData.length; i++) {
    const absVal = Math.abs(timeDomainData[i]);
    sumAbs += absVal;
    if (absVal > maxAbsValue) {
      maxAbsValue = absVal;
    }
    // Count samples above 50% of current max (potential peaks)
    if (absVal > maxAbsValue * 0.5) {
      peakCount++;
    }
  }

  const averageAbs = sumAbs / timeDomainData.length;
  const rms = Math.sqrt(sumAbs / timeDomainData.length);
  
  // More sophisticated threshold calculation
  const baseThreshold = Math.max(threshold, rms * 1.5);
  
  // Additional filtering: require significant peak-to-average ratio
  const peakToAverageRatio = maxAbsValue / (averageAbs + 0.001);
  const peakDensity = peakCount / timeDomainData.length;
  
  // Only detect if:
  // 1. Peak is above threshold
  // 2. Peak-to-average ratio is high enough (sharp transient)
  // 3. Peak density is low (not sustained noise)
  const detected = maxAbsValue > baseThreshold && 
                  peakToAverageRatio > 1.5 && 
                  peakDensity < 0.2;

  return {
    detected,
    peak: maxAbsValue,
    dynamicThreshold: baseThreshold,
  };
}


