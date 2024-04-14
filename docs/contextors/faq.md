[contextors](.)
==========

# Frequently Asked Questions

This page describes some common issues encountered with the [contextors library](.)

== Why isn't TypeScript giving me any type completion with my contextors?

Ensure that you have [strict null checks](https://www.typescriptlang.org/tsconfig#strictNullChecks)
enabled in your project.  `contextors`'s type definitions do not currently
play nicely when null checks are disabled.

== Why am I seeing more updates/renders than expected?

If you're using the React 18+ with [strict mode](https://react.dev/reference/react/StrictMode)
enabled, then the development server re-renders components and re-runs effects
to help identify problems due to "impure rendering".  These behaviours are not
present in the production build of your app.  You can also check that the behaviour
is as expected during development by (temporarily) removing the `<StrictMode>`
wrappers from your app.

== I think I've found a bug.  What do I do now?

Bugs / issues / feature requests / etc are managed through Github's
[issue tracker](https://github.com/TommosTools/TommosTools/issues).
