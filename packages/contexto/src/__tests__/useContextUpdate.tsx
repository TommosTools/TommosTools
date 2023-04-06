/* eslint-disable react/function-component-definition */

/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { createContext, useContext, useContextUpdate } from "..";
import { Context } from "../types";

// eslint-disable-next-line @typescript-eslint/comma-dangle
const Render = <T,>({ context, testId }: { context: Context<T>, testId?: string }) => (
	<div>
		<span role="heading" aria-level={1}>{ context.displayName }</span>
		<span role="definition" data-testid={testId}>{ JSON.stringify(useContext(context)) }</span>
	</div>
);

test("Can update context using useContextUpdate()", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("default value", { contextId: "test2" });

	const ComponentWithClickToUpdate = ({ value, testId }: { value: string, testId?: string }) =>
	{
		const update = useContextUpdate(Context1);
		return <button type="button" data-testid={testId} onClick={() => update(value)}>clickable</button>;
	};

	render(
		<Context1.Provider value="value1">
			<ComponentWithClickToUpdate testId="Click1" value="clickedValue1" />
			<ComponentWithClickToUpdate testId="Click2" value="clickedValue2" />
			<Render context={Context1} testId="Context1.Provider" />
		</Context1.Provider>
	);

	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("value1");

	await user.click(screen.getByTestId("Click1"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("clickedValue1");

	await user.click(screen.getByTestId("Click2"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("clickedValue2");
});