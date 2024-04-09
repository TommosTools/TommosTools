[contextors](.)
==========

# Integration with Redux

It's straightforward to use the Redux store in contextors, simply by defining
a context provider that subscribes to the store's value:

```javascript
    const ReduxContext = contexto.createContext({});

    const ReduxProvider = ({ children }) => {
      const rootState = useSelector(state => state);
      return <ReduxContext.Provider value={rootState} children={children} />
    }

    const MyContextor = createContextor(
      [ReduxContext, SomeContextor],
      (rootStore, someValue) => { /* ... */ }
    );
```