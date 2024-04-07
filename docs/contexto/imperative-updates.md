contexto
========

## Imperative updates

This page describes a distinctly "non-Reacty" alternative to modifying the top-level context value
when using the [Contexto library](../).


When working with standard React contexts, the value propagated by each Provider is determined
entirely by what is passed to the Provider's `value` prop:

```jsx
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

```jsx
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

```jsx
const update = useContextUpdate(MyNumericContext);
update(123);            // MyNumericContext's value will be updated to 123
update(old => old * 2); // MyNumericContext's value will be updated to 246
```

This behaviour is modelled on the setter returned by the `useState` hook.
As with a `useState` setter, an updater is stable – it will not change for a
given Context within the calling component. We can build more complex functionality
on top of the raw updater:

```jsx
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
