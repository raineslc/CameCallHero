// Live loudness meter with the scorer's zones (audio/meter.ts): too quiet / good / too loud,
// a needle at the held level and a plain label ("Move closer", "Good", "Back off").
// set() runs once per mic chunk; it touches the DOM only when the needle moves by a whole
// percent or the zone changes.

import { LevelHold, meterPos, meterZones, ZONE_TEXT, zoneFor, type Zone, type Zones } from '../audio/meter';

export class LevelMeter {
  readonly el: HTMLElement;
  private readonly quiet: HTMLElement;
  private readonly good: HTMLElement;
  private readonly loud: HTMLElement;
  private readonly needle: HTMLElement;
  private readonly label: HTMLElement;
  private readonly hold = new LevelHold();
  private zones: Zones = meterZones(null);
  private shownPct = -1;
  private shownZone: Zone | null = null;

  constructor(id: string) {
    this.el = document.createElement('div');
    this.el.className = 'lmeter';
    this.el.id = id;
    this.el.innerHTML = `
      <div class="lmeter-track" aria-hidden="true">
        <span class="lmeter-zone quiet"></span><span class="lmeter-zone good"></span><span class="lmeter-zone loud"></span>
        <span class="lmeter-needle"></span>
      </div>
      <p class="lmeter-label"><span class="lmeter-dot"></span><span class="lmeter-text"></span></p>`;
    const q = (s: string) => this.el.querySelector<HTMLElement>(s)!;
    this.quiet = q('.quiet');
    this.good = q('.good');
    this.loud = q('.loud');
    this.needle = q('.lmeter-needle');
    this.label = q('.lmeter-label');
    this.setFloor(null);
    this.reset();
  }

  /** Noise floor (dBFS) the zones are based on; null before it is measured. */
  setFloor(floorDb: number | null): void {
    this.zones = meterZones(floorDb);
    const q = meterPos(this.zones.quietTop);
    const l = meterPos(this.zones.loudBottom);
    this.quiet.style.width = `${(q * 100).toFixed(1)}%`;
    this.good.style.width = `${(Math.max(0, l - q) * 100).toFixed(1)}%`;
    this.loud.style.width = `${((1 - l) * 100).toFixed(1)}%`;
    this.shownZone = null; // re-evaluate the label against the new zones
  }

  reset(): void {
    this.hold.reset();
    this.shownPct = -1;
    this.shownZone = null;
    this.show(-Infinity, 0);
  }

  /** levelDb: loudest frame RMS of the chunk; peak: largest sample 0..1; t: seconds, non-decreasing. */
  set(levelDb: number, peak: number, t: number): void {
    this.hold.push(levelDb, peak, t);
    this.show(this.hold.levelDb, this.hold.peakSample);
  }

  private show(levelDb: number, peak: number): void {
    const pct = Math.round(meterPos(levelDb) * 100);
    if (pct !== this.shownPct) {
      this.shownPct = pct;
      this.needle.style.left = `${pct}%`;
    }
    const zone = zoneFor(levelDb, peak, this.zones);
    if (zone !== this.shownZone) {
      this.shownZone = zone;
      this.label.dataset.zone = zone;
      this.el.dataset.zone = zone;
      this.label.lastElementChild!.textContent = ZONE_TEXT[zone];
    }
  }
}
