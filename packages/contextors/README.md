contextors
==========

A library for creating "contextors", which efficiently select and combine values
from React contexts.

 - **Contextors combine the values of multiple contexts** to compute a single value
 which is updated when any of its input values change.
 - **Contextors are efficient and stable.** A contextor will always produce the same
 output given the same input values.
 - **Contextors are composable.** They can be used as inputs to other contextors.
 - **Contextors can be parameterized.** A contextor's combining function can accept an
 extra parameter alongside the context-dependent input values.

## Basic Usage

    # Create a contextor from data sources (contexts and/or other contextors)
    const contextor =
      createContextor([...sources], (...sourceValues, arg) => combinedValue);

    # Within a component, subscribe to the computed local value of a contextor
    const value = useContextor(contextor, arg);

## Simple example

    # Create some Contexts
    const UserContext  = contexto.createContext({
      firstName: "Henry",
      lastName:  "Lemming",
      teamIds:   [1, 3],
    });
    const TeamsContext = contexto.createContext([
      { id: 1, name: "Builders" },
      { id: 2, name: "Climbers" },
      { id: 3, name: "Floaters" },
      { id: 4, name: "Miners"   },
    ]);

    # Create a Contextor that takes a TeamsContext value,
    # and returns a value derived from that
    const TeamsLookup = createContextor(
      [TeamsContext],
      (teams) => Object.fromEntries(teams.map(team => [team.id, team]))
    );

    # Create a Contextor that takes values from UserContext and a different Contextor,
    # and returns a value derived from those
    const UserSummary = createContextor(
      [UserContext, TeamsLookup],
      (user, teamsById) => ({
        name:      `${user.firstName} ${user.lastName}`,
        teamNames: user.teamIds.map(id => teamsById[id].name).join(", ")
      })
    );

    # The useContextor hook subscribes to the local values of all contexts
    # required to evaluate the given Contextor
    function UserNameComponent() {
      const { name, teamNames } = useContextor(UserSummary);
      return <div><b>{name}</b> ({ teamNames || "no teams" })</div>;
    }

## Computing data with contextors

Contextors are constructed using `createContextor`. They require an array of inputs,
each of which is a Contextor or a `Contexto.Context` object, and a combining function,
which returns data based on the current values associated with those inputs.

A very simple contextor might depend on the value of a single context:

    const BookCount =
      createContextor(
        [BooksContext],           // A context defined somewhere
        (books) => books.length   // Operates on the local value of the context
      );

More complex contextors can depend on the values of multiple contexts:

    const CurrentBook =
      createContextor(
        [CurrentBookIdContext, BooksContext],
        (currentBookId, books) =>
          books.filter(book => book.id === currentBookId)[0]
      );

Contextors can also depend on the values of other contextors:

    const BookSummary =
      createContextor(
        [CurrentBook, AuthorsContext],
        (book, authors) => ({
          title:  book.title,
          author: authors.filter(book.authorId === author.id)
        })
      );

## Parameterized contextors

A contextor can accept an extra argument in its combining function. This argument must
be provided as a second argument to `useContextor`:

    const PAGE_SIZE = 5;

    const ListPager = createContextor(
      [ItemList],
      (itemList, begin) => itemList.slice(begin, begin + PAGE_SIZE)
    );

    const PageDisplay = ({ begin = 0 }) =>
      {
        const items = useContextor(ListPager, begin)
        return (<>
          { items.map((item, i) =>
            <Item key={i} item={item} /> }
        </>);
      };

The argument supplied to `useContextor` is passed to all contextors that are
dependencies of the primary contextor. It's important that the expected arguments
to the contextors are compatible – this is enforced if you're using the TypeScript
interface:

    const MultiplyContextor = createContextor(
      [NumberContext],
      (contextValue: number, arg: number) => contextValue * arg
    );

    const SubtractContextor = createContextor(
      [MultiplyContextor],
    // NO TYPE ERROR
      (multipliedValue: number, arg: number) => multipliedValue - arg
    );

    const IncompatibleContextor = createContextor(
      [MultiplyContextor],
    // TYPE ERROR: arg of type string is not compatible with arg of type number
      (multipliedValue: number, arg: string) => arg.repeat(multipliedValue)
    )

## Caching

Each contextor caches the results of previous evaluations, based on previous input values.
The cache is shared between all consumers of a contextor anywhere in the app.

The precise caching behaviour depends on the types of the inputs (i.e. the values of
the contextor's dependent contexts and contextors, and the argument if any):

 - If all inputs are `object` values, the contextor will always provide the same output
   for those inputs:

```javascript
    const ObjectContext = createContext({});
    let testId = 0;

    const ContextorA = createContextor(
      [ObjectContext],
      (value, objArg) => { console.log("compute", testId); return [value, objArg]; }
    );
    
    const useTestContextorA = () => {
      const obj1 = { foo: "bar" };
      const obj2 = { foo: "bar" };

      testId = 1; useContextor(ContextorA, obj1);  // compute 1
      testId = 2; useContextor(ContextorA, obj2);  // compute 2
      testId = 3; useContextor(ContextorA, obj1);  // (no output, same as compute 1)
    }
```

 - If all inputs are non-`object` values, the contextor caches the most recent output,
   which it returns only if the inputs match their values in the previous evaluation
   (i.e. memoization)

```javascript
    const StringContext = createContext("");
    let testId = 0;

    const ContextorB = createContextor(
      [StringContext],
      (value, numArg) => { console.log("compute", testId); return [value, numArg]; }
    );
    
    const useTestContextorB = () => {
      testId = 1; useContextor(ContextorB, 1); // compute 1
      testId = 2; useContextor(ContextorB, 2); // compute 2
      testId = 3; useContextor(ContextorB, 1); // compute 3
      testId = 4; useContextor(ContextorB, 1); // (no output, same as compute 3)
    }
```

 - If the inputs contain both `object` and non-`object` values then a combination caching
   strategy is employed – the last value for each combination of `object` values is memoized,
   keyed by the non-`object` values:

```javascript
    const ObjectContext = createContext({});
    const ContextorC = createContextor([ObjectContext], (value, numArg) => [value, numArg]);

    const TestContextorC = ({ id, num }) => {
      testId = id;
      useContextor(ContextorC, num);
      return null;
    }

    const obj1 = { foo: "bar" };
    const obj2 = { foo: "bar" };

    const Test = () => <>
      <ObjectContext.Provider value={obj1}>
        <TestContextorC id={1} num={1} /> {/* compute 1 */}
        <TestContextorC id={2} num={2} /> {/* compute 2 */}
        <TestContextorC id={3} num={1} /> {/* compute 3 */}
      </ObjectContext.Provider>
      <ObjectContext.Provider value={obj2}>
        <TestContextorC id={4} num={1} /> {/* compute 4 */}
        <TestContextorC id={5} num={2} /> {/* compute 5 */}
        <TestContextorC id={6} num={1} /> {/* compute 6 */}
      </ObjectContext.Provider>
      <ObjectContext.Provider value={obj1}>
        <TestContextorC id={7} num={1} /> {/* (no output, same as compute 3) */}
      </ObjectContext.Provider>
      <ObjectContext.Provider value={obj2}>
        <TestContextorC id={8} num={1} /> {/* (no output, same as compute 6) */}
      </ObjectContext.Provider>
    </>
```

## Typescript support

Contextors are implemented in TypeScript, and enforce type safety on contextor
creation and usage.

## Formik-like example

    const FormContext = createContext({});

    const FormContextProvider = ({ initialValues, initialTouched, children }) =>
    {
      const [values, setValues]   = useState(initialValues || {});
      const [touched, setTouched] = useState(initialTouched || {});

      return <FormContext.Provider value={{ values, setValues, setTouched }} children={children} />;
    }

    const FieldValue = createContextor(
      [FormContext],
      ({ values }, fieldName) => values[fieldName])
    );
    const FieldTouched = createContextor(
      [FormContext],
      ({ touched }, fieldName) => touched[fieldName])
    );

    const FieldGetters = createContextor(
      [FieldValue, FieldTouched],
      (value, touched, fieldName) => ({ value, touched })
    );

    const FieldSetters = createContextor(
      [FormContext],
      ({ setValues, setTouched }, fieldName) => {
        const setFieldTouched = (isTouched) => {
          setTouched(touched => ({ ...touched, [fieldName]: isTouched }));
        };
        const setFieldValue = (value) => {
          setValues(values => ({ ...values, [fieldName]: value }));
          setFieldTouched(true);
        };
        return { setFieldValue, setFieldTouched };
      }
    );

    const FieldUtil = createContextor(
      [FieldGetters, FieldSetters],
      (getters, setters, fieldName) => ({ ...getters, ...setters })
    );

    const TextInput = (fieldName) => {
      const { value, touched, setValue } = useContextor(FieldUtil, fieldName);

      return <>
        <input value={value} onChange={ e => setValue(e.target.value) } />
        { touched && "*" }
      </>
    };

## Integration with redux

It's straightforward to use the Redux store in contextors, simply by defining
a context provider that subscribes to the store's value, and using that context
as a contextor source:

    const ReduxContext = contexto.createContext({});

    const ReduxProvider = ({ children }) => {
      const store = useStore();
      return <ReduxContext.Provider value={store} children={children} />
    }

    const MyContextor = createContextor(
      [ReduxContext, SomeContextor],
      (store, someValue) => { /* ... */ }
    );

TODO FIXME -- rename inputs to "sources" / "sourceValues"


## Advanced Usage

Contextors can be created 

## Contextors vs selectors