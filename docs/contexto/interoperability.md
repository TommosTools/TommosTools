[contexto](.)
========

# Interoperability

This page discusses the interoperability considerations for the [Contexto library](.).


Although standard Contexto contexts look a lot like standard React contexts, they are not compatible.
Supplying a React context to [`contexto.useContext`](api#useContext) or a standard Contexto context to [`React.useContext`](https://react.dev/reference/react/useContext)
will lead to errors one way or another.

Contexto's [`createCompatibleContext()`](api#createCompatibleContext) function creates an object which is both a React context
and a Contexto context. This means it can play nicely with legacy code or be passed to external libraries that have no knowledge of Contexto, while still giving you access to selective
subscriptions, `useContexts`, imperative updates and the rest.

Under the hood, this is achieved by essentially creating two contexts and two providers for each
Provider, and keeping the values synchronised. This has a non-zero performance impact so, although
it may not be noticeable for your application, this "compatibility mode" is opt-in.

In other cases, you may have a standard React context supplied by existing code which cannot be updated
to create a Contexto context instead.

Contexto offers the [`createProxyContext()`](api#createProxyContext) function, which wraps the external context and returns an
object that can be passed to Contexto's [`useContext`](api#useContext) and [`useContexts`](api#useContexts) functions. Although the
resulting "proxy context" is read-only – it does not have an associated Provider, and cannot be
imperatively updated – it can be used to take advantage of selective subscriptions and multiple
context ingestion.
