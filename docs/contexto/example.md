contexto
========

# Example

The following is a small working example of a React app that uses the [Contexto library](../).

```jsx
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
