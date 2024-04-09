[contextors](.)
==========

# Computing and combining data with contextors

This page describes how to define contextors in the [contextors library](.).

Contextors are constructed using `createContextor`. They require an array of
sources, each of which is a Contextor or a `Contexto.Context` object,
and a combining function, which returns data based on the current values
associated with those sources.

Typically your contextors would be defined at the module level, similar to
React contexts.

A very simple contextor might depend on the value of a single context:

```jsx
    const BookCount =
      createContextor(
        [BooksContext],           // A context defined somewhere
        (books) => books.length   // Operates on the local value of the context
      );
```

More complex contextors can depend on the values of multiple contexts:

```jsx
    const CurrentBook =
      createContextor(
        [CurrentBookIdContext, BooksContext],
        (currentBookId, books) =>
          books.filter(book => book.id === currentBookId)[0]
      );
```

Contextors can also depend on the values of other contextors:

```jsx
    const BookSummary =
      createContextor(
        [CurrentBook, AuthorsContext],
        (book, authors) => ({
          title:  book.title,
          author: authors.filter(book.authorId === author.id)
        })
      );
```