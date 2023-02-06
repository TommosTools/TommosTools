/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/react";
import { ReactNode, useEffect, useState, createContext as createReactContext, useRef } from "react";
import { act } from "react-dom/test-utils";
import { createContext, createProxyContext, useContextUpdate, useSubscriber } from "..";

const Context1 = createContext(111, { contextId: "context1" });
const Context2 = createContext("two", { contextId: "context2" });

const RawContext = createReactContext(-1);
const Context3 = createProxyContext(RawContext, { contextId: "context3" });

test("useSubscriber", async () =>
	{
		let value1 = 0;
		let updateCount1 = 0;
		const listener1 = (newValue: number) =>
			{
				value1 = newValue;
				++updateCount1;
			};
		let unsubscribe1: () => void;

		let value2 = "";
		let updateCount2 = 0;
		const listener2 = (newValue: string) =>
			{
				value2 = newValue;
				++updateCount2;
			};
		let unsubscribe2: () => void;

		let updateCount3 = 0;
		const listener3 = () => { ++updateCount3; }
		
		let propUpdate: (val: number) => void = () => {};
		let hookUpdate: (val: number) => void = () => {};

		const Provider1 = ({ children }: { children: ReactNode }) =>
			{
				const [val, setVal] = useState(222);
				propUpdate = setVal;
				return <Context1.Provider children={children} value={val} />
			}
		
		const Updater1 = () =>
			{
				hookUpdate = useContextUpdate(Context1);
				return null;
			}

		const Subscriber = () =>
			{
				const subscribe = useSubscriber();

				useEffect(() =>
					{
						[value1, unsubscribe1] = subscribe(Context1, listener1);
						[value2, unsubscribe2] = subscribe(Context2, listener2);
						subscribe(Context1, listener3);
					},
					[]
				);

				return null;
			}
				
		const Component = () =>
			<Provider1>
				<Updater1/>
				<Subscriber/>
			</Provider1>

		render(<Component/>);

		expect(value1).toBe(222);
		expect(value2).toBe("two");
		expect(updateCount1).toBe(0);
		expect(updateCount2).toBe(0);

		act(() => propUpdate(333));
		expect(value1).toBe(333);
		expect(updateCount1).toBe(1);

		// setting a prop to the same value should not call listener
		act(() => propUpdate(333));
		expect(value1).toBe(333);
		expect(updateCount1).toBe(1);

		act(() => hookUpdate(444));
		expect(value1).toBe(444);
		expect(updateCount1).toBe(2);

		// updating with hook with same value DOES call the listener again
		act(() => hookUpdate(444));
		expect(value1).toBe(444);
		expect(updateCount1).toBe(3);

		expect(updateCount2).toBe(0);

		// multiple listeners to the same context work okay
		expect(updateCount3).toBe(3);
	});

jest.useFakeTimers();

test("useSubscriber with ProxyContext", async () =>
	{
		const Provider = ({ children }: { children: ReactNode }) =>
			{
				const [tick, setTick] = useState(0);
				useEffect(() => {
					const intervalId = setInterval(() => setTick(tick => tick + 1), 1000);
					return () => clearInterval(intervalId);
				});
				return <RawContext.Provider value={tick} children={children} />
			};

		let updateCount = 0;
		let sum = 0;
		const listener = (newValue: number) => {
			++updateCount;
			sum += newValue;
		}

		const Subscriber = () =>
			{
				const subscribe = useSubscriber();

				useEffect(() =>
					{
						let unsubscribe;
						[sum, unsubscribe] = subscribe(Context3, listener);
						return unsubscribe;
					},
					[]
				);

				return null;
			}
		
		render(<Provider><Subscriber/></Provider>);

		expect(updateCount).toBe(0);
		expect(sum).toBe(0);

		for (let i=1, j=1; i <= 5; ++i, j += i)
		{
			act(() => jest.advanceTimersByTime(1000));
			expect(updateCount).toBe(i);
			expect(sum).toBe(j);
		}
	});