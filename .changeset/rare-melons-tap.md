---
'totorobot': minor
---

Add `send` to the transition record a listener receives, so a reaction can drive
the machine without closing over the host it was registered on:

```ts
doc.observe('* -> review', (e) => e.send('publish'))
```

It accepts any declared input, whatever the pattern matched, and is queued like
any other send. Existing listeners need no change.
