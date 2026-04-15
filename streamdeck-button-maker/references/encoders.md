# Encoders / Dials Reference (Stream Deck Plus)

## Events

```javascript
// Rotation — ticks is positive for clockwise, negative for counter-clockwise
deck.on('rotate', async (control, ticks) => {
  console.log(`Encoder ${control.index} rotated ${ticks} ticks`);
});

// Press down
deck.on('down', async (control) => {
  if (control.type === 'encoder') {
    console.log(`Encoder ${control.index} pressed`);
  }
});

// Release
deck.on('up', async (control) => {
  if (control.type === 'encoder') { /* ... */ }
});
```

## Volume control pattern

```javascript
let pendingVolume = null;
let volumeTimer = null;

deck.on('rotate', async (control, ticks) => {
  const current = lastState?.device?.volume_percent ?? 50;
  pendingVolume = Math.max(0, Math.min(100, (pendingVolume ?? current) + ticks * 5));

  // Debounce: apply after 100ms of no rotation
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(async () => {
    try { await api.setVolume(pendingVolume); }
    catch (err) { console.error('Volume error:', err.message); }
    pendingVolume = null;
  }, 100);
});
```

## Encoder indices on Stream Deck Plus

Encoders are indexed 0–3, left to right (below the LCD strip).
They're separate from the 8 keypad buttons (indices 0–7).

## LCD segments per encoder

The 800×100 LCD strip is divided into 4 segments (one per encoder).
Each segment is roughly 200×100px. You can fill all 4 at once with
an 800×100 buffer (see `rendering.md`) or address segments individually
depending on the SDK version.
