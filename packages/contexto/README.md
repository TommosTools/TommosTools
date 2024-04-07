contexto
========

[![npm](https://img.shields.io/npm/v/contexto)](https://www.npmjs.com/package/contexto)
[![size](https://img.shields.io/bundlephobia/minzip/contexto)](https://bundlephobia.com/result?p=contexto)

Enhanced React contexts in userland

---

## The Problem

React's `Context` and `useContext` are a convenient way to share values
within a dynamic scope, and can avoid messy prop-drilling.

However, React's stock implementation of contexts can perform poorly when
used to share values that change frequently, have many consumers, or are
provided to a large component tree.

---

## The Offering

`Contexto` provides a drop-in replacement for the standard `Context` implementation
based on a user-space subscription model, with a few extensions:

 - **[Custom equality functions](https://tommostools.github.io/TommosTools/contexto/selective-subscriptions)** to allow consumers to ignore irrelevant updates

 - **[`useContexts()`](https://tommostools.github.io/TommosTools/contexto/api#useContexts) hook** to subscribe to multiple contexts

 - **[Imperative value modification](https://tommostools.github.io/TommosTools/contexto/imperative-updates)** using methods exposed by hook and `Provider` ref handles,
 allowing extremely efficient updates with minimal re-rendering

[`Contexto` can also wrap standard `React.Context` instances](https://tommostools.github.io/TommosTools/contexto/interoperability), so you can use the
new hotness to consume contexts from existing code and external libraries.

---

## Usage

```javascript
import { createContext, useContexts, useContextUpdate } from "contexto";

const MyContext         = createContext("defaultValue");
const MyOtherContext    = createContext("defaultOtherValue");

function Reader() {
  const values = useContexts({ first: MyContext, second: MyOtherContext });
  return (
    <dl>
      <dt>First:</dt>  <dd>{values.first}</dd>
      <dt>Second:</dt> <dd>{values.second}</dd>
    </dl>
  );
}

function Updater() {
  const update = useContextUpdate(MyContext);
  return <button onClick={ () => update("newValue") }>Update</button>
}

function App() {
  return (
    <MyContext.Provider value="someValue">
      <MyOtherContext.Provider value="someOtherValue">
        <Reader/>
        <Updater/>
      </MyOtherContext.Provider>
    </MyContext.Provider>
  );
}
```

## Installation

Contexto is compatible with [React 16.8+](https://react.dev/), [React Native](https://reactnative.dev/) 16.8+ and [Preact 10+](https://preactjs.com/).
You'll need to install one of those yourself. If you're using React or React Native,
you'll also need to install `scheduler`.

```bash
yarn add contexto react scheduler
```

Contexto comes with its own TypeScript definitions.

## Documentation

 * [API listing](https://tommostools.github.io/TommosTools/contexto/api)
 * [Selective subscriptions](https://tommostools.github.io/TommosTools/contexto/selective-subscriptions)
 * [Imperative updates](https://tommostools.github.io/TommosTools/contexto/imperative-updates)
 * [Caveats](https://tommostools.github.io/TommosTools/contexto/caveats)
 * [Interoperability](https://tommostools.github.io/TommosTools/contexto/interoperability)
 * [Working Example](https://tommostools.github.io/TommosTools/contexto/example)

---

## Inspiration

See the wonderful work of [Dai Shi](https://github.com/dai-shi/), specifically [`useContextSelector`](https://github.com/dai-shi/use-context-selector/).
