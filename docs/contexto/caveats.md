contexto
========

# Caveats

This page contains notes on a few inconvenient or possibly surprising behaviours associated
with the [Contexto library](../)

#### **Imperative updates cannot be applied to the default context value**
During development, `useContextUpdate` will throw an error if it is called without an appropriate
Provider above it in the component tree. In a production environment it will silently fail.

#### **Changing the `value` prop also causes an update**
Although the `value` prop in a Contexto Provider is not the "single source of truth", it can be
used to update the value. The most recent update "wins", regardless of whether the update was
imperative or prop-based.

This behaviour can be avoided by initialising the Provider using `initialValue` instead of `value`.
This may be preferable in some cases e.g. to avoid memoising the initial value.

#### **Hot Reloading/Fast Refresh doesn't know about imperative updates**
In a development environment, React's various tools for fast refresh do their best to maintain
state during code updates, but they have no insight into the internal state of components.

By default, Fast Refresh on a Contexto-powered app will default back to the context values
as determined by the `value`/`initialValue` props on each Provider. To avoid this problem,
make sure to always specify an arbitrary (but consistent) `contextId` when calling `createContext`:

```javascript
const MyUserContext = createContext(defaultValue, { contextId: "Main user context" });
```

Contexto assumes that contexts created with the same `contextId` are *the same context*,
so make sure your ids are unique!
