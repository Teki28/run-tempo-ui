/** Beats either side of the centre used in each local fit. */
const HALF_WINDOW = 4;

/**
 * Remove estimation noise from a tracked beat list without flattening real
 * tempo drift.
 *
 * The beats coming out of the tracker carry two kinds of variation. One is the
 * song genuinely speeding up or slowing down, which the clicks must follow —
 * that is the entire reason for tracking beats instead of computing a grid.
 * The other is estimation noise: the envelope's frame grid and the sub-frame
 * peak fit together leave each beat a few milliseconds out, independently of
 * its neighbours. Measured on synthetic tracks whose beats are *exactly*
 * metronomic, consecutive click intervals still varied by up to 10ms, all of
 * it noise.
 *
 * Each beat is replaced by the value of a quadratic fitted to it and its
 * neighbours. Quadratic, not linear, because beat time against beat index is
 * curved whenever the tempo is changing: a straight-line fit leaves a
 * systematic 6ms error at the centre of the window on a track accelerating
 * from 120 to 150, and that error is in the one place it is least welcome.
 * A quadratic follows constant acceleration exactly, so what it removes is
 * only the independent per-beat error. A plain moving average is worse still —
 * it drags every beat towards the window mean and lags the tempo outright.
 */
export function smoothBeats(beats: readonly number[]): number[] {
  const n = beats.length;
  // Below two full windows there is not enough support for a local fit to be
  // better than the raw values.
  if (n < HALF_WINDOW * 2 + 1) return [...beats];

  const width = HALF_WINDOW * 2 + 1;
  const out = new Array<number>(n);

  // The window is always `width` wide, so the moment sums over its centred
  // offsets are the same every time.
  let s2 = 0;
  let s4 = 0;
  for (let u = -HALF_WINDOW; u <= HALF_WINDOW; u++) {
    s2 += u * u;
    s4 += u * u * u * u;
  }
  const det = width * s4 - s2 * s2;

  for (let i = 0; i < n; i++) {
    // Clamp the window to the array while keeping its width, so the beats at
    // each end are fitted from a full window rather than a shrinking one.
    const centre = Math.min(Math.max(HALF_WINDOW, i), n - 1 - HALF_WINDOW);

    let sumY = 0;
    let sumUY = 0;
    let sumU2Y = 0;
    for (let u = -HALF_WINDOW; u <= HALF_WINDOW; u++) {
      const y = beats[centre + u];
      sumY += y;
      sumUY += u * y;
      sumU2Y += u * u * y;
    }

    if (det === 0 || s2 === 0) {
      out[i] = beats[i];
      continue;
    }

    // y = a + b*u + c*u^2, with u centred on the window.
    const a = (s4 * sumY - s2 * sumU2Y) / det;
    const b = sumUY / s2;
    const c = (width * sumU2Y - s2 * sumY) / det;

    const u = i - centre;
    out[i] = a + b * u + c * u * u;
  }

  return out;
}
