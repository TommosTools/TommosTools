[contextors](.)
==========

# Caching

This page describes caching within the [contextors library](.)

Each contextor caches the results of previous evaluations, based on previous
source values.  The cache is shared between all consumers of a contextor
anywhere in the app.

The precise caching behaviour depends on the types of the sources
(i.e. the values of the contextor's dependent contexts and contextors,
and the [tag](tagged) if any):

 - If all sources provide `object` values, the contextor will always provide
   the same output for those source values:

```jsx
    const ObjectContext = createContext({});
    let testId = 0;

    const ContextorA = createContextor(
      [ObjectContext],
      (value, objTag) => { console.log("compute", testId); return [value, objTag]; }
    );
    
    const useTestContextorA = () => {
      const obj1 = { foo: "bar" };
      const obj2 = { foo: "bar" };

      testId = 1; useContextor(ContextorA, obj1);  // compute 1
      testId = 2; useContextor(ContextorA, obj2);  // compute 2
      testId = 3; useContextor(ContextorA, obj1);  // (no output, same as compute 1)
    }
```

 - If all sources provide non-`object` values, the contextor caches the most
   recent output, which it returns only if the sources provide the same value
   as previously (i.e. memoization)

```jsx
    const StringContext = createContext("");
    let testId = 0;

    const ContextorB = createContextor(
      [StringContext],
      (value, numTag) => { console.log("compute", testId); return [value, numTag]; }
    );
    
    const useTestContextorB = () => {
      testId = 1; useContextor(ContextorB, 1); // compute 1
      testId = 2; useContextor(ContextorB, 2); // compute 2
      testId = 3; useContextor(ContextorB, 1); // compute 3
      testId = 4; useContextor(ContextorB, 1); // (no output, same as compute 3)
    }
```

 - If the sources provide both `object` and non-`object` values then a
   combination caching strategy is employed – the last value for each
   combination of `object` values is memoized, keyed by the
   non-`object` values:

```jsx
    const ObjectContext = createContext({});
    const ContextorC = createContextor([ObjectContext], (value, numTag) => [value, numTag]);

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