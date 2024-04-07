/* eslint-disable react/static-property-placement, react/sort-comp, react/function-component-definition */

import React, { ReactNode, useEffect, useRef } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createCompatibleContext, useContextUpdate } from "..";
import { ProviderRef } from "../types";

const Context1 = createCompatibleContext("default value", { contextId: "test" });

class ClassConsumer extends React.Component<{ testId?: string }>
{
	declare context: React.ContextType<typeof Context1>;

	static contextType = Context1;

	render()
	{
		const { props: { testId }, context } = this;

		return <span data-testid={testId}>{context}</span>;
	}
}

test("Basic ClassConsumer", () =>
{
	render(
		<>
			<ClassConsumer testId="Context1.defaultValue" />
			<Context1.Provider value="value1">
				<ClassConsumer testId="Context1.Provider[0]" />
			</Context1.Provider>
		</>
	);

	expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1");
});

test("ClassConsumer with ref update", () =>
{
	const ProviderWithHookUpdate = ({ children }: { children: ReactNode }) =>
	{
		const ref = useRef<ProviderRef<string>>(null);

		useEffect(() =>	ref.current?.update("value2"));

		return <Context1.Provider value="value1" children={children} ref={ref} />;
	};

	render(
		<>
			<ClassConsumer testId="Context1.defaultValue" />
			<ProviderWithHookUpdate>
				<ClassConsumer testId="Context1.Provider[0]" />
			</ProviderWithHookUpdate>
		</>
	);

	expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value2");
});

test("ClassConsumer with useContextUpdate() update", () =>
{
	const ComponentWithHookUpdate = () =>
	{
		const update = useContextUpdate(Context1);
		useEffect(() => update("value2"));
		return null;
	};

	render(
		<>
			<ClassConsumer testId="Context1.defaultValue" />
			<Context1.Provider value="value1">
				<ComponentWithHookUpdate />
				<ClassConsumer testId="Context1.Provider[0]" />
			</Context1.Provider>
		</>
	);

	expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value2");
});

test("Context.Consumer", () =>
{
	render(
		<>
			<Context1.Consumer>
				{ (value) => <span data-testid="Context1.defaultValue">{value}</span> }
			</Context1.Consumer>
			<Context1.Provider value="value1">
				<Context1.Consumer>
					{ (value) => <span data-testid="Context1.Provider[0]">{value}</span> }
				</Context1.Consumer>
			</Context1.Provider>
		</>
	);

	expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1");
});