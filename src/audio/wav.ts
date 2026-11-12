// WAV encoder for downloading takes: mono, 16-bit PCM.

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const rate = Math.max(1, Math.round(sampleRate));
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0;
    v.setInt16(44 + i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true);
  }
  return bytes;
}
