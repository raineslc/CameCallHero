// Microphone capture: getUserMedia with the phone's voice processing turned off, and an
// AudioWorklet that hands raw mono PCM chunks to the app. Nothing leaves the device.

/** What we ask the browser for. Browsers may ignore any of these; read back `settings`. */
export const REQUESTED = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
} as const;

export type RequestedKey = keyof typeof REQUESTED;

export interface Capture {
  /** AudioContext sample rate: the rate of every chunk. */
  sampleRate: number;
  /** `track.getSettings()` right after the mic opened. */
  settings: MediaTrackSettings;
  /** Releases the mic track and closes the AudioContext. Safe to call more than once. */
  stop(): void;
}

export type MicErrorKind = 'insecure' | 'denied' | 'no-mic' | 'busy' | 'unsupported' | 'other';

export interface MicError {
  kind: MicErrorKind;
  message: string;
}

export class MicStartError extends Error {
  constructor(readonly info: MicError) {
    super(info.message);
  }
}

const MESSAGES: Record<Exclude<MicErrorKind, 'other'>, string> = {
  insecure: 'The microphone only works on a secure (https://) page. Open the https:// link of this site.',
  denied:
    "Microphone permission was denied. Allow the microphone for this site in your browser's site settings, then tap Start mic again.",
  'no-mic': 'No microphone was found on this device.',
  busy: 'The microphone could not be started. Another app may be using it: close it and try again.',
  unsupported: 'This browser cannot record audio here. Use a current version of Chrome.',
};

/** Maps a getUserMedia / AudioContext failure to a message the user can act on. */
export function classifyMicError(err: unknown): MicError {
  if (err instanceof MicStartError) return err.info;
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { kind: 'denied', message: MESSAGES.denied };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { kind: 'no-mic', message: MESSAGES['no-mic'] };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { kind: 'busy', message: MESSAGES.busy };
  }
  const detail = err instanceof Error ? err.message : String(err);
  return { kind: 'other', message: `Could not start the microphone${detail ? `: ${detail}` : '.'}` };
}

/** Checks the page can use the mic at all; returns the problem, or null. */
export function micSupportProblem(env: {
  secure: boolean;
  hasGetUserMedia: boolean;
  hasAudioWorklet: boolean;
}): MicError | null {
  if (!env.secure) return { kind: 'insecure', message: MESSAGES.insecure };
  if (!env.hasGetUserMedia || !env.hasAudioWorklet) return { kind: 'unsupported', message: MESSAGES.unsupported };
  return null;
}

export interface SettingRow {
  key: RequestedKey;
  requested: boolean | number;
  /** undefined: the browser did not report this setting. */
  actual: boolean | number | string | undefined;
  /** true when the browser reports exactly what was requested. */
  ok: boolean;
}

export function compareSettings(actual: MediaTrackSettings): SettingRow[] {
  return (Object.keys(REQUESTED) as RequestedKey[]).map((key) => {
    const value = (actual as Record<string, unknown>)[key];
    const shown = typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' ? value : undefined;
    return { key, requested: REQUESTED[key], actual: shown, ok: shown === REQUESTED[key] };
  });
}

/** Samples per chunk posted from the worklet (~43 ms at 48 kHz). */
const CHUNK = 2048;

// Inline so the worklet needs no separate build entry. Mono input: the node down-mixes
// (channelCount 1, explicit). Zero outputs: nothing is played back.
const WORKLET = `
class PcmTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(${CHUNK}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(${CHUNK});
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-tap', PcmTap);
`;

/**
 * Opens the mic and calls `onChunk` with mono Float32 PCM at `sampleRate`.
 * Call from a user gesture (tap), so the AudioContext is allowed to run.
 * Throws MicStartError; everything opened so far is released on failure.
 */
export async function startCapture(onChunk: (samples: Float32Array) => void): Promise<Capture> {
  const problem = micSupportProblem({
    secure: window.isSecureContext,
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    hasAudioWorklet: typeof AudioWorkletNode === 'function',
  });
  if (problem) throw new MicStartError(problem);

  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (node) node.port.onmessage = null;
    source?.disconnect();
    node?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { ...REQUESTED }, video: false });
    const track = stream.getAudioTracks()[0];
    if (!track) throw new MicStartError({ kind: 'no-mic', message: MESSAGES['no-mic'] });
    ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'pcm-tap', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!stopped) onChunk(e.data);
    };
    source.connect(node);
    await ctx.resume();
    return { sampleRate: ctx.sampleRate, settings: track.getSettings(), stop };
  } catch (err) {
    stop();
    throw err instanceof MicStartError ? err : new MicStartError(classifyMicError(err));
  }
}
