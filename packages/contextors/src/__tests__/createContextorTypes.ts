/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { createContext } from "contexto";
import { createContextor, useContextor } from "..";

const Context1 = createContext({ contextValue: 42 }, { contextId: "Context1" });

const consoleErrorFn = jest.spyOn(console, 'error').mockImplementation(() => jest.fn());

test("Create and use contextor with mandatory argument", () =>
	{
		const Contextor = createContextor(
			[Context1],
			([context1], arg: { numericArg: number }) =>
				context1.contextValue + arg.numericArg
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- contextor requires an argument, so the bare call is forbidden
			useContextor(Contextor)
		)).toThrow(TypeError);

		expect(renderHook(() =>
			useContextor(Contextor({ numericArg: 5 }))
		).result.current).toBe(42 + 5);
	}
);

test("Create and use contextor with optional argument", () =>
	{
		const Contextor = createContextor(
			[Context1],
			([context1], arg: { stringArg: string } | undefined) =>
				String(context1.contextValue) + (arg?.stringArg ?? "")
		);

		expect(renderHook(() =>
			useContextor(Contextor)
		).result.current).toBe("42");

		expect(renderHook(() =>
			useContextor(Contextor())			// Equivalent to bare call
		).result.current).toBe("42");

		expect(renderHook(() =>
			useContextor(Contextor(undefined))	// Equivalent to bare call
		).result.current).toBe("42");

		expect(renderHook(() =>
			useContextor(Contextor({ stringArg: "!" }))
		).result.current).toBe("42!");
	}
);

test("Create and use contextor with no argument", () =>
	{
		const Contextor = createContextor(
			[Context1],
			([context1]) => context1.contextValue * 2
		);
		
		expect(renderHook(() =>
			useContextor(Contextor)
		).result.current).toBe(42 * 2);
		
		expect(renderHook(() =>
			useContextor(Contextor())			// Equivalent to bare call
		).result.current).toBe(42 * 2);
		
		expect(renderHook(() =>
			useContextor(Contextor(undefined))	// equivalent to bare call
		).result.current).toBe(42 * 2);
	}
);

test("Create contextor from contextor inputs with structured arguments", () =>
	{
		const Input1 = createContextor([Context1], ([context1], arg: { numericArg: number }) => context1.contextValue + arg.numericArg);
		const Input2 = createContextor([Context1], ([context1], arg: { stringArg: string }) => context1.contextValue * arg.stringArg.length);

		const Contextor = createContextor([Input1, Input2], ([input1, input2]) => String(input1) + "/" + input2);

		expect(() => renderHook(() =>
			// @ts-expect-error -- contextor requires an argument, so the bare call is forbidden
			useContextor(Contextor)
		)).toThrow(TypeError);

		expect(() => renderHook(() =>
			// @ts-expect-error -- { numericArg: number } does not satisfy { stringArg: string }
			useContextor(Contextor({ numericArg: 3 }))			// Equivalent to bare call
		)).toThrow(TypeError);

		expect(renderHook(() =>
			useContextor(Contextor({ numericArg: 3, stringArg: "abcdefghij" }))
		).result.current).toBe("45/420")
	}
);

test("Create contextor from contextor inputs with simple/no arguments", () =>
	{
		// Weird, but we'll allow it
		const Trivial = createContextor([], ([]) => 23);
		expect(renderHook(() =>
			useContextor(Trivial)
		).result.current).toBe(23);

		// Possibly even weirder, but we'll allow it too
		const TrivialWithArg = createContextor([], ([], arg: number) => 23 + arg);
		expect(renderHook(() =>
			useContextor(TrivialWithArg(37))
		).result.current).toBe(23 + 37);

		// Basic: create a contextor just from a context
		const Contextor = createContextor([Context1], ([context1]) => context1.contextValue);
		expect(renderHook(() =>
			useContextor(Contextor)
		).result.current).toBe(42);

		// Create a contextor that combines a Context and an argless Contextor
		const Input0 = createContextor([Contextor], ([contextor]) => contextor * 2);
		const ContextCombinedWithArglessContextor = createContextor([Context1, Input0], ([context1, input0]) => context1.contextValue + input0);
		expect(renderHook(() =>
			useContextor(ContextCombinedWithArglessContextor)
		).result.current).toBe(42 + 42 * 2);

		// Create a contextor that combines a Context and a Contextor that requires an arg
		const Input1 = createContextor([Contextor], ([contextor], factor: number) => contextor * factor);
		const ContextCombinedWithArgContextor = createContextor([Context1, Input1], ([context1, input1]) => context1.contextValue + input1);
		expect(renderHook(() =>
			// @ts-expect-error -- required arg is being omitted
			useContextor(ContextCombinedWithArgContextor)
		).result.current).toBeNaN();
		expect(renderHook(() =>
			useContextor(ContextCombinedWithArgContextor(3))
		).result.current).toBe(42 + 42 * 3);

		// Create a contextor that combines a Contextor that does not require an arg and a Contextor that requires an arg
		const ArglessContextorCombinedWithArgContextor = createContextor([Input0, Input1], ([input0, input1]) => input0 + input1);
		expect(renderHook(() =>
			// @ts-expect-error -- required arg is being omitted
			useContextor(ArglessContextorCombinedWithArgContextor)
		).result.current).toBeNaN();
		expect(renderHook(() =>
			useContextor(ArglessContextorCombinedWithArgContextor(3))
		).result.current).toBe(42 * 2 + 42 * 3);


		const Input2 = createContextor([Contextor], ([contextor], negate: boolean) => negate ? -contextor : contextor);

		// @ts-expect-error -- input1 and input2 have incompatible arguments
		const IncompatibleCombined = createContextor([Input1, Input2], ([input1, input2]) => input1 * input2);

		expect(renderHook(() =>
			// @ts-expect-error -- IncompatibleCombined is not a valid Contextor
			useContextor(IncompatibleCombined)
		).result.current).toBeNaN();	// because supplying an undefined `factor` to `Input1` results in NaN

		const Input3 = createContextor([Contextor], ([contextor], exp: number) => Math.pow(contextor, exp));

		const CompatibleCombined = createContextor([Input1, Input3], ([input1, input3]) => input1 + input3);

		expect(renderHook(() =>
			useContextor(CompatibleCombined(2))
		).result.current).toBe(42 * 2 + 42 * 42)

		// @ts-expect-error -- Input1 and Input3 have arg `number`, which is incompatible with combiner arg `string`
		const CompatibleCombinedWithOwnIncompatibleArg = createContextor([Input1, Input3], ([input1, input3], salt: string) => salt.indexOf("x") + (input1 - input3));

		expect(() => renderHook(() =>
			// @ts-expect-error -- CompatibleCombinedWithOwnIncompatibleArg is not a valid Contextor
			useContextor(CompatibleCombinedWithOwnIncompatibleArg(2))
		)).toThrow(TypeError);

	}
)

/*
const contextValue1 = createContext({ contextValue: 42 }, { contextId: "Context1" });

const F1 = createContextor([contextValue1], ([s], arg: { cArg: number }) => 3);
const F2 = createContextor([contextValue1], ([s], arg: { dArg: string } | undefined) => "Sadf");

const FInput = createContextor([F1, F2], ([v1, v2], arg: { cArg: number, dArg: string }) => ({ val: "ADf" }));
const GInput = createContextor([FInput, F1], ([v1, v2], arg: { cArg: number }) => "ASdf")

const F3 = createContextor([contextValue1], ([s], arg: { c: number, d?: string }) => 3 + (arg.c ?? 0));
const F4 = createContextor([F3], ([s], arg: { c: number } | undefined) => null);
const F5 = createContextor([F4], ([s], arg: { blern: string }) => String(s) + arg.blern);

const F6 = createContextor([F1], ([s], arg: { cArg: string }) => null);	// error: { cArg: string } is incompatible with { cArg: number }

const G0 = createContext({ a: 22 });
const G1 = createContextor([G0], ([g0]) => g0.a);
const G2 = createContextor([G0, G1], ([g0, g1]) => g0.a + g1);
const G3 = createContextor([G0, G1], ([g0, g1], factor: number) => g0.a + g1 * factor);
const G4 = createContextor([G2, G3], ([g2, g3]) => g2 + g3);
const G5 = createContextor([G2, G3], ([g2, g3], negate: boolean) => negate ? -(g2 + g3) : (g2 + g3));	// error: boolean is incompatible with number
const G6 = createContextor([G2, G1], ([g2, g1], negate: number | undefined) => g2 + g1);
const G7 = createContextor([G2, G1], ([g2, g1], negate: number) => g2 + g1);

F1();		// error: expects arg

F2();

F2({});		// error: must supply dArg

F2({ dArg: "Asdf" });
FInput({ cArg: 3, dArg: "asdf" });

GInput();	// error: expects arg

GInput({ cArg: 3, dArg: "asdf" });

F3();		// error: expects { c, d? }

F3({ c: 3 });
F3({ c: 3, d: "Adsf" });
F4({ c: 9 });
F5({ blern: "3", c: 3, d: undefined });

G1();
G2();
G3(5);

G4(); 		// error: wants a number

G4(3);

G5(true); 	// error: nothing satisfies number & boolean

G6(3);
G7(3);

useContextor(contextValue1);	// error: context is not a contextor

useContextor(F1);				// error: F1 requires { cArg }

useContextor(F1({ cArg: 3 }));
useContextor(F2);
useContextor(F2());
useContextor(F2({ dArg: "asdf" }));

useContextor(F3);				// error: F3 requires args

useContextor(F3({ c: 3 }));

useContextor(F4);				// error: F4 requires args

useContextor(F4());				// error: F4 requires args

useContextor(F4({ }));			// error: F4 requires c

useContextor(F4({ c: 3 }));
useContextor(F5({ blern: "Asdf", c: 3 }));

useContextor(G0);				// error: context is not a contextor

useContextor(G1);
useContextor(G2);

useContextor(G3);				// error: requires param

useContextor(G3(3));

useContextor(G4);				// error: requires param

useContextor(G4(3));

useContextor(G5(false));		// error: boolean & number is never

useContextor(G6);
useContextor(G6(3));

useContextor(G7);				// error: requires number

useContextor(G7(3));

const G8 = createContextor([G0], ([g0], arg: { foo: number }) => 3);
const G9 = createContextor([G8], ([g8], arg: { foo: number } | undefined) => 3);

const G10 = createContextor([G8], ([g0], arg: { foo: string }) => 3);	// error: { foo: string } is incompatible with { foo: number }
const G11 = createContextor([G10], ([g10], arg: any) => 3);				// error: can't use unusable contextor as input

const G12 = createContextor([contextValue1], ([v1]) => String(3));
const G13 = createContextor([G12], ([g12], arg?: { nest1: { nest: number } }) => String(arg ? arg.nest1.nest + 3 : 3) + g12);
const G14 = createContextor([G13], ([g13], arg?: { nest2: { nest: number } }) => String(arg ? arg.nest2.nest + 3 : 3) + g13);

const G15 = createContextor([contextValue1], ([v1], arg: [first: number, second: string]) => String(3 + arg[0]));
const G16 = createContextor([G15], ([g15], arg: [first: number, second: string]) => String(3 + arg[0]));
*/