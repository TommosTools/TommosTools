# contexto

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

 - **Custom equality functions** to allow consumers to ignore irrelevant updates

 - **`useContexts()` hook** to subscribe to multiple contexts

 - **Imperative value modification** using methods exposed by hook and `Provider` ref handles,
 allowing extremely efficient updates with minimal re-rendering

[`Contexto` can also wrap standard `React.Context` instances](#interoperability), so you can use the
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

Contexto is compatible with React 16.8+, React Native 16.8+ and Preact 10+.
You'll need to install one of those yourself. If you're using React or React Native,
you'll also need to install `scheduler`.

```bash
yarn add contexto react scheduler
```

Contexto comes with its own TypeScript definitions.

---

## API

### `createContext`

```javascript
const MyContext = contexto.createContext(defaultValue, { displayName?, contextId? }?);
```

Creates a special Context object for use with Contexto's extended context operations.

#### Parameters

 - `defaultValue`: The value provided to context consumers when there is no matching Provider
component above them in the component tree.
 - **optional** `contextId`: A unique string used to identify this context when "hot reloading"
 (aka "fast refresh") is enabled. If no identifier is provided then all Contexto context values
 reset on page refresh during development, so use of `contextId` is *strongly recommended*.
 - **optional** `displayName`: Set the `.displayName` property of the new context object.

#### Returns

`createContext` returns a **subscription context object** that can be read using
Contexto's `useContext` and `useContexts` hooks, and updated using imperative updates.

The context object has a few properties:

 - `MyContext.Provider` lets you specify a new scoped value in the component tree contained
 by the [Provider](#mysubscriptioncontextprovider).
 - `MyContext.Consumer` is an alternative way to read the context value using a render prop.
 - `MyContext.displayName` is a string used by React DevTools when displaying the context.

See [the React documentation on Context objects](https://reactjs.org/docs/context.html] for
more details on the standard operation of contexts using Providers and Consumers.

---

### `MySubscriptionContext.Provider`

Wrapping components with a context Provider specifies the value of the context for the components inside.

```javascript
function App() {
    // ...
    return (
        <MySubscriptionContext.Provider value={userDetails}>
            <Page/>
        </MySubscriptionContext.Provider>
    );
}
```

#### Props

 - `value`: The initial value to provide to all components reading the context within this Provider.
 If `value` is changed then all consumers within the Provider are notified of the updated value.
 - `initialValue`: The initial value to provide to all components reading the context within this Provider.
 Unlike `value`, changing this prop has no effect. If the special value `contexto.INHERIT` is passed to
 `initialValue` then the default value will be taken from the current value of the context in its
 containing scope.
  **Either `value` or `initialValue` must be supplied, but not both.**
 - **optional** `ref`: A ref object to receive a handle containing `update` (an imperative updater for
  the Provider) and `getSnapshot` (to access the Provider's current value).
  See [Imperative updates](#imperative-updates) for details on using `update`.

---

### `MySubscriptionContext.Consumer`

An alternative (legacy) way to read a context's value. Provided only for full compatibility claims –
you should use `useContext` instead.

```javascript
function UserSummary() {
    // Legacy way (not recommended)
    return (
        <MySubscriptionContext.Consumer>
            { user =>
                <div>
                    <a href={`/user/${user.id}`}>{user.name}</a>
                    <img src={user.iconUrl} />
                </div> }
        </MySubscriptionContext.Consumer>
    );
}
```

Newly written code should read context values using `useContext` instead:

```javascript
function UserSummary() {
    // Recommended way
    const user = useContext(MySubscriptionContext);
    return (
        <div>
            <a href={`/user/${user.id}`}>{user.name}</a>
            <img src={user.iconUrl} />
        </div>
    );
}
```

#### Props

 - `children`: A function (render prop). The component will render by calling the function
 with the current context value, and it should return a `ReactNode`.
 - **optional** `isEqual` A function to determine if the context value is unchanged.
 See [Selective subscriptions](#selective-subscriptions) for more details.

---

### `createCompatibleContext`

```javascript
const MyCompatibleContext = contexto.createCompatibleContext(defaultValue, { displayName?, contextId? }?);
```

Creates a special Context object for use with Contexto's extended context operations which is also
fully compatible with the standard React context operations, including [use by class components](https://reactjs.org/docs/context.html#classcontexttype).
This has performance considerations – see [Interoperability](#interoperability) for more details.

**Parameters and return value are the same as for (`createContext`)[#createcontext].**

---

### `createProxyContext`

```javascript
const MyProxyContext = contexto.createProxyContext(reactContext, { contextId? });
```

Wraps a standard `React.Context` object to create a special Context object suitable for use with
Contexto's `useContext` and `useContexts` hooks.

#### Parameters

 - **optional** `contextId`: A unique string used to identify this context.

#### Returns

`createProxyContext` returns a read-only **proxy context object** to allow contexts created outside the
Contexto ecosystem to be used with Contexto's consumer hooks. The return value contains a
`Consumer` but no `Provider`. See [Interoperability](#interoperability) for more details.

---

### `useContext`

```javascript
const value = useContext(MyContext, isEqual?);
```

Consume and subscribe to updates of a context's value in a function component.

#### Parameters

 - `MyContext`: A Contexto context previously created with `createContext` or `createProxyContext`.
 - **optional** `isEqual`: A function to determine if the context value is unchanged.
 See [Selective subscriptions](#selective-subscriptions) for more details.

#### Returns

`useContext` returns the context value for the calling component.
This is initially the latest value of the closest `MyContext.Provider` ancestor,
or the `defaultValue` of the context if there is no such ancestor.
The return value is updated when that `Provider` value changes, unless that new value
`isEqual` to the *existing return value*.

---

### `useContexts`

```javascript
const [valueA, valueB] = useContexts([ContextA, ContextB, ...], isEqual?);
const { valueX }       = useContexts({ valueX: ContextX, ... }, isEqual?);
```

Consume and subscribe to updates of multiple contexts' values in a function component.

#### Parameters

 - `ContextList` or `ContextObject`: A list or object containing zero or more Contexto
 contexts previously created with `createContext` or `createProxyContext`.
 - **optional** `isEqual`: A function to determine if a single context's value is unchanged.
 See [Selective subscriptions](#selective-subscriptions) for more details.

#### Returns

`useContexts` returns an array (or object) mapping each context in the input to the
latest value of its closest corresponding context Provider.
The return value is updated when any of the `Provider` values changes, unless the new
value `isEqual` to the corresponding existing value.

---

### `useContextUpdate`

```javascript
const update = useContextUpdate(MyContext);
```

Prepare a function to update the value of a Contexto context.

#### Parameters

 - `MyContext`: A Contexto context previously created with `createContext` or `createCompatibleContext`.

#### Returns

`useContextUpdate` returns a stable "imperative updater" function which updates the value of the
nearest Provider for the given context.  See [Imperative updates](#imperative-updates).

---

### `useBridgeValue` / `BridgeProvider`

```javascript
const bridgeValue = useBridgeValue([ContextA, ContextB, ...]);
// ...
<CustomRenderer>
    <BridgeProvider value={bridgeValue} children={/* ... */} />
</CustomRenderer>
```

Share a context scope between different renderers.

#### Parameters

 - `[ContextA, ContextB, ...]`: A list of Contexto contexts.

#### Returns

`useBridgeValue` returns an object that can be passed to a `<BridgeProvider>` to "bridge" one or
more contexts between different renderers. React does not propagate parent contexts to child
components within a different renderer, so a context bridge is required.

---

## Selective subscriptions

Each instance of `useContext`, `useContexts` or `Context.Consumer` subscribes to value updates,
with an associated function for determining whether the value has changed.

When a Provider's value is updated, Contexto consults each of the subscribers, using its equality
function to compare the new value to the previous value provided to the subscriber.
A subscriber is only notified of the update (and thus re-rendered) if its equality function returns false.

```javascript
function isJsonEqual(oldValue, newValue) {
    return JSON.stringify(oldValue) === JSON.stringify(newValue);
}
```

The equality function is always called with the previous value, the new value, and the Context object
associated with the Provider being compared.

This third parameter may be useful when subscribing to multiple contexts with `useContexts`,
if the different contexts require different notions of equality, e.g.

```javascript
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

---

## Imperative updates

When working with standard React contexts, the value propagated by each Provider is determined
entirely by what is passed to the Provider's `value` prop:

```javascript
const TickContext = createContext(0);

function useTick() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(tick => tick + 1), 1000);
        return () => clearInterval(id);
    }, [setTick]);
    return tick;
}

function App() {
    const tick = useTick();

    // When tick changes, everything is re-rendered even if nothing subscribes to `tick`,
    // because the children are re-created.
    return (
        <TickContext.Provider value={tick}>
            <DeepTree/>
            <OtherDeepTree/>
            {/* ... */}
        </TickContext.Provider>
    );
}
```

This expensive re-rendering can be avoided by packaging the context value management into
its own component, so that the `children` are created outside the Provider:

```javascript
function TickProvider({ children })
{
    const tick = useTick();
    return <TickContext.Provider value={tick} children={children} />;
}

function App() {
    // TickProvider can update its own value without re-rendering all the children.
    // Only components that subscribe to `tick` require reconciliation.
    return (
        <TickProvider>
            <DeepTree/>
            <OtherDeepTree/>
            {/* ... */}
        </TickProvider>
    );
}
```

This is entirely consistent with the fundamental React paradigm ... but it can be useful
to have an escape hatch! Contexto allows **imperative updates** using the updater functions
provided by `useContextUpdate` and the `update` method on Provider ref handles.

An imperative updater changes the value propagated by its associated Provider, and updating
all relevant subscribers, **but it does not change the `value` prop of the Provider**
and does not re-render the Provider itself.

An updater accepts a single parameter, which can be either the new value or a function
that prepares a new value given the previous value:

```javascript
const update = useContextUpdate(MyNumericContext);
update(123);            // MyNumericContext's value will be updated to 123
update(old => old * 2); // MyNumericContext's value will be updated to 246
```

This behaviour is modelled on the setter returned by the `useState` hook.
As with a `useState` setter, an updater is stable – it will not change for a
given Context within the calling component. We can build more complex functionality
on top of the raw updater:

```javascript
function useContextDispatch(SomeContext, reducer) {
    const update = useContextUpdate(SomeContext);
    return useCallback(
        (action) => update(state => reducer(state, action)),
        [update, reducer]
    );
}

function myReducer(state, action) {
    switch (action.type) {
        case "INCREMENT":
            return state + 1;
        case "DECREMENT":
            return state - 1;
        case "MULTIPLY":
            return state * action.payload;
        default:
            return state;
    }
}

const MyNumericContext = createContext(0);

function App() {
    return (
        <MyNumericContext.Provider value={0}>
            <ActionPanel/>
            <CurrentValue/>
        </MyNumericContext.Provider>
    );
}

function ActionPanel() {
    const dispatch = useContextDispatch(MyNumericContext, myReducer);

    return (
        <div>
            <button onClick={() => dispatch({ type: "INCREMENT" })}>Increment</button>
            <button onClick={() => dispatch({ type: "DECREMENT" })}>Decrement</button>
            <button onClick={() => dispatch({ type: "MULTIPLY", payload: 2 })}>Double</button>
            <button onClick={() => dispatch({ type: "MULTIPLY", payload: -1 })}>Negate</button>
        </div>
    );
}

function CurrentValue() {
    const value = useContext(MyNumericContext);
    return <div>Value: {value}</div>;
}
```

### Caveats

#### **Imperative updates cannot be applied to the default context value**
During development, `useContextUpdate` will throw an error if it is called without an appropriate
Provider above it in the component tree. In a production environment it will silently fail.

#### **Changing the `value` prop also causes an update**
Although the `value` prop in a Contexto Provider is not the "single source of truth", it can be
used to update the value. The most recent update "wins", regardless of whether the update was
imperative or prop-based. This behaviour can be avoided by initialising the Provider using
`initialValue` instead of `value`. This may be preferable in some cases e.g. to avoid memoising
the initial value.

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

---

## Interoperability

Although standard Contexto contexts look a lot like standard React contexts, they are not compatible.
Supplying a React context to `contexto.useContext` or a standard Contexto context to `React.useContext`
will lead to errors one way or another.

Contexto's `createCompatibleContext()` function creates an object which is both a React context
and a Contexto context. This means it can play nicely with legacy code or be passed to external libraries that have no knowledge of Contexto, while still giving you access to selective
subscriptions, `useContexts`, imperative updates and the rest.

Under the hood, this is achieved by essentially creating two contexts and two providers for each
Provider, and keeping the values synchronised. This has a non-zero performance impact so, although
it may not be noticeable for your application, this "compatibility mode" is opt-in.

In other cases, you may have a standard React context supplied by existing code which cannot be updated
to create a Contexto context instead.

Contexto offers the `createProxyContext()` function, which wraps the external context and returns an
object that can be passed to Contexto's `useContext` and `useContexts` functions. Although the
resulting "proxy context" is read-only – it does not have an associated Provider, and cannot be
imperatively updated – it can be used to take advantage of selective subscriptions and multiple
context ingestion.

---

## Example

```javascript
import React, { useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { createContext, useContext, useContextUpdate } from "contexto";

const CounterContext = createContext({});

const useMemberEqual = (id) =>
  useCallback((previous, current) => previous[id] === current[id], [id]);

const useMemberIncrement = (id) => {
  const update = useContextUpdate(CounterContext);

  return useCallback(
    () => update(values => ({ ...values, [id]: values[id] + 1 }),
    [update, id]));
};

function Counter({ id }) {
  const isMemberEqual = useMemberEqual(id);
  const increment     = useMemberIncrement(id);
  const count         = useContext(CounterContext, isMemberEqual)[id];

  return (
    <tr>
      <th>{id}:</th>
      <td>{count}</td>
      <td><button onClick={increment}>Increment</button></td>
      <th>Render #{++renderCounts[id]}</th>
    </tr>
  );
}
const renderCounts = { count1: 0, count2: 0 };

function App() {
  const ref = useRef();
  const initialCounts = { count1: 0, count2: 0 };

  return (
    <table>
      <tbody>
        <CounterContext.Provider initialValue={initialCounts} ref={ref}>
          <Counter id="count1" />
          <Counter id="count2" />
        </CounterContext.Provider>
        <button onClick={ () => ref.current.update(initialCounts) }>Reset counters</button>
      </tbody>
    </table>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
```

---

## Inspiration

See the wonderful work of [Dai Shi](https://github.com/dai-shi/), specifically [`useContextSelector`](https://github.com/dai-shi/use-context-selector/).