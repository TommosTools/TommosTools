contextors
==========

[![npm](https://img.shields.io/npm/v/contextors)](https://www.npmjs.com/package/contextors)
[![size](https://img.shields.io/bundlephobia/minzip/contextors)](https://bundlephobia.com/result?p=contextors)

A library for creating "contextors", which efficiently select and combine values
from React contexts.

 - **Contextors combine the values of multiple contexts** to compute a single value
 which is updated when any of its source values change.
 - **Contextors are efficient and stable.** A contextor will [always produce the same
 output](https://tommostools.github.io/TommosTools/contextors/caching) given the same source values.
 - **Contextors are composable.** They can be used as [sources to other contextors](https://tommostools.github.io/TommosTools/contextors/combining).
 - **Contextors can be parameterized.** A contextor's combining function can accept an
 extra parameter (called a [tag](https://tommostools.github.io/TommosTools/contextors/tagged)) alongside the context-dependent source values.

`contextors` makes use of the [Contexto library](https://www.npmjs.com/package/contexto) to
provide fast, targeted state updates to only the components that need to be notified.

---

## <a name="basic-usage"></a>Basic Usage

```jsx
    // Create a contextor from one or more contexts
    const Contextor1 =
      createContextor(
        [MyContext],
        (myContextValue) => myContextValue.foo
      );

    // Contextors can depend on other contextors
    const Contextor2 =
      createContextor(
        [Contextor1, MyOtherContext],
        (val1, myOtherVal) => val1 + myOtherVal.bar
      );

    // We then read the contextors' values with the `useContextor` hook:
    const Component = () => {
      const value1 = useContextor(Contextor1);
      const value2 = useContextor(Contextor2);

      return <div>{`${value1} / ${value2}`}</div>
    }

    // Contextors can accept a parameter ...
    const UserContextor =
      createContextor(
        [AllUsersContext],
        (allUsers, userId) => allUsers[userId]);

    // ... which is provided to `useContextor`:
    const UserDisplay = ({ userId }) => {
      const userObject = useContextor(UserContextor, userId);

      return <div>{userObject.name}: {userObject.status}</div>
    }
```

## <a name="typescript"></a>Typescript support

Contextors are implemented in TypeScript, and enforce type safety on contextor
creation and usage.

## Installation

[Contexto](https://www.npmjs.com/package/contexto), and thus `contextors`,
is compatible with
[React](https://react.dev/) 16.8+,
[React Native](https://reactnative.dev/) 16.8+
and [Preact](https://preactjs.com/) 10+.

Once you've [installed Contexto](https://github.com/TommosTools/TommosTools/tree/main/packages/contexto#installation),
you can just:

```bash
npm install contextors
```
or
```bash
yarn add contextors
```

## <a name="documentation"></a>Documentation

 * [Computing and combining data with contextors](https://tommostools.github.io/TommosTools/contextors/combining)
 * [Tagged contextors](https://tommostools.github.io/TommosTools/contextors/tagged)
 * [Caching](https://tommostools.github.io/TommosTools/contextors/caching)
 * [Simple example](https://tommostools.github.io/TommosTools/contextors/simple-example)
 * [Formik-like example](https://tommostools.github.io/TommosTools/contextors/formik-example)
 * [Integration with Redux](https://tommostools.github.io/TommosTools/contextors/redux)
 * [Contextors vs selectors](https://tommostools.github.io/TommosTools/contextors/selectors)
