/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/react";
import { ReactNode, useEffect, useState } from "react";
import { act } from "react-dom/test-utils";
import { createContext, useContextUpdate, useSubscriber } from "..";

const Context1 = createContext(111, { contextId: "context1" });
const Context2 = createContext("two", { contextId: "context2" });

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