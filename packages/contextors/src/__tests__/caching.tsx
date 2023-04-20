/* eslint-disable react/function-component-definition */

import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
	memo,
	useEffect,
	useMemo,
	useState,
} from "react";
import { act } from "react-dom/test-utils";
import {
	INHERIT,
	ValueUpdater,
	createContext,
	useContext,
	useContextUpdate,
} from "contexto";
import { createContextor, useContextor } from "..";

test("simple caching", async () =>
{
	const obj1 = { value: "one" };
	const obj2 = { value: "two" };
	const obj3 = { value: "three" };
	const obj4 = { value: "four" };

	const Context1 = createContext(obj1, { contextId: "1" });
	const Context2 = createContext(obj2, { contextId: "2" });
	const Context3 = createContext<object | string>(obj3, { contextId: "3" });
	const Context4 = createContext<object | string>(obj4, { contextId: "4" });

	let computeCount = 0;
	const contextor = createContextor(
		[Context1, Context2, Context3, Context4],
		() =>
		{
			computeCount += 1;
			return "";
		}
	);

	let renderCount = 0;
	let update3: ValueUpdater<object | string>;
	let update4: ValueUpdater<object | string>;

	const Consumer = () =>
	{
		update3 = useContextUpdate(Context3);
		update4 = useContextUpdate(Context4);

		const value = useContextor(contextor);

		useEffect(
			() =>
			{
				renderCount += 1;
			}
		);

		return <div>{value}</div>;
	};

	const Component = () => (
		<Context1.Provider initialValue={INHERIT}>
			<Context2.Provider value={obj2}>
				<Context3.Provider value={obj3}>
					<Context4.Provider value={obj4}>
						<Consumer />
					</Context4.Provider>
				</Context3.Provider>
			</Context2.Provider>
		</Context1.Provider>
	);

	render(<Component />);			// [obj1, obj2, obj3, obj4]

	expect(renderCount).toBe(1);
	expect(computeCount).toBe(1);

	act(() => update3(obj3));		// [obj1, obj2, obj3, obj4]
	expect(renderCount).toBe(2);
	expect(computeCount).toBe(1);	// cache HIT

	act(() => update4("foo"));		// [obj1, obj2, obj3, "foo"]
	expect(renderCount).toBe(3);
	expect(computeCount).toBe(2);	// cache miss

	act(() => update4("bar"));		// [obj1, obj2, obj3, "bar"]
	expect(renderCount).toBe(4);
	expect(computeCount).toBe(3);	// cache miss

	act(() => update4("bar"));		// [obj1, obj2, obj3, "bar"]
	expect(renderCount).toBe(5);
	expect(computeCount).toBe(3);	// cache HIT

	act(() => update4("foo"));		// [obj1, obj2, obj3, "foo"]
	expect(renderCount).toBe(6);
	expect(computeCount).toBe(4);	// cache miss

	act(() => update4("bar"));		// [obj1, obj2, obj3, "bar"]
	expect(renderCount).toBe(7);
	expect(computeCount).toBe(5);	// cache miss

	act(() => update4(obj4));		// [obj1, obj2, obj3, obj4]
	expect(renderCount).toBe(8);
	expect(computeCount).toBe(5);	// cache HIT

	act(() => update3("foo"));		// [obj1, obj2, "foo", obj4]
	expect(renderCount).toBe(9);
	expect(computeCount).toBe(6);	// cache miss

	act(() => update4("bar"));		// [obj1, obj2, "foo", "bar"]
	expect(renderCount).toBe(10);
	expect(computeCount).toBe(7);	// cache miss

	act(() => update3("foo"));		// [obj1, obj2, "foo", "bar"]
	expect(renderCount).toBe(11);
	expect(computeCount).toBe(7);	// cache HIT
});

test("JSON stabilised caching", () =>
{
	type Content = { id: number, value: string };

	const ContentContext = createContext<Content>({ id: 0, value: "" }, { contextId: "test" });
	const isEqualJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

	const Stabiliser = createContextor([ContentContext], (value) => value, { isEqual: isEqualJson });

	const generateContents = () => Array(5).fill(0).map((_, n) => ({ id: n, value: "x".repeat(n) }));

	let contextContentRenderCount = 0;
	const ContextContentDisplay = () =>
	{
		const content = useContext(ContentContext);

		useEffect(
			() =>
			{
				contextContentRenderCount += 1;
			},
			[content]
		);

		return (
			<li>
				{`${content.id}: ${content.value}`}
			</li>
		);
	};

	const UnstableList = ({ contents }: { contents: Content[] }) => (
		<ul>
			{ contents.map((content) => (
				<ContentContext.Provider value={content} key={content.id}>
					<ContextContentDisplay />
				</ContentContext.Provider>
			)) }
		</ul>
	);

	let contextorContentRenderCount = 0;
	const ContextorContentDisplay = () =>
	{
		const content = useContextor(Stabiliser);
		useEffect(
			() =>
			{
				contextorContentRenderCount += 1;
			},
			[content]
		);

		return (
			<li>
				{`${content.id}: ${content.value}`}
			</li>
		);
	};

	const StableList = ({ contents }: { contents: Content[] }) => (
		<ul>
			{ contents.map((content) => (
				<ContentContext.Provider value={content} key={content.id}>
					<ContextorContentDisplay />
				</ContentContext.Provider>
			)) }
		</ul>
	);

	let regenerate: () => void;
	const Lists = () =>
	{
		const [contents, setContents] = useState(generateContents);

		regenerate = () => setContents(generateContents());

		return (
			<>
				<UnstableList contents={contents} />
				<StableList contents={contents} />
			</>
		);
	};

	render(<Lists />);

	expect(contextContentRenderCount).toBe(5);
	expect(contextorContentRenderCount).toBe(5);

	act(() => regenerate());

	expect(contextContentRenderCount).toBe(10);
	expect(contextorContentRenderCount).toBe(5);
});

test("Nested contextors using isEqual", () =>
{
	const ContextA = createContext({ a: 0 }, { contextId: "test1" });
	const ContextB = createContext({ b: 0 }, { contextId: "test2" });

	const isEqualBasedOnArg1 = ([, [arg1]]:		[unknown[], [boolean, boolean]]) => arg1;
	const isEqualBasedOnArg2 = ([, [, arg2]]:	[unknown[], [boolean, boolean]]) => arg2;

	const Contextor1 = createContextor([ContextA], (context) => ({ ...context }), { isEqual: isEqualBasedOnArg1 });
	const Contextor2 = createContextor([ContextB], (context) => ({ ...context }), { isEqual: isEqualBasedOnArg2 });
	const Contextor3 = createContextor(
		[Contextor1, Contextor2],
		(contextor1, contextor2) => ({ ...contextor1, ...contextor2 })
	);

	const renderCounts: Record<string, number> = {};

	const Consumer = memo(({ id, equal1, equal2 }: { id: string, equal1: boolean, equal2: boolean }) =>
	{
		const equal = useMemo(() => [equal1, equal2], [equal1, equal2]) as [boolean, boolean];
		const value = useContextor(Contextor3(equal));

		useEffect(
			() =>
			{
				renderCounts[id] = (renderCounts[id] ?? 0) + 1;
			},
			[id, value]
		);

		return <>{ JSON.stringify(value) }</>;
	});

	let regenerate: () => void;

	const Consumers = () =>
	{
		const [salt, setSalt] = useState(1);

		regenerate = () => setSalt((value) => value + 1);

		const valueA = useMemo(() => ({ a: salt }), [salt]);
		const valueB = useMemo(() => ({ b: salt }), [salt]);

		return (
			<ContextA.Provider value={valueA}>
				<ContextB.Provider value={valueB}>
					<Consumer id="00" equal1={false} equal2={false} />
					<Consumer id="01" equal1={false} equal2={true} />
					<Consumer id="10" equal1={true} equal2={false} />
					<Consumer id="11" equal1={true} equal2={true} />
				</ContextB.Provider>
			</ContextA.Provider>
		);
	};

	render(<Consumers />);

	// eslint-disable-next-line object-curly-newline, quote-props
	expect(renderCounts).toMatchObject({ "00": 1, "01": 1, "10": 1, "11": 1 });

	act(() => regenerate());

	// eslint-disable-next-line object-curly-newline, quote-props
	expect(renderCounts).toMatchObject({ "00": 2, "01": 2, "10": 2, "11": 1 });
});