// In-place iterative radix-2 FFT (Cooley-Tukey). Written here instead of adding a
// dependency: it is ~40 lines and the engine only needs real-input power spectra.

/** Transforms re/im in place. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new Error('fft: length must be a power of two');
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(step * k);
      const wi = Math.sin(step * k);
      for (let start = 0; start < n; start += size) {
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/** Power spectrum |X[k]|^2 for k = 0..n/2 of a real frame (length a power of two). */
export function powerSpectrum(frame: Float64Array): Float64Array {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  fft(re, im);
  const out = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}
