/**
 * @jest-environment jsdom
 */

 import { useEffect, useRef, useState } from "react";
 import { render, screen } from "@testing-library/react";
 import "@testing-library/jest-dom";
 import userEvent from "@testing-library/user-event";
 import { createContext, useContext, useContexts, useContextUpdate } from "..";
 import { Context, ContextDict, ContextTuple, ProviderRef } from "../types/";
 
 const Render = <T,>({ context, testId }: { context: Context<T>, testId?: string }) =>
     <span data-testid={testId}>{ JSON.stringify(useContext(context)) }</span>

test("Changing context list for useContexts", async () =>
    {
        const user = userEvent.setup();

        const Context1 = createContext("value1", { contextId: "test1" });
        const Context2 = createContext("value2", { contextId: "test2" });
        const Context3 = createContext("value3", { contextId: "test3" });

        const Component = () =>
            {
                const [contexts, setContexts] = useState<ContextTuple | ContextDict>([Context1, Context2]);
                const value = JSON.stringify(useContexts(contexts));

                return <>
                    <button data-testid="ClickTarget1" onClick={ () => setContexts([Context2, Context3]) }>click</button>
                    <button data-testid="ClickTarget2" onClick={ () => setContexts({ one: Context1, two: Context2 }) }>click</button>
                    <span data-testid="UseContexts.Output">{value}</span>
                </>;
            }

        render(<Component/>);

        expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('["value1","value2"]');

        await user.click(screen.getByTestId("ClickTarget1"));
        expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('["value2","value3"]');

        await user.click(screen.getByTestId("ClickTarget2"));
        expect(screen.getByTestId("UseContexts.Output")).toHaveTextContent('{"one":"value1","two":"value2"}');
    });