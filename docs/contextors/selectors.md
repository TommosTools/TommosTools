[contextors](.)
==========

# Contextors vs selectors

The [contextors library](.) is heavily inspired by
[Redux's selectors](https://redux.js.org/usage/deriving-data-selectors)
particularly the superb [reselect](https://www.npmjs.com/package/reselect),
with the main difference being the scoping of data.

Selectors operate on the Redux store, which contains data available to the
entire application.  Contextors operate on local context values, allowing
the associated data to be scoped appropriately, and for the same selector-like
logic to be reused within the app within different scopes.