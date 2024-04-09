use-context-selector
====================

[![npm](https://img.shields.io/npm/v/@tommostools/use-context-selector)](https://www.npmjs.com/package/@tommostools/use-context-selector)
[![size](https://img.shields.io/bundlephobia/minzip/@tommostools/use-context-selector)](https://bundlephobia.com/result?p=@tommostools/use-context-selector)

Hook for simple context slicing in React

---

## Introduction

A simple utility function in the style of Dai Shi's
[https://www.npmjs.com/package/use-context-selector](`use-context-selector`)
which allows for React components to ignore irrelevant changes in context
values, reducing unnecessary re-renders.

The stock React Context implementation causes any change in value to re-render
all components that use that context.
The [Contexto library](https://www.npmjs.com/package/contexto)
provides an alternative implementation which uses a pub-sub design to allow
components to selectively subscribe only to relevant value updates.

`use-context-selector` provides a simple hook `useContextSelector()` to be
used with Contexto contexts for the simple case of subscribing only to changes
in a single member within the Contexto value, and the common case of an value
computed directly from the Contexto value:

```jsx
useContextSelector(ContextoContext, "keyof-Context-value");

useContextSelector(ContextoContext, (contextValue) => someFunction(contextValue));
```

For more elaborate context data manipulations, and an integrated caching system,
you may wish to look at into [`contextors`](https://www.npmjs.com/package/contextors),
which also build on the Contexto library.

## Usage

```jsx
import { createContext } from "contexto";
import { useContextSelector } from "@tommostools/use-context-selector";

const MyContext = createContext({
  nestedValue: { inner: "some value" },
  array: ["one", "two", "three"],
  foo: 123,
});

const Consumer = ({ offset }) =>
  {
    // `value1` updates only when the context's `.nestedValue` changes
    const value1 = useContextSelector(MyContext, (contextValue) => contextValue.nestedValue);

    // `value2` updates only when the length of the array changes
    const value2 = useContextSelector(MyContext, (contextValue) => contextValue.array.length);

    // `value3` subscribes only to the value of `.foo`, using a convenient syntax
    const value3 = useContextSelector(MyContext, "foo");

    // `value4` updates when `.foo` changes, but the selector has a dependency on `offset`
    const value4 = useContextSelector(
        MyContext,
        (contextValue) => contextValue.foo + offset,
        [offset]);

    return <div>{`${value1} / ${value2} / ${value3} / ${value4}`}</div>
  }

render(<Consumer/>);
```

## Dependencies

When specifying a selector function, `useContextSelector` expects a third
argument containing a list of values that the function's stability depends on,
in the style of `useMemo` or `useCallback`.  The selector function will be
updated and re-evaluated when any of the dependencies changes.

The dependency list default to the empty list if omitted, so the values of any
local variables referenced in the selector will remain unchanged after the
component is mounted:

```jsx
const Consumer = () =>
  {
    const [tick, setTick] = useState(0);
    useEffect(() => setInterval(setTick(t => t + 1), 1000), []);

    // `tick` will always be 0
    const valueWithoutDeps = useContextSelector(
      SomeContext,
      (value) => `${value}: ${tick}`
    );

    // `tick` will continuously increase
    const valueWithDeps    = useContextSelector(
      SomeContext,
      (value) => `${value}: ${tick}`,
      [tick]
    );

    return <div>{`${valueWithoutDeps} / ${valueWithDeps}`}</div>
  }
```

## <a name="installation"></a>Installation

[Contexto](https://www.npmjs.com/package/contexto), and thus `use-context-selector`,
is compatible with
[React](https://react.dev/) 16.8+,
[React Native](https://reactnative.dev/) 16.8+
and [Preact](https://preactjs.com/) 10+.
You'll need to install one of those yourself.
If you're using React or React Native, you'll also need to install `scheduler`.

```bash
yarn add contexto react scheduler @tommostools/use-context-selector
```

`useContextSelector` comes with its own TypeScript definitions.
