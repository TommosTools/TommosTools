/**
 * @jest-environment jsdom
 */

import React, { ReactNode, useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createContext, useContextUpdate, ContextType } from "contexto";
import { useContextSelector } from "..";
import { act } from "react-dom/test-utils";

const Context1 = createContext({ top: 111, nested: { inner: 222 }});
type Type1 = ContextType<typeof Context1>;

test("useContextSelector selects from context", async () =>
	{
		const renderCounts: Record<string, number> = {};

		const Selector = ({ testId }: { testId: string }) =>
			{
				const value = useContextSelector(Context1, (value) => JSON.stringify(value.nested));
				renderCounts[testId] = (renderCounts[testId] ?? 0) + 1;
				return <span data-testid={testId}>{value} / {renderCounts[testId]}</span>
			}

		let updateWithProp: (value: Type1) => void;
		const UpdateProvider = ({ initialValue, children }: { initialValue: Type1, children: ReactNode }) =>
			{
				const [value, setValue] = useState(initialValue);
				updateWithProp = setValue;
				return <Context1.Provider value={value} children={children} />
			};
		
		let updateWithHook: (value: Type1) => void;
		const UpdateConsumer = () =>
			{
				updateWithHook = useContextUpdate(Context1);
				return null;
			}

		const Component = () =>
			<>
				<Selector testId="test1" />
				<UpdateProvider initialValue={{ top: 112, nested: { inner: 222 } }}>
					<Selector testId="test2" />
				</UpdateProvider>
				<Context1.Provider value={{ top: 113, nested: { inner: 224 } }}>
					<UpdateConsumer/>
					<Selector testId="test3" />
				</Context1.Provider>
			</>

		render(<Component/>);

		expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":222} / 1');
		expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":222} / 1');
		expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":224} / 1');

		act(() => updateWithProp({ top: 114, nested: { inner: 225 } }));
		act(() => updateWithHook({ top: 115, nested: { inner: 226 } }));

		expect(screen.getByTestId("test1")).toHaveTextContent('{"inner":222} / 1');
		expect(screen.getByTestId("test2")).toHaveTextContent('{"inner":225} / 2');
		expect(screen.getByTestId("test3")).toHaveTextContent('{"inner":226} / 2');

	});