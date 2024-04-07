contexto
========

# API

This page describes the functions and associated components provided by the [Contexto library](../).


### <a name="createContext"></a>`createContext`

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
 by the [Provider](#Provider).
 - `MyContext.Consumer` is an alternative way to read the context value using a render prop.
 - `MyContext.displayName` is a string used by React DevTools when displaying the context.

See [the React documentation on Context objects](https://reactjs.org/docs/context.html] for
more details on the standard operation of contexts using Providers and Consumers.

---

### <a name="Provider"></a>`MySubscriptionContext.Provider`

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
  See [Imperative updates](../imperative-updates/) for details on using `update`.

---

### <a name="Consumer"></a>`MySubscriptionContext.Consumer`

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
 See [Selective subscriptions](../selective-subscriptions/) for more details.

---

### <a name="createCompatibleContext"></a>`createCompatibleContext`

```javascript
const MyCompatibleContext = contexto.createCompatibleContext(defaultValue, { displayName?, contextId? }?);
```

Creates a special Context object for use with Contexto's extended context operations which is also
fully compatible with the standard React context operations, including [use by class components](https://reactjs.org/docs/context.html#classcontexttype).
This has performance considerations – see [Interoperability](../interoperability/) for more details.

**Parameters and return value are the same as for (`createContext`)[#createcontext].**

---

### <a name="createProxyContext"></a>`createProxyContext`

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
`Consumer` but no `Provider`. See [Interoperability](../interoperability/) for more details.

---

### <a name="useContext"></a>`useContext`

```javascript
const value = useContext(MyContext, isEqual?);
```

Consume and subscribe to updates of a context's value in a function component.

#### Parameters

 - `MyContext`: A Contexto context previously created with `createContext` or `createProxyContext`.
 - **optional** `isEqual`: A function to determine if the context value is unchanged.
 See [Selective subscriptions](../selective-subscriptions/) for more details.

#### Returns

`useContext` returns the context value for the calling component.
This is initially the latest value of the closest `MyContext.Provider` ancestor,
or the `defaultValue` of the context if there is no such ancestor.
The return value is updated when that `Provider` value changes, unless that new value
`isEqual` to the *existing return value*.

---

### <a name="useContexts"></a>`useContexts`

```javascript
const [valueA, valueB] = useContexts([ContextA, ContextB, ...], isEqual?);
const { valueX }       = useContexts({ valueX: ContextX, ... }, isEqual?);
```

Consume and subscribe to updates of multiple contexts' values in a function component.

#### Parameters

 - `ContextList` or `ContextObject`: A list or object containing zero or more Contexto
 contexts previously created with `createContext` or `createProxyContext`.
 - **optional** `isEqual`: A function to determine if a single context's value is unchanged.
 See [Selective subscriptions](../selective-subscriptions/) for more details.

#### Returns

`useContexts` returns an array (or object) mapping each context in the input to the
latest value of its closest corresponding context Provider.
The return value is updated when any of the `Provider` values changes, unless the new
value `isEqual` to the corresponding existing value.

---

### <a name="useContextUpdate"></a>`useContextUpdate`

```javascript
const update = useContextUpdate(MyContext);
```

Prepare a function to update the value of a Contexto context.

#### Parameters

 - `MyContext`: A Contexto context previously created with `createContext` or `createCompatibleContext`.

#### Returns

`useContextUpdate` returns a stable "imperative updater" function which updates the value of the
nearest Provider for the given context.  See [Imperative updates](../imperative-updates/).

---

### <a name="useBridgeValue"></a>`useBridgeValue` / `BridgeProvider`

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


