[contextors](.)
==========

# Tagged contextors

`useContextor` accepts a second argument, called a _tag_.
This tag value is passed as an additional input when evaluating the
contextor's combining function:

```jsx
    const PAGE_SIZE = 5;

    const ListPager = createContextor(
      [ItemList],
      (itemList, begin /* tag */) => itemList.slice(begin, begin + PAGE_SIZE)
    );

    const PageDisplay = ({ offset = 0 }) =>
      {
        const items = useContextor(ListPager, offset /* tag */);
        return (<>
          { items.map((item, i) =>
            <Item key={i} item={item} /> }
        </>);
      };
```

The tag supplied to `useContextor` is passed to all contextors that are
dependencies of the primary contextor.  It's important that the expected
arguments to the contextors are compatible – this is enforced if you're using
the TypeScript interface:

```jsx
    const MultiplyContextor = createContextor(
      [NumberContext],
      (contextValue: number, tag: number) => contextValue * tag
    );

    const SubtractContextor = createContextor(
      [MultiplyContextor],
    // NO TYPE ERROR
      (multipliedValue: number, tag: number) => multipliedValue - tag
    );

    const IncompatibleContextor = createContextor(
      [MultiplyContextor],
    // TYPE ERROR: tag arg of type string is not compatible with tag of type number
      (multipliedValue: number, tag: string) => tag.repeat(multipliedValue)
    )
```

For purposes of evaluation and [caching](caching), the tag is equivalent to
other inputs -- any change in the value will cause the contextor to be
re-evaluated, so the tag value should be
[stable](https://react.dev/reference/react/useMemo#skipping-re-rendering-of-components).

```jsx
    const MyContextor = createContextor(
      [SomeContext],
      (contextValue, extra) => ({ ...contextValue, ...extra })
    );

    function Unstable() {
      // Component will re-render indefinitely because object is re-constructed
      // when the component is rendered, causing the contextor to be re-evaluated,
      // causing the component to be re-rendered ....
      const value = useContextor(MyContextor, { foo: 123 });
      return <>unstable value: {value}</>
    }

    const fixedFooValue = { foo: 123 };

    function Stable() {
      // fixedFooValue does not change, so the contextor is only re-evaluated
      // when MyContextor's inputs update
      const value = useContextor(MyContextor, fixedFooValue);
      return <>stable value: {value}</>
    }
```

Different components may subscribe simultaneously to the same contextor,
using independent tag values.  Shared caching rules still apply, so
separate subscribers to a contextor using the same tag will receive the
same value produced by a single evaluation of the combiner function:

```jsx
    const ExpensiveContextor = createContextor(
      [Source],
      (source, id) => doSomethingExpensive(source, id)
    );

    function Component({ id }) {
      const value = useContextor(ExpensiveContextor, id);
      return <>{value}</>
    }

    function App() {
      return (
        // For each Source value,
        // doSomethingExpensive() will only be evaluated once for each unique id.
        <>
          <Component id="123" />
          <Component id="000" />
          <Component id="123" />
          <Component id="000" />
        </>
      );
    }

```