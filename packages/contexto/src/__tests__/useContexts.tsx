/* eslint-disable react/function-component-definition, 	@typescript-eslint/quotes */

import { FC, useState } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { createContext, useContexts } from "..";
import { ContextDict, ContextTuple } from "../types";

const Button: FC<{ testId: string, onClick: () => void, label: string }> = ({ testId, onClick, label }) => (
	<button type="button" data-testid={testId} onClick={onClick}>{label}</button>
);

test("Changing context list for useContexts", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("value1", { contextId: "test1" });
	const Context2 = createContext("value2", { contextId: "test2" });
	const Context3 = createContext("value3", { contextId: "test3" });

	const Component = () =>
	{
		const [contexts, setContexts] = useState<ContextTuple | ContextDict>([Context1, Context2]);
		const value = JSON.stringify(useContexts(contexts));

		return (
			<>
				<Button testId="ClickTarget1" onClick={() => setContexts([Context2, Context3])} label="click" />
				<Button testId="ClickTarget2" onClick={() => setContexts({ a: Context1, b: Context2 })} label="click" />
				<span data-testid="UseContexts.Output">{value}</span>
			</>
		);
	};

	render(<Component />);

	expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('["value1","value2"]');

	await user.click(screen.getByTestId("ClickTarget1"));
	expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('["value2","value3"]');

	await user.click(screen.getByTestId("ClickTarget2"));
	expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('{"a":"value1","b":"value2"}');
});