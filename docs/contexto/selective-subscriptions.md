<a href=".">contexto</a>
========

# Selective subscriptions

This page describes a way of improving the performance of your context subscriptions
when using the [Contexto library](.), by specifying which changes to the top-level
context value can be ignored, thus avoiding re-renders.

Each instance of `useContext`, `useContexts` or `Context.Consumer` subscribes to value updates,
with an associated function for determining whether the value has changed.

When a Provider's value is updated, Contexto consults each of the subscribers, using its equality
function to compare the new value to the previous value provided to the subscriber.
A subscriber is only notified of the update (and thus re-rendered) if its equality function returns false.

```jsx
function isJsonEqual(oldValue, newValue) {
    return JSON.stringify(oldValue) === JSON.stringify(newValue);
}
```

The equality function is always called with the previous value, the new value, and the Context object
associated with the Provider being compared.

This third parameter may be useful when subscribing to multiple contexts with `useContexts`,
if the different contexts require different notions of equality, e.g.

```jsx
function customIsEqual(oldValue, newValue, context) {
    if (context === MyNumericContext)     // Approximately equal
        return Math.abs(oldValue - newValue) < 1e-3;
    else if (context === MyObjectContext) // Shallow comparison of object entries
        return (
            Object.keys(oldValue).length === Object.keys(newValue).length &&
            Object.keys(oldValue).every(key => oldValue[key] === newValue[key])
        );
    else
        return true;
}
```

The default equality function is `Object.is`, which provides the same behaviour as React's
standard contexts.
