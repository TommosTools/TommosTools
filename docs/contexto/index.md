<a href=".">contexto</a>
========

[![npm](https://img.shields.io/npm/v/contexto)](https://www.npmjs.com/package/contexto)
[![size](https://img.shields.io/bundlephobia/minzip/contexto)](https://bundlephobia.com/result?p=contexto)

Enhanced React contexts in userland

---

## <a name="problem"></a>The Problem

React's `Context` and `useContext` are a convenient way to share values
within a dynamic scope, and can avoid messy prop-drilling.

However, React's stock implementation of contexts can perform poorly when
used to share values that change frequently, have many consumers, or are
provided to a large component tree.

---

## <a name="offering"></a>The Offering

`Contexto` provides a drop-in replacement for the standard `Context` implementation
based on a user-space subscription model, with a few extensions:

 - **Custom equality functions** to allow consumers to ignore irrelevant updates

 - **`useContexts()` hook** to subscribe to multiple contexts

 - **Imperative value modification** using methods exposed by hook and `Provider` ref handles,
 allowing extremely efficient updates with minimal re-rendering

[`Contexto` can also wrap standard `React.Context` instances](interoperability), so you can use the
new hotness to consume contexts from existing code and external libraries.

---

## <a name="usage"></a>Usage

```jsx
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

## <a name="installation"></a>Installation

Contexto is compatible with React 16.8+, React Native 16.8+ and Preact 10+.
You'll need to install one of those yourself. If you're using React or React Native,
you'll also need to install `scheduler`.

```bash
yarn add contexto react scheduler
```

Contexto comes with its own TypeScript definitions.

---

## <a name="documentation"></a>Documentation

 * [API listing](api)
 * [Selective subscriptions](selective-subscriptions)
 * [Imperative updates](imperative-updates)
 * [Caveats](caveats)
 * [Interoperability](interoperability)
 * [Working Example](example)

---

## <a name="inspiration"></a>Inspiration

See the wonderful work of [Dai Shi](https://github.com/dai-shi/), specifically [`useContextSelector`](https://github.com/dai-shi/use-context-selector/).
