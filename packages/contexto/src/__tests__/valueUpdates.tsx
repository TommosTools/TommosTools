/* eslint-disable react/function-component-definition, @typescript-eslint/no-extra-parens */

import {
	FC,
	useEffect,
	useRef,
	useState,
} from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {
	createContext,
	useContext,
	useContextUpdate,
	useContexts,
} from "..";
import { Context, ProviderRef } from "../types";

// eslint-disable-next-line @typescript-eslint/comma-dangle
const Render = <T,>({ context, testId }: { context: Context<T>, testId?: string }) => (
	<span data-testid={testId}>{ JSON.stringify(useContext(context)) }</span>
);

const Button: FC<{ testId: string, onClick: () => void, label?: string }> = ({ testId, onClick, label }) => (
	<button type="button" data-testid={testId} onClick={onClick}>{label ?? "click"}</button>
);

test("Context value updates when value prop changes, unless using initialValue", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("default value", { contextId: "test1" });

	const ProvidersWithClickToSetProviderValue = () =>
	{
		const [value, setValue] = useState("initial value");

		return (
			<>
				<Button testId="ClickTarget" onClick={() => setValue("updated value")} />

				<Context1.Provider value={value}>
					<Render context={Context1} testId="Context1.Provider[0]" />
				</Context1.Provider>
				<Context1.Provider initialValue={value}>
					<Render context={Context1} testId="Context1.Provider[1]" />
				</Context1.Provider>
			</>
		);
	};

	render(<ProvidersWithClickToSetProviderValue />);

	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("initial value");
	expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("initial value");

	await user.click(screen.getByTestId("ClickTarget"));
	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("updated value");
	expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("initial value");
});

test("Context value updates interacting with ref and hook updates", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("default value", { contextId: "test2" });

	const OuterComponent = () =>
	{
		const [value, setValue] = useState("initial value");
		const ref = useRef<ProviderRef<string>>(null);

		return (
			<>
				<Button testId="ClickTargetProp1" onClick={() => setValue("prop updated value1")} />
				<Button testId="ClickTargetProp2" onClick={() => setValue("prop updated value2")} />
				<Button testId="ClickTargetRef" onClick={() => ref.current?.update("ref updated value")} />

				<Context1.Provider value={value} ref={ref}>
					<InnerComponent />
					<Render context={Context1} testId="Context1.Provider" />
				</Context1.Provider>
			</>
		);
	};

	const InnerComponent = () =>
	{
		const update = useContextUpdate(Context1);

		return (
			<Button testId="ClickTargetHook" onClick={() => update("hook updated value")} />
		);
	};

	render(<OuterComponent />);

	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("initial value");

	await user.click(screen.getByTestId("ClickTargetRef"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("ref updated value");

	await user.click(screen.getByTestId("ClickTargetProp1"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("prop updated value1");

	await user.click(screen.getByTestId("ClickTargetRef"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("ref updated value");

	await user.click(screen.getByTestId("ClickTargetHook"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("hook updated value");

	// This is not changing the value prop, so we do not expect a change
	await user.click(screen.getByTestId("ClickTargetProp1"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("hook updated value");

	await user.click(screen.getByTestId("ClickTargetProp2"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("prop updated value2");
});

const isJsonEqual = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

test("useContext causes re-renders", async () =>
{
	const user = userEvent.setup();

	const ORIGINAL_VALUE = { key1: "value1" };
	const Context1 = createContext(ORIGINAL_VALUE, { contextId: "test3" });

	let count1 = 0;
	const ComponentWithDefaultIsEqual = () =>
	{
		const value = useContext(Context1).key1;
		useEffect(() =>
		{
			count1 += 1;
		});
		return <span>{value}</span>;
	};

	let count2 = 0;
	const ComponentWithCustomEqual = () =>
	{
		const value = useContext(Context1, isJsonEqual).key1;
		useEffect(() =>
		{
			count2 += 1;
		});
		return <span>{value}</span>;
	};

	const OuterComponent = () =>
	{
		const ref = useRef<ProviderRef<{ key1: string }>>(null);

		return (
			<Context1.Provider value={ORIGINAL_VALUE} ref={ref}>
				<Button testId="ClickTargetRef1" onClick={() => ref.current?.update(ORIGINAL_VALUE)} />
				<Button testId="ClickTargetRef2" onClick={() => ref.current?.update({ key1: "value1" })} />
				<Button testId="ClickTargetRef3" onClick={() => ref.current?.update({ key1: "updated value" })} />

				<ComponentWithDefaultIsEqual />
				<ComponentWithCustomEqual />

				<Render context={Context1} testId="Context1.Provider" />
			</Context1.Provider>
		);
	};

	render(<OuterComponent />);

	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("value1");
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	// Invoke an update with the exact same value.  Should not re-render.
	await user.click(screen.getByTestId("ClickTargetRef1"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("value1");
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	// Invoke an update which is different by reference but identical by value.
	// Should not re-render the component with custom equal.
	await user.click(screen.getByTestId("ClickTargetRef2"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("value1");
	expect(count1).toBe(2);
	expect(count2).toBe(1);

	// Invoke an update with a different value.
	await user.click(screen.getByTestId("ClickTargetRef3"));
	expect(screen.getByTestId("Context1.Provider")).toHaveTextContent("updated value");
	expect(count1).toBe(3);
	expect(count2).toBe(2);
});

test("useContexts causes re-renders", async () =>
{
	const user = userEvent.setup();

	const ORIGINAL_VALUE1 = { key1: "value1" };
	const ORIGINAL_VALUE2 = { key2: "value2" };

	const Context1 = createContext(ORIGINAL_VALUE1, { contextId: "test4a" });
	const Context2 = createContext(ORIGINAL_VALUE2, { contextId: "test4b" });

	const customIsEqual = (x: unknown, y: unknown, context: Context<unknown>) => (
		(context === Context1) ? isJsonEqual(x, y) : (x === y)
	);

	let count1 = 0;
	const ComponentWithDefaultIsEqual = () =>
	{
		const value = useContexts({ Context1, Context2 });
		useEffect(() =>
		{
			count1 += 1;
		});
		return <span data-testid="value-default">{`${value.Context1.key1}/${value.Context2.key2}`}</span>;
	};

	let count2 = 0;
	const ComponentWithCustomEqual = () =>
	{
		const value = useContexts({ Context1, Context2 }, customIsEqual);
		useEffect(() =>
		{
			count2 += 1;
		});
		return <span data-testid="value-custom">{`${value.Context1.key1}/${value.Context2.key2}`}</span>;
	};

	const OuterComponent = () =>
	{
		const ref1 = useRef<ProviderRef<{ key1: string }>>(null);
		const ref2 = useRef<ProviderRef<{ key2: string }>>(null);

		return (
			<Context1.Provider value={ORIGINAL_VALUE1} ref={ref1}>
				<Context2.Provider value={ORIGINAL_VALUE2} ref={ref2}>
					<Button testId="ClickTargetRef1" onClick={() => ref1.current?.update(ORIGINAL_VALUE1)} />
					<Button testId="ClickTargetRef2" onClick={() => ref1.current?.update({ key1: "value1" })} />
					<Button testId="ClickTargetRef3" onClick={() => ref1.current?.update({ key1: "updated value1" })} />
					<Button testId="ClickTargetRef4" onClick={() => ref2.current?.update(ORIGINAL_VALUE2)} />
					<Button testId="ClickTargetRef5" onClick={() => ref2.current?.update({ key2: "value2" })} />
					<Button testId="ClickTargetRef6" onClick={() => ref2.current?.update({ key2: "updated value2" })} />

					<ComponentWithDefaultIsEqual />
					<ComponentWithCustomEqual />
				</Context2.Provider>
			</Context1.Provider>
		);
	};

	render(<OuterComponent />);

	expect(screen.getByTestId("value-default")).toHaveTextContent("value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("value1/value2");
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	// Invoke an update with the exact same value.  Should not re-render.
	await user.click(screen.getByTestId("ClickTargetRef1"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("value1/value2");
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	// Invoke an update which is different by reference but identical by value.
	// Should not re-render the component with custom equal.
	await user.click(screen.getByTestId("ClickTargetRef2"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("value1/value2");
	expect(count1).toBe(2);
	expect(count2).toBe(1);

	// Invoke an update with a different value.
	await user.click(screen.getByTestId("ClickTargetRef3"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("updated value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("updated value1/value2");
	expect(count1).toBe(3);
	expect(count2).toBe(2);

	// Invoke an update with the exact same value.  Should not re-render.
	await user.click(screen.getByTestId("ClickTargetRef4"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("updated value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("updated value1/value2");
	expect(count1).toBe(3);
	expect(count2).toBe(2);

	// Invoke an update which is different by reference but identical by value.
	// Custom equal should detect the change because it was applied to Context2
	await user.click(screen.getByTestId("ClickTargetRef5"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("updated value1/value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("updated value1/value2");
	expect(count1).toBe(4);
	expect(count2).toBe(3);

	// Invoke an update with a different value.
	await user.click(screen.getByTestId("ClickTargetRef6"));
	expect(screen.getByTestId("value-default")).toHaveTextContent("updated value1/updated value2");
	expect(screen.getByTestId("value-custom")).toHaveTextContent("updated value1/updated value2");
	expect(count1).toBe(5);
	expect(count2).toBe(4);
});

test("Custom isEqual can force render on every update", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("default value", { contextId: "test5" });

	let count1 = 0;
	let count2 = 0;

	const neverEqual = () => false;

	const UseContextComponent = () =>
	{
		const value = useContext(Context1, neverEqual);
		useEffect(() =>
		{
			count1 += 1;
		});
		return <span data-testid="Context1.Provider.value">{value}</span>;
	};

	const UseContextsComponent = () =>
	{
		const values = useContexts({ Context1 }, neverEqual);
		useEffect(() =>
		{
			count2 += 1;
		});
		return <span data-testid="Context1.Provider.values">{values.Context1}</span>;
	};

	const OuterComponent = () =>
	{
		const ref = useRef<ProviderRef<string>>(null);

		return (
			<Context1.Provider value="value" ref={ref}>
				<Button testId="ClickTargetRef" onClick={() => ref.current?.update("value")} />
				<UseContextComponent />
				<UseContextsComponent />
			</Context1.Provider>
		);
	};

	render(<OuterComponent />);

	expect(screen.getByTestId("Context1.Provider.value")).toHaveTextContent("value");
	expect(screen.getByTestId("Context1.Provider.values")).toHaveTextContent("value");
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	// Setting the value should cause a re-render of both components due to custom isEqual
	await user.click(screen.getByTestId("ClickTargetRef"));
	expect(screen.getByTestId("Context1.Provider.value")).toHaveTextContent("value");
	expect(screen.getByTestId("Context1.Provider.values")).toHaveTextContent("value");
	expect(count1).toBe(2);
	expect(count2).toBe(2);
});

test("Adding new consumer after imperative update gets updated value", async () =>
{
	const user = userEvent.setup();

	const Context1 = createContext("default value", { contextId: "test6" });

	const Component = () =>
	{
		const ref1 = useRef<ProviderRef<string>>(null);
		const ref2 = useRef<ProviderRef<string>>(null);
		const [visible, setVisible] = useState(false);

		const updateValues = () =>
		{
			ref1.current?.update("updated value 1");
			ref2.current?.update("updated value 2");
		};

		return (
			<>
				<Button testId="ClickTarget1" onClick={updateValues} />
				<Button testId="ClickTarget2" onClick={() => setVisible(true)} />

				<Context1.Provider value="initial value 1" ref={ref1}>
					{ visible && <Render context={Context1} testId="Context1.Provider[0]" /> }
				</Context1.Provider>

				<Context1.Provider initialValue="initial value 2" ref={ref2}>
					{ visible && <Render context={Context1} testId="Context1.Provider[1]" /> }
				</Context1.Provider>
			</>
		);
	};

	render(<Component />);

	expect(screen.queryByTestId("Context1.Provider[0]")).not.toBeInTheDocument();
	expect(screen.queryByTestId("Context1.Provider[1]")).not.toBeInTheDocument();

	await user.click(screen.getByTestId("ClickTarget1"));
	await user.click(screen.getByTestId("ClickTarget2"));

	expect(screen.getByTestId("Context1.Provider[0]")).toHaveTextContent("updated value 1");
	expect(screen.getByTestId("Context1.Provider[1]")).toHaveTextContent("updated value 2");
});