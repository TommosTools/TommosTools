/* eslint-disable react/function-component-definition, @typescript-eslint/quotes */

import { ReactNode, useEffect, useState } from "react";
import { act } from "react-dom/test-utils";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createContext, useContextUpdate, ContextType } from "contexto";
import { useContextSelector } from "..";

const Context1 = createContext({
	top: 111,
	nested: {
		inner: 222,
	},
}, { contextId: "assorted" });
type Type1 = ContextType<typeof Context1>;

test("useContextSelector selects from context", async () =>
{
	const renderCounts: Record<string, number> = {};

	const Selector = ({ testId }: { testId: string }) =>
	{
		const value = useContextSelector(Context1, ({ nested }) => JSON.stringify(nested));
		renderCounts[testId] = (renderCounts[testId] ?? 0) + 1;
		return (
			<span data-testid={testId}>
				{`${value} / ${renderCounts[testId]}`}
			</span>
		);
	};

	let updateWithProp: (value: Type1) => void;
	const UpdateProvider = ({ initialValue, children }: { initialValue: Type1, children: ReactNode }) =>
	{
		const [value, setValue] = useState(initialValue);
		updateWithProp = setValue;
		return <Context1.Provider value={value} children={children} />;
	};

	let updateWithHook: (value: Type1) => void;
	const UpdateConsumer = () =>
	{
		updateWithHook = useContextUpdate(Context1);
		return null;
	};

	const Component = () => (
		<>
			<Selector testId="test1" />
			<UpdateProvider initialValue={{ top: 112, nested: { inner: 222 } }}>
				<Selector testId="test2" />
			</UpdateProvider>
			{/* eslint-disable-next-line react/jsx-no-constructed-context-values */}
			<Context1.Provider value={{ top: 113, nested: { inner: 224 } }}>
				<UpdateConsumer />
				<Selector testId="test3" />
			</Context1.Provider>
		</>
	);

	render(<Component />);

	expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":222} / 1');
	expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":222} / 1');
	expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":224} / 1');

	act(() => updateWithProp({ top: 114, nested: { inner: 225 } }));
	act(() => updateWithHook({ top: 115, nested: { inner: 226 } }));

	expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":222} / 1');
	expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":225} / 2');
	expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":226} / 2');
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
		// eslint-disable-next-line react/jsx-no-constructed-context-values
		return <MyContext.Provider value={{ quickTick, slowTick }} children={children} />;
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

	render(<App />);
	expect(slowRenderCount).toBe(1);
	expect(quickRenderCount).toBe(1);

	act(() => jest.advanceTimersByTime(20));

	for (let i = 1; i <= 10; i += 1)
	{
		expect(slowRenderCount).toBe(1);
		expect(quickRenderCount).toBe(i);
		act(() => jest.advanceTimersByTime(100));	// eslint-disable-line @typescript-eslint/no-loop-func
	}

	expect(slowRenderCount).toBe(2);	// Has rendered once since initial render
	expect(quickRenderCount).toBe(11);	// Has rendered ten times since initial render
});