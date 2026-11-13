// Live dominant frequency of the newest mic samples, for the practice lane's trail.
// Same measure as Features.domHz (loudest FFT bin between band.minHz and min(band.maxHz, 0.45 x rate)),
// on buffers allocated once, so it can run on every mic chunk without garbage.

import { fft } from './fft';
import { FULL_BAND, type Band } from './features';

export class LivePitch {
  private readonly ring: Float32Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly win: Float64Array;
  private readonly binHz: number;
  private readonly loBin: number;
  private readonly hiBin: number;
  private pos = 0;
  private seen = 0;

  /** `size` must be a power of two (2048 is ~43 ms at 48 kHz). `band`: the species' analysis band. */
  constructor(sampleRate: number, readonly size = 2048, band: Band = FULL_BAND) {
    this.ring = new Float32Array(size);
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.win = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 1;
    this.binHz = rate / size;
    this.loBin = Math.max(1, Math.ceil(band.minHz / this.binHz));
    this.hiBin = Math.min(size / 2, Math.floor(Math.min(band.maxHz, 0.45 * rate) / this.binHz));
  }

  push(x: Float32Array): void {
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      this.ring[this.pos] = Number.isFinite(v) ? v : 0;
      this.pos = (this.pos + 1) % this.size;
    }
    this.seen += x.length;
  }

  /** Dominant frequency (Hz) of the last `size` samples; 0 until that many arrived or if no valid band. */
  dominantHz(): number {
    if (this.seen < this.size || this.hiBin < this.loBin) return 0;
    for (let i = 0; i < this.size; i++) {
      this.re[i] = this.ring[(this.pos + i) % this.size] * this.win[i];
      this.im[i] = 0;
    }
    fft(this.re, this.im);
    let best = this.loBin;
    let bestP = -1;
    for (let k = this.loBin; k <= this.hiBin; k++) {
      const p = this.re[k] * this.re[k] + this.im[k] * this.im[k];
      if (p > bestP) {
        bestP = p;
        best = k;
      }
    }
    return bestP > 0 ? best * this.binHz : 0;
  }
}
