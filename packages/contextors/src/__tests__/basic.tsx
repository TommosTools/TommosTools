/* eslint-disable react/function-component-definition */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createContext } from "contexto";
import { createContextor, useContextor } from "..";

test("example", () =>
{
	const UserContext		= createContext({ id: 1, firstName: "John", lastName: "Smith" }, { contextId: "" });
	const selectUserName	= createContextor([UserContext], (user) => `${user.firstName} ${user.lastName}`);

	const UserNameComponent = ({ testId } : { testId: string }) => (
		<div data-testid={testId}>{ useContextor(selectUserName) }</div>
	);

	render(
		<UserContext.Provider value={{ id: 1, firstName: "John", lastName: "Smith" }}>
			<UserNameComponent testId="test" />
			<UserNameComponent testId="tet2" />
		</UserContext.Provider>
	);

	expect(screen.getByTestId("test")).toHaveTextContent("John Smith");
});

type User = {
	id:			string;
	firstName:	string;
	lastName:	string;
	groupIds:	string[];
};

type Group = {
	id:			string;
	name:		string;
};

test("basic test", () =>
{
	const UserContext	= createContext<User | null>(null, { contextId: "userContext" });
	const GroupsContext	= createContext<Group[]>([], { contextId: "groupsContext" });

	const selectGroupLookup = createContextor(
		[GroupsContext],
		(groups) => Object.fromEntries(groups.map((group) => [group.id, group]))
	);

	const selectUserSummary = createContextor(
		[UserContext, selectGroupLookup],
		(user, groupLookup) => (
			user && `${user.firstName} ${user.lastName} (${user.groupIds.map((id) => groupLookup[id].name).join(", ")})`
		)
	);

	const user1: User = {
		id: "1",
		firstName: "John",
		lastName: "Smith",
		groupIds: ["1", "3"],
	};
	const user2: User = {
		id: "2",
		firstName: "Mary",
		lastName: "Moore",
		groupIds: ["2"],
	};
	const groups: Group[] = [
		{ id: "1", name: "Admin" },
		{ id: "2", name: "Group Admin" },
		{ id: "3", name: "Tester" },
		{ id: "4", name: "Owner" },
	];

	const UserSummary = ({ testId } : { testId: string }) =>
	{
		const summary = useContextor(selectUserSummary);
		return <span data-testid={testId}>{summary}</span>;
	};

	render(
		<GroupsContext.Provider value={groups}>
			<UserContext.Provider value={user1}>
				<UserSummary testId="summary1" />
			</UserContext.Provider>
			<UserContext.Provider value={user2}>
				<UserSummary testId="summary2" />

				<UserContext.Provider value={user1}>
					<UserSummary testId="summary3" />
				</UserContext.Provider>
			</UserContext.Provider>
		</GroupsContext.Provider>
	);

	expect(screen.getByTestId("summary1")).toHaveTextContent("John Smith (Admin, Tester)");
	expect(screen.getByTestId("summary2")).toHaveTextContent("Mary Moore (Group Admin)");
	expect(screen.getByTestId("summary3")).toHaveTextContent("John Smith (Admin, Tester)");
});

test("Example from docs", () =>
{
	const UserContext = createContext({
		id: 1,
		firstName: "Henry",
		lastName: "Lemming",
		teamIds: [1, 3],
	}, { contextId: "users" });

	const TeamsContext = createContext([
		{ id: 1, name: "Builders" },
		{ id: 2, name: "Climbers" },
		{ id: 3, name: "Floaters" },
		{ id: 4, name: "Miners" },
	], { contextId: "teams" });

	const TeamsLookup = createContextor(
		[TeamsContext],
		(teams) => Object.fromEntries(teams.map((team) => [team.id, team]))
	);

	const UserSummary = createContextor(
		[UserContext, TeamsLookup],
		(user, teamsById) => ({
			name: `${user.firstName} ${user.lastName}`,
			teamNames: user.teamIds.map((id) => teamsById[id].name).join(", "),
		})
	);

	const UserSummaryComponent = () =>
	{
		const { name, teamNames } = useContextor(UserSummary);
		return (
			<div data-testid="content">
				<b>{name}</b>
				<span>{ ` (${teamNames || "No teams"})` }</span>
			</div>
		);
	};

	render(<UserSummaryComponent />);

	expect(screen.getByTestId("content")).toHaveTextContent("Henry Lemming (Builders, Floaters)");
});