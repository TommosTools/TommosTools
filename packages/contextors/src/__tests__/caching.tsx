/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useEffect, useState, useMemo, memo } from "react";
import { act } from "react-dom/test-utils";
import { createContext, INHERIT, useContext, useContextUpdate, ValueUpdater } from "contexto";
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
			([c1, c2, c3, c4]) =>
			{
				++computeCount
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

				useEffect(() => { ++renderCount });

				return <>{value}</>
			}

		const Component = () =>
			<Context1.Provider initialValue={INHERIT}>
				<Context2.Provider value={obj2}>
					<Context3.Provider value={obj3}>
						<Context4.Provider value={obj4}>
							<Consumer/>
						</Context4.Provider>
					</Context3.Provider>
				</Context2.Provider>
			</Context1.Provider>

		render(<Component/>);           // [obj1, obj2, obj3, obj4]

		expect(renderCount).toBe(1);
		expect(computeCount).toBe(1);

		act(() => update3(obj3));       // [obj1, obj2, obj3, obj4]
		expect(renderCount).toBe(2);
		expect(computeCount).toBe(1);   // cache HIT

		act(() => update4("foo"));      // [obj1, obj2, obj3, "foo"]
		expect(renderCount).toBe(3);
		expect(computeCount).toBe(2);   // cache miss

		act(() => update4("bar"));      // [obj1, obj2, obj3, "bar"]
		expect(renderCount).toBe(4);
		expect(computeCount).toBe(3);   // cache miss

		act(() => update4("bar"));      // [obj1, obj2, obj3, "bar"]
		expect(renderCount).toBe(5);
		expect(computeCount).toBe(3);   // cache HIT

		act(() => update4("foo"));      // [obj1, obj2, obj3, "foo"]
		expect(renderCount).toBe(6);
		expect(computeCount).toBe(4);   // cache miss

		act(() => update4("bar"));      // [obj1, obj2, obj3, "bar"]
		expect(renderCount).toBe(7);
		expect(computeCount).toBe(5);   // cache miss

		act(() => update4(obj4));       // [obj1, obj2, obj3, obj4]
		expect(renderCount).toBe(8);
		expect(computeCount).toBe(5);   // cache HIT

		act(() => update3("foo"));      // [obj1, obj2, "foo", obj4]
		expect(renderCount).toBe(9);
		expect(computeCount).toBe(6);   // cache miss

		act(() => update4("bar"));      // [obj1, obj2, "foo", "bar"]
		expect(renderCount).toBe(10);
		expect(computeCount).toBe(7);   // cache miss

		act(() => update3("foo"));      // [obj1, obj2, "foo", "bar"]
		expect(renderCount).toBe(11);
		expect(computeCount).toBe(7);   // cache HIT
	});

	/*
test("Arg caching", () =>
	{
		type Vocab = { greeting: string, callToAction: string }
		const english: Vocab = { greeting: "Hello", callToAction: "Click here" }
		const polski: Vocab = { greeting: "Cześć", callToAction: "Kliknij tutaj" }

		type User = { id: string, name: string }
		const user1: User = { id: "abcd123", name: "John Richardson" }
		const user2: User = { id: "xyz1234", name: "Richard Johnson" }

		const VocabContext = createContext(english, { contextId: "1" });
		const UserContext = createContext<User | null>(null, { contextId: "2" });

		const Header = createContextor(
			[Context1],
			([context1], key: keyof Numbers) =>
				context1[key]
		);

		let renderCount = 0;

		const Consumer1 = ({ key }: { key: keyof Numbers }) =>
			{
				++renderCount;
				return <>{ useContextor(Contextor1(key)) }</>
			}

		
	})


	// idea: stabilising contextor which takes a value and effectively memoises it
	// 

function memoised<F extends (...args: never[]) => unknown>(f: F)
	: (...args: Parameters<F>) => ReturnType<F>
{
	let prev: ReturnType<F>;
	
	return (...args: Parameters<F>) =>
		{
			const candidate = f(...args) as ReturnType<F>;

			try
			{
				if (candidate === prev || JSON.stringify(candidate) === JSON.stringify(prev))
					return prev;
			}
			catch (e) {}

			return (prev=candidate);
		};
}

const createStabilisingContextor =
	<T,>(input: ArglessContextorInput<T>) =>
		createContextor([input], memoised(([value]: [T]) => value));

*/

test("JSON stabilised caching", () =>
	{
		type Content = { id: number, value: string };

		const ContentContext = createContext<Content>({ id: 0, value: "" }, { contextId: "test" });
		const isEqualJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

		const Stabiliser = createContextor([ContentContext], ([value]) => value, isEqualJson);

		const generateContents = () => Array(5).fill(0).map((_, n) => ({ id: n, value: "x".repeat(n) }));

		let contextContentRenderCount = 0;
		const ContextContentDisplay = () =>
		{
			const content = useContext(ContentContext);

			useEffect(() => { ++contextContentRenderCount }, [content]);

			return <li>`${content.id}: ${content.value}`</li>;
		}

		const UnstableList = ({ contents }: { contents: Content[] }) =>
			<ul>
				{ contents.map((content, i) =>
					<ContentContext.Provider value={content} key={i}>
						<ContextContentDisplay />
					</ContentContext.Provider>
				) }
			</ul>;

		let contextorContentRenderCount = 0;
		const ContextorContentDisplay = () =>
		{
			const content = useContextor(Stabiliser);
			useEffect(() => { ++contextorContentRenderCount }, [content]);

			return <li>`${content.id}: ${content.value}`</li>;
		}

		const StableList = ({ contents }: { contents: Content[] }) =>
			<ul>
				{ contents.map((content, i) =>
					<ContentContext.Provider value={content} key={i}>
						<ContextorContentDisplay />
					</ContentContext.Provider>
				) }
			</ul>;

		let regenerate: () => void;
		const Lists = () =>
		{
			const [contents, setContents] = useState(generateContents);

			regenerate = () => setContents(generateContents());

			return <>
				<UnstableList contents={contents} />
				<StableList contents={contents} />
			</>
		}

		render(<Lists/>);

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

		const isEqualBasedOnArg1 = ([[], [arg1, arg2]]: [unknown[], [boolean,boolean]]) => arg1;
		const isEqualBasedOnArg2 = ([[], [arg1, arg2]]: [unknown[], [boolean,boolean]]) => arg2;

		const Contextor1 = createContextor([ContextA], ([context]) => ({ ...context }), isEqualBasedOnArg1);
		const Contextor2 = createContextor([ContextB], ([context]) => ({ ...context }), isEqualBasedOnArg2);
		const Contextor3 = createContextor(
			[Contextor1, Contextor2],
			([contextor1, contextor2], arg: [boolean,boolean]) => ({ ...contextor1, ...contextor2 }));

		const renderCounts: Record<string, number> = {};

		const Consumer = memo(({ id, equal1, equal2 }: { id: string, equal1: boolean, equal2: boolean }) =>
			{
				const equal = useMemo(() => [equal1, equal2], [equal1, equal2]) as [boolean,boolean];
				const value = useContextor(Contextor3(equal));

				useEffect(() => { renderCounts[id] = (renderCounts[id] ?? 0) + 1 }, [value]);

				return <>{ JSON.stringify(value) }</>
			});

		let regenerate: () => void;
		
		const Consumers = () =>
			{
				const [salt, setSalt] = useState(1);
				
				regenerate = () => setSalt(salt => salt + 1);

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
			}

		render(<Consumers/>);

		expect(renderCounts).toMatchObject({ '00': 1, '01': 1, '10': 1, '11': 1 });

		act(() => regenerate());

		expect(renderCounts).toMatchObject({ '00': 2, '01': 2, '10': 2, '11': 1 });
	});