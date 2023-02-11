/**
 * @jest-environment jsdom
 */

import React, { ReactNode, useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createContext, createProxyContext, useContext, useContexts, useContextUpdate, INHERIT } from "..";
import { Context } from "../types/";

const Render = <T,>({ context, testId }: { context: Context<T>, testId?: string }) =>
	<div>
		<span role="heading">{ context.displayName }</span>
		<span role="definition" data-testid={testId}>{ JSON.stringify(useContext(context)) }</span>
	</div>

test("Basic SubscriptionContext", () =>
	{
		const Context1 = createContext("default value", { displayName: "Context Name", contextId: "test1" });

		render(<Render context={Context1} />);
		expect(screen.getByRole("heading")).toHaveTextContent("Context Name");
		expect(screen.getByRole("definition")).toHaveTextContent("default value");
	});

test("SubscriptionContext with Providers", () =>
	{
		const Context1 = createContext("default value", { contextId: "test2" });
		render(<>
			<Render context={Context1} testId="Context1.defaultValue" />
			<Context1.Provider value="value1">
				<Render context={Context1} testId="Context1.Provider[0]" />
				<Context1.Provider value="value2">
					<Render context={Context1} testId="Context1.Provider[1]" />
				</Context1.Provider>
			</Context1.Provider>
		</>);
		expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("value2");
	});

test("Multiple SubscriptionContexts with Providers", () =>
	{
		const Context1 = createContext("default value 1", { contextId: "test3a" });
		const Context2 = createContext("default value 2", { contextId: "test3b" });

		render(
			<Context1.Provider value="value1a">
				<Render context={Context2} testId="Context2.defaultValue" />
				<Context2.Provider value="value2a">
					<Render context={Context1} testId="Context1.Provider[0]" />
					<Render context={Context2} testId="Context2.Provider[0]" />
					<Context1.Provider value="value1b">
						<Render context={Context1} testId="Context1.Provider[1]" />
						<Render context={Context2} testId="Context2.Provider[1]" />
						<Context2.Provider value="value2b">
							<Render context={Context1} testId="Context1.Provider[2]" />
							<Render context={Context2} testId="Context2.Provider[2]" />
						</Context2.Provider>
					</Context1.Provider>
				</Context2.Provider>
			</Context1.Provider>
		);
		expect(screen.getByTestId("Context2.defaultValue")).toHaveTextContent("default value");
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1a");
		expect(screen.getByTestId("Context2.Provider[0]")).toHaveTextContent("value2a");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("value1b");
		expect(screen.getByTestId("Context2.Provider[1]")).toHaveTextContent("value2a");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("value1b");
		expect(screen.getByTestId("Context2.Provider[2]")).toHaveTextContent("value2b");
	});

test("ProxyContext", () =>
	{
		const RawContext = React.createContext("default value");
		const Context1 = createProxyContext(RawContext, { contextId: "test4" });

		render(<>
			<Render context={Context1} testId="Context1.defaultValue" />
			<RawContext.Provider value="value1">
				<Render context={Context1} testId="Context1.Provider[0]" />
			</RawContext.Provider>
		</>);

		expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1");
	});

test("Context.Consumer", () =>
	{
		const Context1 = createContext("default value", { contextId: "test5" });

		render(<>
			<Context1.Consumer>{
				value => <span data-testid="Context1.defaultValue">{value}</span>
			}</Context1.Consumer>
			<Context1.Provider value="value1">
				<Context1.Consumer>{
					value => <span data-testid="Context1.Provider[0]">{value}</span>
				}</Context1.Consumer>
			</Context1.Provider>
		</>);

		expect(screen.getByTestId("Context1.defaultValue")).toHaveTextContent("default value");
		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value1");
	});

test("useContexts", () =>
	{
		const Context1 = createContext("default value1", { contextId: "test6" });
		const Context2 = createContext("default value2", { contextId: "test7" });

		const UseContextsArray = ({ testId }: { testId: string }) =>
			<span data-testid={testId}>{
				useContexts([Context1, Context2, Context1]).join(",")
			}</span>

		const UseContextsObject = () =>
			<>{
				Object.entries(useContexts({ one: Context1, two: Context2, three: Context2 }))
					.map(([key, value], index) =>
						<div key={index}>
							<span data-testid={`Context:${key}`}>{value}</span>
						</div>)
			}</>

		render(<>
			<UseContextsArray testId="use-contexts-array-0" />
			<Context1.Provider value="value1">
				<Context2.Provider value="value2">
					<UseContextsArray testId="use-contexts-array-1" />
					<UseContextsObject/>
				</Context2.Provider>
			</Context1.Provider>
		</>);

		expect(screen.getByTestId("use-contexts-array-0")).toHaveTextContent("default value1,default value2,default value1");
		expect(screen.getByTestId("use-contexts-array-1")).toHaveTextContent("value1,value2,value1");
		expect(screen.getByTestId("Context:one")).toHaveTextContent("value1");
		expect(screen.getByTestId("Context:two")).toHaveTextContent("value2");
		expect(screen.getByTestId("Context:three")).toHaveTextContent("value2");
	});

test("initialValue", () =>
	{
		const Context1 = createContext("default value", { contextId: "test8" });

		const Updater = ({ value }: { value: string }) =>
			{
				const update = useContextUpdate(Context1);
				useEffect(() => update(value), [value]);
				return null;
			}

		const ShowIfContextEquals = ({ value, children }: { value: string, children: ReactNode }) =>
			{
				const contextValue = useContext(Context1);
				return (value === contextValue) ? <>{children}</> : null;
			}

		const ChangingInitialValue = () =>
			{
				const [value, setValue] = useState("value6");

				useEffect(() => setValue("value7"));

				return (
					<Context1.Provider initialValue={value}>
						<span data-testid="changedValue">{value}</span>
						<Render context={Context1} testId="Context1.Provider[5]" />
					</Context1.Provider>
				);
			}

		render(<>
			<Context1.Provider initialValue="value0">
				<Render context={Context1} testId="Context1.Provider[0]" />
			</Context1.Provider>
			<Context1.Provider value="value1">
				<Context1.Provider initialValue={INHERIT}>
					<Render context={Context1} testId="Context1.Provider[1]" />
				</Context1.Provider>
			</Context1.Provider>
			<Context1.Provider initialValue={INHERIT}>
				<Render context={Context1} testId="Context1.Provider[2]" />
			</Context1.Provider>
			<Context1.Provider value="value2">
				<Updater value="value3"/>
				<Context1.Provider initialValue={INHERIT}>
					<Render context={Context1} testId="Context1.Provider[3]" />
				</Context1.Provider>
			</Context1.Provider>
			<Context1.Provider value="value4">
				<Updater value="value5"/>
				<ShowIfContextEquals value="value5">
					<Context1.Provider initialValue={INHERIT}>
						<Render context={Context1} testId="Context1.Provider[4]" />
					</Context1.Provider>
				</ShowIfContextEquals>
			</Context1.Provider>
			<ChangingInitialValue/>
		</>);

		expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("value0");
		expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("value1");
		expect(screen.getByTestId("Context1.Provider[2]")).toHaveTextContent("default value");
		expect(screen.getByTestId("Context1.Provider[3]")).toHaveTextContent("value2");
		expect(screen.getByTestId("Context1.Provider[4]")).toHaveTextContent("value5");

		// Changing initialValue prop doesn't change the provider's value
		expect(screen.getByTestId("changedValue")).toHaveTextContent("value7");
		expect(screen.getByTestId("Context1.Provider[5]")).toHaveTextContent("value6");
	});