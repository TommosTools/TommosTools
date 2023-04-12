contextors
==========

A library for creating memoised \"context selector\" functions

## Basic Usage

    const UserContext = contexto.createContext({ id: 1, firstName: "John", lastName: "Smith" });

    const selectUserName = createContextor(
      [UserContext],
      ([user]) => `${user.firstName} ${user.lastName}`
    );

    const UserNameComponent = () =>
      <div>{ useContextor(selectUserName) }</div>

## Advanced Usage

Contextors can be created 