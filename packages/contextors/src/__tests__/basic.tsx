/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { act } from "react-dom/test-utils";
import { createContext } from "contexto";
import { createContextor, useContextor } from "..";


test("example", () =>
	{
		const UserContext		= createContext({ id: 1, firstName: "John", lastName: "Smith" }, { contextId: "" });
		const selectUserName	= createContextor([UserContext], ([user]) => `${user.firstName} ${user.lastName}`);

		const UserNameComponent = ({ testId } : { testId: string }) =>
			<div data-testid={testId}>{ useContextor(selectUserName) }</div>

		render(<UserContext.Provider value={{ id: 1, firstName: "John", lastName: "Smith" }}>
			<UserNameComponent testId="test" />
			<UserNameComponent testId="tet2" />
		</UserContext.Provider>);

		expect(screen.getByTestId("test")).toHaveTextContent("John Smith");
	});

type User = {
	id:			string;
	firstName:	string;
	lastName:	string;
	groupIds:	string[];
}

type Group = {
	id:			string;
	name:		string;
}

const UserContext	= createContext<User | null>(null, { contextId: "userContext" });
const GroupsContext	= createContext<Group[]>([], { contextId: "groupsContext" });

const selectGroupLookup = createContextor(
	[GroupsContext],
	([groups]) => Object.fromEntries(groups.map(group => [group.id, group]))
);

const selectUserSummary = createContextor(
	[UserContext, selectGroupLookup],
	([user, groupLookup]) => (
		user && `${user.firstName} ${user.lastName} (${ user.groupIds.map(id => groupLookup[id].name).join(", ") })`
	)
);

test("basic test", () =>
	{
		const user1: User = { id: "1", firstName: "John", lastName: "Smith", groupIds: ["1","3"] };
		const user2: User = { id: "2", firstName: "Mary", lastName: "Moore", groupIds: ["2"] };
		const groups: Group[] = [
			{ id: "1", name: "Admin" },
			{ id: "2", name: "Group Admin" },
			{ id: "3", name: "Tester" },
			{ id: "4", name: "Owner" },
		];

		const UserSummary = ({ testId } : { testId: string }) =>
			{
				const summary = useContextor(selectUserSummary);
				return <span data-testid={testId}>{summary}</span>
			}

		render(
			<GroupsContext.Provider value={groups}>
				<UserContext.Provider value={user1}>
					<UserSummary testId="summary1"/>
				</UserContext.Provider>
				<UserContext.Provider value={user2}>
					<UserSummary testId="summary2"/>

					<UserContext.Provider value={user1}>
						<UserSummary testId="summary3"/>
					</UserContext.Provider>
				</UserContext.Provider>
			</GroupsContext.Provider>
		);

		expect(screen.getByTestId("summary1")).toHaveTextContent("John Smith (Admin, Tester)");
		expect(screen.getByTestId("summary2")).toHaveTextContent("Mary Moore (Group Admin)");
		expect(screen.getByTestId("summary3")).toHaveTextContent("John Smith (Admin, Tester)");
	});