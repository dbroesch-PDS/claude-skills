# Encoders (Stream Deck Plus Dials)

Stream Deck Plus has 4 physical dials + a shared touch strip. Each dial maps to an "Encoder"
action. The touch strip is divided into 4 equal sections (200×100px each), one per encoder.

## Manifest configuration

```json
{
  "UUID": "com.author.plugin.mydial",
  "Name": "My Dial",
  "Icon": "imgs/actions/mydial/icon",
  "States": [{ "Image": "imgs/actions/mydial/key" }],
  "Controllers": ["Encoder"],
  "Encoder": {
    "layout": "$A1",
    "TriggerDescription": {
      "Rotate": "Adjust value",
      "Push": "Toggle / reset",
      "Touch": "Show info",
      "LongTouch": "Open settings"
    }
  }
}
```

## Built-in layouts

| ID | Contents |
|----|----------|
| `$A0` | Full-width title |
| `$A1` | Title + value + indicator bar |
| `$B1` | Icon + title + value |
| `$B2` | Icon + title |
| `$C1` | Icon + large value |
| `$X1` | Custom (define items yourself) |

`$A1` is the most useful for dials that show a labeled numeric value (volume, brightness, etc.).

## Feedback keys for $A1

```typescript
await action.setFeedback({
  title: "Volume",                        // label above the bar
  value: "75%",                           // text shown to the right
  indicator: { value: 75, enabled: true } // bar fill 0–100
});
```

## Full action example (volume dial)

```typescript
import {
  action,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";

const STEP = 5; // volume % per dial tick

@action({ UUID: "com.author.plugin.volume" })
export class VolumeDial extends SingletonAction {
  private volume = 50;
  private isMuted = false;
  private premuteVolume = 50;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private pendingVolume: number | null = null;

  override async onWillAppear(_ev: WillAppearEvent): Promise<void> {
    // Load initial state from your service / API
    await this.updateFeedback();
  }

  override async onDialRotate(ev: DialRotateEvent): Promise<void> {
    const delta = ev.payload.ticks * STEP;
    this.volume = Math.max(0, Math.min(100, this.volume + delta));
    this.isMuted = false;
    this.pendingVolume = this.volume;

    // Update display immediately for responsiveness
    await this.updateFeedback();

    // Debounce the actual API call to avoid flooding on fast spins
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(async () => {
      if (this.pendingVolume !== null) {
        await myService.setVolume(this.pendingVolume).catch((err) =>
          streamDeck.logger.error(`Volume API failed: ${err}`)
        );
        this.pendingVolume = null;
      }
    }, 100);
  }

  override async onDialDown(_ev: DialDownEvent): Promise<void> {
    if (this.isMuted) {
      this.volume = this.premuteVolume;
      this.isMuted = false;
    } else {
      this.premuteVolume = this.volume;
      this.volume = 0;
      this.isMuted = true;
    }
    await myService.setVolume(this.volume);
    await this.updateFeedback();
  }

  private async updateFeedback(): Promise<void> {
    const display = this.isMuted ? 0 : this.volume;
    for (const action of this.actions) {
      if (!action.isDial()) continue; // guard — always check before calling dial methods
      await action.setFeedback({
        title: this.isMuted ? "Muted" : "Volume",
        value: `${display}%`,
        indicator: { value: display, enabled: true },
      });
    }
  }
}
```

## Key constraints

- **Always check `action.isDial()`** before calling `setFeedback`, `setFeedbackLayout`, or `setTriggerDescription` — calling these on a keypad action throws
- Touch strip canvas is fixed at **200×100px per encoder slot** — layout items outside this area are clipped
- `key`, `rect`, and `type` properties in layout items **cannot be changed at runtime** — only values can be updated via `setFeedback`
- Z-order range: 0–700; items with the same z-order cannot overlap

## Dial events

| Event | When | Key payload field |
|-------|------|-------------------|
| `onDialRotate` | User turns dial | `ev.payload.ticks` (+ = clockwise) |
| `onDialDown` | Dial pressed | — |
| `onDialUp` | Dial released | — |
| `onTouchTap` | Touch strip tapped | `ev.payload.hold` (true if long press) |
| `onWillAppear` | Dial becomes visible | — |
