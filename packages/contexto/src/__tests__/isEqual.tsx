/**
 * @jest-environment jsdom
 */

import { useState, createContext as createReactContext } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { createContext, createCompatibleContext, createProxyContext, useContext, useContexts } from "..";
import { Context, IsEqual } from "../types";

const Render = <T,>({ context, testId, isEqual, callback }: { context: Context<T>, testId?: string, isEqual?: IsEqual<T>, callback?: () => void }) =>
	{
		callback?.();
		return <span data-testid={testId}>{ JSON.stringify(useContext(context, isEqual)) }</span>
	}

const isEqualLength = (a: string, b: string) => a.length === b.length;

test("Custom isEqual", async () =>
	{
		const user = userEvent.setup();

		const Context1 = createContext("abc", { contextId: "test1" });

		const Component = () =>
			{
				const [val, setVal] = useState("def");
				return (
					<Context1.Provider value={val}>
						<button data-testid="ClickTarget" onClick={ () => setVal("ghi") }>click</button>

						<Render context={Context1} testId="Context1.Provider[0]" />
						<Render context={Context1} testId="Context1.Provider[1]" isEqual={isEqualLength} />

						<Context1.Consumer>
							{ value => <span data-testid="Context1.Provider[2]">{value}</span> }
						</Context1.Consumer>
						<Context1.Consumer isEqual={isEqualLength}>
							{ value => <span data-testid="Context1.Provider[3]">{value}</span> }
						</Context1.Consumer>
					</Context1.Provider>
				);
			};

		render(<Component/>);

		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");

		await user.click(screen.getByTestId("ClickTarget"));
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");
	});

test("Custom isEqual with CompatibleContext", async () =>
	{
		const user = userEvent.setup();

		const Context1 = createCompatibleContext("abc", { contextId: "test2" });

		const Component = () =>
			{
				const [val, setVal] = useState("def");
				return (
					<Context1.Provider value={val}>
						<button data-testid="ClickTarget" onClick={ () => setVal("ghi") }>click</button>

						<Render context={Context1} testId="Context1.Provider[0]" />
						<Render context={Context1} testId="Context1.Provider[1]" isEqual={isEqualLength} />

						<Context1.Consumer>
							{ value => <span data-testid="Context1.Provider[2]">{value}</span> }
						</Context1.Consumer>
						<Context1.Consumer isEqual={isEqualLength}>
							{ value => <span data-testid="Context1.Provider[3]">{value}</span> }
						</Context1.Consumer>
					</Context1.Provider>
				);
			};

		render(<Component/>);

		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");

		await user.click(screen.getByTestId("ClickTarget"));
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");
	});

test("Custom isEqual with ProxyContext", async () =>
	{
		const user = userEvent.setup();

		const Context0 = createReactContext("abc");
		const Context1 = createProxyContext(Context0, { contextId: "test3" });

		const Component = () =>
			{
				const [val, setVal] = useState("def");
				return (
					<Context0.Provider value={val}>
						<button data-testid="ClickTarget" onClick={ () => setVal("ghi") }>click</button>

						<Render context={Context1} testId="Context1.Provider[0]" />
						<Render context={Context1} testId="Context1.Provider[1]" isEqual={isEqualLength} />

						<Context1.Consumer>
							{ value => <span data-testid="Context1.Provider[2]">{value}</span> }
						</Context1.Consumer>
						<Context1.Consumer isEqual={isEqualLength}>
							{ value => <span data-testid="Context1.Provider[3]">{value}</span> }
						</Context1.Consumer>
					</Context0.Provider>
				);
			};

		render(<Component/>);

		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");

		await user.click(screen.getByTestId("ClickTarget"));
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("def");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("ghi");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("def");
	});

test("isEqual compares previous rendered value rather than previous updated value", async () =>
	{
		const user = userEvent.setup();

		const Context1 = createContext(0, { contextId: "test4" });

		const isApproxEqual = (a: number, b: number) => Math.abs(a - b) <= 1;

		const Component = () =>
			{
				const [val, setVal] = useState(0);

				return (
					<Context1.Provider value={val}>
						<button data-testid="ClickTarget1" onClick={ () => setVal(1) }>click</button>
						<button data-testid="ClickTarget2" onClick={ () => setVal(2) }>click</button>

						<Render context={Context1} testId="Context1.Provider[0]" />
						<Render context={Context1} testId="Context1.Provider[1]" isEqual={isApproxEqual} />
					</Context1.Provider>
				);
			};

		render(<Component/>);

		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("0");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("0");

		await user.click(screen.getByTestId("ClickTarget1"));
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("1");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("0");

		await user.click(screen.getByTestId("ClickTarget2"));
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("2");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("2");
	});

test("If constituent context values all isEqual, then useContexts output is stable", async () =>
	{
		const user = userEvent.setup();

		const Context1 = createContext("abc", { contextId: "test5" });
		const Context2 = createContext("ABC", { contextId: "test6" });

		const isAlwaysEqual = () => true;

		const renderedValues: Set<unknown> = new Set();
		let renderCount = 0;

		const UseContextsComponent = () =>
			{
				const value = useContexts([Context1, Context2], isAlwaysEqual);
				renderedValues.add(value);
				++renderCount;
				return <span data-testid="useContexts">{value[0]}</span>;
			};

		const Component = () =>
			{
				const [val, setVal] = useState("def");

				return (
					<Context1.Provider value={val}>
						<button data-testid="ClickTarget" onClick={ () => setVal("ghi") }>click</button>
						<UseContextsComponent/>
					</Context1.Provider>
				);
			};
		
		render(<Component/>);

		expect(screen.getByTestId("useContexts")).toHaveTextContent("def");

		await user.click(screen.getByTestId("ClickTarget"));
		expect(screen.getByTestId("useContexts")).toHaveTextContent("def");

		// Renders twice, but same array is returned by useContexts
		expect(renderCount).toBe(2);
		expect(renderedValues.size).toBe(1);
	});

test("isEqual with multiple contexts", async () =>
	{
		const user = userEvent.setup();

		const Context1 = createContext("abc", { contextId: "test7" });
		const Context2 = createContext(0, { contextId: "test8" });

		const multivariateEqual = (a: unknown, b: unknown, context: Context<unknown>) =>
			{
				if (context === Context1)
					return (a as string).length === (b as string).length;
				else if (context === Context2)
					return Math.abs((a as number) - (b as number)) < 2;
				else
					return true;
			};

		const UseContextsComponent = () =>
			{
				const value = useContexts([Context1, Context2], multivariateEqual);
				return <span data-testid="useContexts">{JSON.stringify(value)}</span>;
			};

		const Component = () =>
			{
				const [val1, setVal1] = useState("def");
				const [val2, setVal2] = useState(1);

				return (
					<Context1.Provider value={val1}>
						<Context2.Provider value={val2}>
							<button data-testid="ClickTarget1" onClick={ () => setVal1("ghi") }>click</button>
							<button data-testid="ClickTarget2" onClick={ () => setVal2(val => val + 1) }>click</button>
							<UseContextsComponent/>
						</Context2.Provider>
					</Context1.Provider>
				);
			};

		render(<Component/>);

		expect(screen.getByTestId("useContexts")).toHaveTextContent('["def",1]');

		await user.click(screen.getByTestId("ClickTarget1"));
		expect(screen.getByTestId("useContexts")).toHaveTextContent('["def",1]');

		await user.click(screen.getByTestId("ClickTarget2"));
		expect(screen.getByTestId("useContexts")).toHaveTextContent('["def",1]');

		await user.click(screen.getByTestId("ClickTarget2"));
		expect(screen.getByTestId("useContexts")).toHaveTextContent('["def",3]');
	});