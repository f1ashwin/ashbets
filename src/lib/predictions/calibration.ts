/**
 * Model Calibration Metrics
 *
 * Research shows calibration-optimized models generate 70% higher returns
 * than accuracy-optimized ones. These metrics help validate our models.
 */

interface PredictionResult {
  predictedProbability: number;
  actualOutcome: number; // 1 = occurred, 0 = did not occur
}

/**
 * Brier Score — primary calibration metric.
 * Lower is better. 0 = perfect, 1 = worst possible.
 * For reference: random guessing on a 50/50 event = 0.25
 */
export function brierScore(predictions: PredictionResult[]): number {
  if (predictions.length === 0) return 0;

  const sum = predictions.reduce((acc, p) => {
    return acc + Math.pow(p.predictedProbability - p.actualOutcome, 2);
  }, 0);

  return sum / predictions.length;
}

/**
 * Log Loss (Cross-Entropy) — more sensitive to overconfident predictions.
 * Lower is better. Heavily penalizes confident wrong predictions.
 */
export function logLoss(predictions: PredictionResult[]): number {
  if (predictions.length === 0) return 0;
  const epsilon = 1e-15; // avoid log(0)

  const sum = predictions.reduce((acc, p) => {
    const prob = Math.max(epsilon, Math.min(1 - epsilon, p.predictedProbability));
    return (
      acc -
      (p.actualOutcome * Math.log(prob) +
        (1 - p.actualOutcome) * Math.log(1 - prob))
    );
  }, 0);

  return sum / predictions.length;
}

/**
 * Expected Calibration Error (ECE).
 * Bins predictions into ranges and measures how well predicted
 * probabilities match actual frequencies.
 * 0 = perfectly calibrated.
 */
export function expectedCalibrationError(
  predictions: PredictionResult[],
  numBins = 10
): number {
  if (predictions.length === 0) return 0;

  const bins: PredictionResult[][] = Array.from({ length: numBins }, () => []);

  for (const p of predictions) {
    const binIndex = Math.min(
      Math.floor(p.predictedProbability * numBins),
      numBins - 1
    );
    bins[binIndex].push(p);
  }

  let ece = 0;
  for (const bin of bins) {
    if (bin.length === 0) continue;

    const avgPredicted =
      bin.reduce((sum, p) => sum + p.predictedProbability, 0) / bin.length;
    const avgActual =
      bin.reduce((sum, p) => sum + p.actualOutcome, 0) / bin.length;

    ece += (bin.length / predictions.length) * Math.abs(avgPredicted - avgActual);
  }

  return ece;
}

/**
 * Generate calibration curve data for charting.
 * Returns bins with predicted vs actual frequencies.
 */
export function calibrationCurve(
  predictions: PredictionResult[],
  numBins = 10
): Array<{ predicted: number; actual: number; count: number }> {
  const bins: PredictionResult[][] = Array.from({ length: numBins }, () => []);

  for (const p of predictions) {
    const binIndex = Math.min(
      Math.floor(p.predictedProbability * numBins),
      numBins - 1
    );
    bins[binIndex].push(p);
  }

  return bins.map((bin, i) => {
    const midpoint = (i + 0.5) / numBins;
    if (bin.length === 0) {
      return { predicted: midpoint, actual: 0, count: 0 };
    }
    return {
      predicted: midpoint,
      actual: bin.reduce((sum, p) => sum + p.actualOutcome, 0) / bin.length,
      count: bin.length,
    };
  });
}
