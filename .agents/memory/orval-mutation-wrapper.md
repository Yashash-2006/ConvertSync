---
name: Orval mutation wrapper
description: Orval-generated multipart/form-data mutation hooks wrap input in { data: ... }
---

All Orval-generated mutation hooks in this repo use the shape:

```typescript
hook.mutateAsync({ data: InputType })
```

NOT the fields directly:

```typescript
hook.mutateAsync({ file, someField })   // WRONG
hook.mutateAsync({ data: { file, someField } })  // CORRECT
```

**Why:** Orval generates `MutationFunction<Result, { data: BodyType<Input> }>`. The inner function destructures `{ data }` and passes it to the underlying API function.

**How to apply:** Any time you call `useXxx().mutateAsync(...)` in the converter frontend, wrap the input object in `{ data: ... }`.
