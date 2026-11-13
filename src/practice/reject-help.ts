// What to do after a take the scorer refused (src/audio/score.ts gives the reason). One plain
// line per reason, shown under the "Not scored" message in practice and in the challenge.

const HELP: Record<string, string> = {
  clipped: 'Hold the phone further away, about an arm’s length, or call a little softer.',
  'too-quiet': 'Hold the phone closer and call when the count-in ends.',
  'too-noisy': 'Move away from wind, fans, traffic or people talking, or hold the phone closer. The light must be green before you call.',
  'no-call': 'Call right after the count-in ends, loud enough for the bar to reach Good.',
};

/** The hint for a rejection reason; '' when there is nothing useful to add. */
export const rejectHelp = (reason: string | undefined): string => (reason ? (HELP[reason] ?? '') : '');
