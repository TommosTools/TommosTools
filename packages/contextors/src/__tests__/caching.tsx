/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { act } from "react-dom/test-utils";
import { createContext, INHERIT, useContextUpdate, ValueUpdater } from "contexto";
import { createContextor, useContextor } from "..";

test("caching", async () =>
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