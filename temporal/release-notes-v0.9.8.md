# Release Notes — v0.9.8

Reported as "the export took far too long and produced nothing." It was neither
a hang nor a broken exporter — it was the exporter waiting, on its own budget,
in silence.

## Waiting on the reader was charged to the export

`awaitVisible()` ran:

```js
while (doc.hidden && !outOfTime()) { await wait(200); }
```

A backgrounded tab therefore burned the **entire `maxDuration`** doing nothing,
warned about it exactly once, and then exported whatever happened to be mounted.

The perverse part: raising `maxDuration` to give a long conversation more room
made this strictly worse. A hidden tab did not sweep any further — it simply
stalled for longer. Advice to raise the budget actively hurt.

The wait now draws on its own `maxHiddenWait` budget (60s by default) and **adds
the time it waited back to the deadline**. Time spent waiting for a person is
not time spent exporting. A tab that never returns gives up after that budget
and exports what is on the page, saying so, instead of consuming the whole run.

## Minutes of silence read as a hang

A long sweep produced no output between "starting" and "finished". The sweep now
reports progress every 5 seconds:

```
[Chat Exporter] Sweeping… 46% · 18 messages captured so far.
```

and says when a hidden tab pauses it and when it resumes.

## Tests

73/73 passing, up from 71. Two new tests, both mutation-checked against the old
behaviour: a permanently hidden tab must not spend a 10s budget waiting, and
time spent hidden must be given back so the sweep still finishes.
