[contextors](.)
==========

# API

This page describes the functions provided by the [contextors library](.).

* [`createContextor`](#createContextor)
* [`useContextor`](#useContextor)

---

### <a name="createContextor"></a>`createContextor`

```jsx
const MyContextor = createContextor(SourceArray, combiner, { isEqual? }?);
```

Creates a contextor for use with the `useContextor` hook.

#### <a name="createContextor.parameters"></a>Parameters

 - `SourceArray`: An array containing [Contexto](../contexto) context objects and/or
other contextors.
 - `combiner(...sourceValues, tag?)`: A function that returns a value when
provided with inputs from the sources (which will include the optional
[tag argument](tagged) to `useContextor`, if supplied).
 - **optional** `isEqual([...values1, tag1], [...values2, tag2])`: A function that
returns `true` if two lists of inputs would produce the same output from the
combining function.  If provided, `isEqual` is called whenever a source's output
changes, and the combining function is called only if `isEqual(..)` returns `false`.
This overrides the default [caching mechanism](caching).

#### <a name="createContextor.returns"></a>Returns

`createContextor` returns a contextor that can be provided to `useContextor` or
used in the construction of other contextors.

### <a name="useContextor"></a>`useContextor`

```jsx
const value = useContextor(SomeContextor, tag?);
```

Call `useContextor` at the top level of your component (or from with a hook)
to read and subscribe to a contextor.

#### <a name="useContextor.parameters"></a>Parameters

 - `SomeContextor`: The contextor previously created with
 [`createContextor`](#createContextor).
 - **optional** `tag`: A value provided alongside the other inputs when the
contextor's `combiner` function is called.