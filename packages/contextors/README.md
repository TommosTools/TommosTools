contextors
==========

A library for creating memoised \"context selector\" functions

## Basic Usage

    const UserContext  = contexto.createContext({ id: 1, firstName: "Henry", lastName: "Lemming", teamIds: [1, 3] });
    const TeamsContext = contexto.createContext([
      { id: 1, name: "Builders" },
      { id: 2, name: "Climbers" },
      { id: 3, name: "Floaters" },
      { id: 4, name: "Miners" }
    ]);

    const TeamsLookup = createContextor(
      [TeamsContext],
      ([teams]) => Object.fromEntries(teams.map(team => [team.id, team]))
    );

    const UserSummary = createContextor(
      [UserContext, TeamsLookup],
      ([user, teamsById]) => ({
        name:      `${user.firstName} ${user.lastName}`,
        teamNames: user.teamIds.map(id => teamsById[id].name).join(", ")
      })
    )
    const UserNameComponent = () => {
      const { name, teamNames } = useContextor(UserSummary);
      return <div><b>{name}</b> ({ teamNames || "no teams" })</div>;
    }

## Advanced Usage

Contextors can be created 