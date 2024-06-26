
[contextors](.)
==========

# Simple example

```jsx
    // Create some Contexts
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

    // Create a Contextor that takes a TeamsContext value,
    // and returns a value derived from that.
    const TeamsLookup = createContextor(
      [TeamsContext],
      (teams) => Object.fromEntries(teams.map(team => [team.id, team]))
    );

    // Create a Contextor that takes values from UserContext and a different Contextor,
    // and returns a value derived from those.
    const UserSummary = createContextor(
      [UserContext, TeamsLookup],
      (user, teamsById) => ({
        name:      `${user.firstName} ${user.lastName}`,
        teamNames: user.teamIds.map(id => teamsById[id].name).join(", ")
      })
    );

    // The useContextor hook subscribes to the local values of all contexts
    // required to evaluate the given Contextor
    function UserNameComponent() {
      const { name, teamNames } = useContextor(UserSummary);
      return <div><b>{name}</b> ({ teamNames || "no teams" })</div>;
    }
```