/* eslint-disable react/function-component-definition, @typescript-eslint/quotes */

import {
	ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import { act } from "react-dom/test-utils";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
	createContext,
	useContextUpdate,
	ContextType,
	SubscriptionContext,
} from "contexto";
import { useContextSelector } from "..";

// eslint-disable-next-line react-hooks/exhaustive-deps, @typescript-eslint/comma-dangle
const useLiteral = <T,>(value: T): T => useMemo(() => value, []);

test("useContextSelector selects from context", async () =>
{
	const MyContext = createContext({
		top: "default top",
		nested: {
			inner: "default inner",
		},
	}, { contextId: "assorted" });

	type StructuredData = ContextType<typeof MyContext>;

	const renderCounts: Record<string, number> = {};

	const Selector = ({ testId }: { testId: string }) =>
	{
		const value = useContextSelector(MyContext, ({ nested }) => JSON.stringify(nested));
		renderCounts[testId] = (renderCounts[testId] ?? 0) + 1;
		return (
			<span data-testid={testId}>
				{`${value} / render #${renderCounts[testId]}`}
			</span>
		);
	};

	let updateWithProp: (value: StructuredData) => void;
	const UpdateProvider = ({ initialValue, children }: { initialValue: StructuredData, children: ReactNode }) =>
	{
		const [value, setValue] = useState(initialValue);
		updateWithProp = setValue;
		return <MyContext.Provider value={value} children={children} />;
	};

	let updateWithHook: (value: StructuredData) => void;
	const UpdateConsumer = () =>
	{
		updateWithHook = useContextUpdate(MyContext);
		return null;
	};

	const Component = () =>
		{
			const overrideTest2 = useLiteral({
				top: "overridden top for test2",
				nested: { inner: "overridden inner for test2" },
			});
			const overrideTest3 = useLiteral({
				top: "overridden top for test3",
				nested: { inner: "overridden inner for test3" },
			});

			return (
				<>
					<Selector testId="test1" />

					<UpdateProvider initialValue={overrideTest2}>
						<Selector testId="test2" />
					</UpdateProvider>

					<MyContext.Provider value={overrideTest3}>
						<UpdateConsumer />
						<Selector testId="test3" />
					</MyContext.Provider>
				</>
			);
		};

	render(<Component />);

	expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":"default inner"} / render #1');
	expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":"overridden inner for test2"} / render #1');
	expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":"overridden inner for test3"} / render #1');

	act(() => updateWithProp({ top: "updated top for test2", nested: { inner: "updated inner for test2" } }));
	act(() => updateWithHook({ top: "updated top for test3", nested: { inner: "updated inner for test3" } }));

	expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":"default inner"} / render #1');
	expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":"updated inner for test2"} / render #2');
	expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":"updated inner for test3"} / render #2');
});

jest.useFakeTimers();

test("timerTest", async () =>
{
	const MyContext = createContext({ quickTick: 0, slowTick: 0 }, { contextId: "tickers" });

	function useTicker(periodMs: number, delayMs = 0)
	{
		const [tick, setTick] = useState(0);
		useEffect(
			() =>
			{
				setTimeout(
					() => setInterval(() => setTick((t) => t + 1), periodMs),
					delayMs
				);
			},
			[periodMs, delayMs]
		);
		return tick;
	}

	const Provider = ({ children }: { children: ReactNode }) =>
	{
		const quickTick = useTicker(100);
		const slowTick	= useTicker(1000, 10);
		const ticks		= useMemo(() => ({ quickTick, slowTick }), [quickTick, slowTick]);

		return <MyContext.Provider value={ticks} children={children} />;
	};

	let slowRenderCount = 0;
	const SlowConsumer = () =>
	{
		// Will render only once a second
		const tick = useContextSelector(MyContext, "slowTick");
		useEffect(
			() =>
			{
				slowRenderCount += 1;
			}
		);
		return <span data-testid="slow">{tick}</span>;
	};

	let quickRenderCount = 0;
	const QuickConsumer = () =>
	{
		// Will render 10 times a second (not 11)
		const tick = useContextSelector(MyContext, "quickTick");
		useEffect(
			() =>
			{
				quickRenderCount += 1;
			}
		);
		return <span data-testid="quick">{tick}</span>;
	};

	const App = () => (
		<Provider>
			<SlowConsumer />
			<QuickConsumer />
		</Provider>
	);

	// When App is first mounted, we should see 1 slow render and 1 quick render
	render(<App />);
	expect(slowRenderCount).toBe(1);
	expect(quickRenderCount).toBe(1);

	// Forward the timer a little so that we're between ticks of any speed
	act(() => jest.advanceTimersByTime(20));

	//
	// Step through 100ms at a time -- the component watching the quick tick should re-render each time,
	// but the component watching the slow tick should not re-render at all.
	//

	for (let i = 1; i <= 10; i += 1)
	{
		expect(slowRenderCount).toBe(1);
		expect(quickRenderCount).toBe(i);
		act(() => jest.advanceTimersByTime(100));	// eslint-disable-line @typescript-eslint/no-loop-func
	}

	expect(slowRenderCount).toBe(2);	// Has rendered once since initial render
	expect(quickRenderCount).toBe(11);	// Has rendered ten times since initial render
});

test("reconfigure", () =>
{
	const MyContext1 = createContext("default value 1", { contextId: "MyContext1" });
	const Provider1 = ({ children }: { children: ReactNode }) =>
		<MyContext1.Provider value="first value" children={children} />;

	const MyContext2 = createContext("default value 2", { contextId: "MyContext2" });
	const Provider2 = ({ children }: { children: ReactNode }) =>
		<MyContext2.Provider value="second value" children={children} />;

	const selector1 = (value: string) => `initial-selector(${value})`;
	const selector2 = (value: string) => `updated-selector(${value})`;
	const selector3 = (value: string) => `updated-selector(${value})`;

	let renderCount = 0;

	let updateContext: (value: SubscriptionContext<string>) => void;
	let updateSelector: (value: (value: string) => string) => void;

	const Consumer = () =>
		{
			const [context, setContext]		= useState(MyContext1);
			const [selector, setSelector]	= useState(() => selector1);

			updateContext	= setContext;
			updateSelector	= (newSelector) => setSelector(() => newSelector);

			const value = useContextSelector(context, selector, [selector]);

			renderCount += 1;

			return <span data-testid="consumer">{`${value} / render #${renderCount}`}</span>;
		};

	const App = () => (
		<Provider1>
			<Provider2>
				<Consumer />
			</Provider2>
		</Provider1>
	);

	render(<App />);
	expect(screen.getByTestId("consumer")).toHaveTextContent("initial-selector(first value) / render #1");

	//
	// Updating context and/or selector will always cause TWO re-renders:
	//  1) when the props change
	//  2) when the reducer internal state (including, possibly, the computed value) changes
	//

	act(() => updateContext(MyContext2));
	expect(screen.getByTestId("consumer")).toHaveTextContent("initial-selector(second value) / render #3");

	act(() => updateSelector(selector2));
	expect(screen.getByTestId("consumer")).toHaveTextContent("updated-selector(second value) / render #5");

	act(() => updateSelector(selector3));
	expect(screen.getByTestId("consumer")).toHaveTextContent("updated-selector(second value) / render #7");

	act(() =>
		{
			updateContext(MyContext2);
			updateSelector(selector3);
		});
	expect(screen.getByTestId("consumer")).toHaveTextContent("updated-selector(second value) / render #7");
});

test("deps", () =>
{
	const MyContext	= createContext("default value", { contextId: "MyContext" });
	const Provider	= ({ children }: { children: ReactNode }) =>
		<MyContext.Provider value="first value" children={children} />;

	let renderCount = 0;
	let updatePrefix: (value: string) => void;
	let updateSuffix: (value: string) => void;

	const Consumer = () =>
		{
			const [prefix, setPrefix] = useState("default prefix");
			const [suffix, setSuffix] = useState("default suffix");

			updatePrefix = setPrefix;
			updateSuffix = setSuffix;

			const value = useContextSelector(MyContext, (val) => `[${prefix}] ${val} [${suffix}]`, [prefix]);

			renderCount += 1;

			return <span data-testid="consumer">{`${value} / render #${renderCount}`}</span>;
		};

	const App = () => (
		<Provider>
			<Consumer />
		</Provider>
	);

	render(<App />);
	expect(screen.getByTestId("consumer"))
		.toHaveTextContent("[default prefix] first value [default suffix] / render #1");

	// Consumer will re-render twice: once for the changed prefix input, once in response to the updated computed state
	act(() => updatePrefix("updated prefix"));
	expect(screen.getByTestId("consumer"))
		.toHaveTextContent("[updated prefix] first value [default suffix] / render #3");

	// Consumer will re-render once: updating the suffix state does not trigger a re-render for the computed value,
	// because it is not listed as a dependency
	act(() => updateSuffix("updated suffix"));
	expect(screen.getByTestId("consumer"))
		.toHaveTextContent("[updated prefix] first value [default suffix] / render #4");
});

test("key-based selector", () =>
{
	type ContentType = { key1: string, key2: string };

	const MyContext	= createContext({ key1: "1", key2: "2" }, { contextId: "MyContext" });
	const Provider	= ({ children }: { children: ReactNode }) =>
		<MyContext.Provider
			value={useLiteral({ key1: "value 1", key2: "value 2" })}
			children={children}
		/>;

	let renderCount = 0;
	let updateKey: (key: keyof ContentType) => void;

	const Consumer = () =>
	{
		const [key, setKey]	= useState<keyof ContentType>("key1");

		updateKey = setKey;

		const value = useContextSelector(MyContext, key);

		renderCount += 1;

		return <span data-testid="consumer">{`${value} / render #${renderCount}`}</span>;
	};

	const App = () => (
		<Provider>
			<Consumer />
		</Provider>
	);

	render(<App />);
	expect(screen.getByTestId("consumer")).toHaveTextContent("value 1 / render #1");

	// Consumer will re-render twice: once for the changed key, once in response to the updated computed state
	act(() => updateKey("key2"));
	expect(screen.getByTestId("consumer")).toHaveTextContent("value 2 / render #3");
});