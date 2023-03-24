/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { assert } from "console";
import { createContext } from "contexto";
import { createContextor, useContextor } from "..";

const Context1 = createContext({ contextValue: 42 }, { contextId: "Context1" });

const consoleErrorFn = jest.spyOn(console, 'error').mockImplementation(() => jest.fn());

class ExpectedNumberError extends Error {}
class ExpectedStringError extends Error {}
class ExpectedBooleanError extends Error {}
class ExpectedObjectError extends Error {}
function expectNumber(x: number) { if (typeof x === "number") return x; throw new ExpectedNumberError(); }
function expectString(x: string) { if (typeof x === "string") return x; throw new ExpectedStringError(); }
function expectBoolean(x: boolean) { if (typeof x === "boolean") return x; throw new ExpectedBooleanError(); }
function expectObject<T extends object>(x: T): T { if (typeof x === "object") return x; throw new ExpectedObjectError(); }

test("Create and use contextor with single context input and mandatory argument", () =>
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

test("Create and use contextor with single context input and optional argument", () =>
	{
		const Contextor = createContextor(
			[Context1],
			([context1], arg: { stringArg: string } | undefined) =>
				String(expectNumber(context1.contextValue)) + expectString(arg?.stringArg ?? "")
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

test("Create and use contextor with single context input and no argument", () =>
	{
		const ArglessContextor = createContextor(
			[Context1],
			([context1]) => expectNumber(context1.contextValue) * 2
		);
		
		expect(renderHook(() =>
			useContextor(ArglessContextor)
		).result.current).toBe(42 * 2);
		
		expect(renderHook(() =>
			useContextor(ArglessContextor())			// Equivalent to bare call
		).result.current).toBe(42 * 2);
		
		expect(renderHook(() =>
			useContextor(ArglessContextor(undefined))	// equivalent to bare call
		).result.current).toBe(42 * 2);
	}
);

test("Create contextors with no inputs", () =>
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
	}
);

test("Create contextor from contextor inputs with simple/no arguments", () =>
	{
		// Building block: a contextor with a single context input and no arg
		const BaseInput = createContextor([Context1], ([context1]) => context1.contextValue);

		// Building block: a contextor with a single contextor input and no arg
		const Input0 = createContextor([BaseInput], ([baseInput]) => baseInput * 2);

		// Create a contextor that combines a Context and an argless Contextor
		const ContextCombinedWithArglessContextor = createContextor(
			[Context1, Input0],
			([context1, input0]) => expectNumber(context1.contextValue) + expectNumber(input0)
		);
		expect(renderHook(() =>
			useContextor(ContextCombinedWithArglessContextor)
		).result.current).toBe(42 + 42 * 2);

		// Create a contextor that combines a Context and a Contextor that requires an arg
		const Input1 = createContextor(
			[BaseInput],
			([baseInput], factor: number) =>
				expectNumber(baseInput) * expectNumber(factor)
		);
		const ContextCombinedWithArgContextor = createContextor(
			[Context1, Input1],
			([context1, input1]) => expectNumber(context1.contextValue) + expectNumber(input1)
		);
		expect(() => renderHook(() =>
			// @ts-expect-error -- required arg is being omitted
			useContextor(ContextCombinedWithArgContextor)
		)).toThrow(ExpectedNumberError);
		expect(renderHook(() =>
			useContextor(ContextCombinedWithArgContextor(3))
		).result.current).toBe(42 + 42 * 3);

		// Create a contextor that combines a Contextor that does not require an arg and a Contextor that requires an arg
		const ArglessContextorCombinedWithArgContextor = createContextor(
			[Input0, Input1],
			([input0, input1]) => expectNumber(input0) + expectNumber(input1)
		);
		expect(() => renderHook(() =>
			// @ts-expect-error -- required arg is being omitted
			useContextor(ArglessContextorCombinedWithArgContextor)
		)).toThrow(ExpectedNumberError);
		expect(renderHook(() =>
			useContextor(ArglessContextorCombinedWithArgContextor(3))
		).result.current).toBe(42 * 2 + 42 * 3);

		const Input2 = createContextor(
			[BaseInput],
			([baseInput], exp: number) =>
				Math.pow(expectNumber(baseInput), expectNumber(exp))
		);

		// Create a contextor that combines contextors with compatible args
		const CompatibleCombined = createContextor(
			[Input1, Input2],
			([input1, input2]) =>
				expectNumber(input1) + expectNumber(input2)
		);
		expect(renderHook(() =>
			useContextor(CompatibleCombined(2))
		).result.current).toBe(42 * 2 + 42 * 42)

		// Prevent creation of contextor that combines contextors with incompatible args
		const CompatibleCombinedWithOwnIncompatibleArg = createContextor(
			[Input1, Input2],
			// @ts-expect-error -- Input1 and Input2 have arg `number`, which is incompatible with combiner arg `string`
			([input1, input2], salt: string) =>
				expectString(salt).indexOf("x") + (expectNumber(input1) - expectNumber(input2))
		);
		expect(() => renderHook(() =>
			// @ts-expect-error -- CompatibleCombinedWithOwnIncompatibleArg is not a valid Contextor
			useContextor(CompatibleCombinedWithOwnIncompatibleArg(2))
		)).toThrow(ExpectedStringError);

		const Input3 = createContextor(
			[BaseInput],
			([baseInput], negate: boolean) =>
				expectBoolean(negate) ? -expectNumber(baseInput) : expectNumber(baseInput)
		);

		const IncompatibleCombined = createContextor(
			// @ts-expect-error -- Input1 and Input3 have incompatible arguments
			[Input1, Input3],
			([input1, input3]) =>
				// @ts-expect-error -- inputs have unknown types because of invalid invocation
				expectNumber(input1) * expectNumber(input3)
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- IncompatibleCombined is not a valid Contextor
			useContextor(IncompatibleCombined)
		)).toThrow(ExpectedNumberError);
		expect(() => renderHook(() =>
			// @ts-expect-error -- IncompatibleCombined is not a valid Contextor
			useContextor(IncompatibleCombined(true))
		)).toThrow(ExpectedNumberError);
	}
);

test("Create contextor from contextor inputs with structured arguments", () =>
	{
		const Input1 = createContextor(
			[Context1],
			([context1], arg: { numericArg: number }) =>
				expectNumber(context1.contextValue) + expectNumber(arg.numericArg)
		);
		const Input2 = createContextor(
			[Context1],
			([context1], arg: { stringArg: string }) =>
				expectNumber(context1.contextValue) * expectString(arg.stringArg).length
		);
		const Combined = createContextor(
			[Input1, Input2],
			([input1, input2]) =>
				String(expectNumber(input1)) + "/" + expectNumber(input2)
		);

		// Doesn't work as a bare contextor
		expect(() => renderHook(() =>
			// @ts-expect-error -- contextor requires an argument, so the bare call is forbidden
			useContextor(Combined)
		)).toThrow(TypeError);

		// Doesn't work if arg is empty
		expect(() => renderHook(() =>
			// @ts-expect-error -- {} does not satisfy { numericArg: number, stringArg: string }
			useContextor(Combined({}))
		)).toThrow(ExpectedNumberError);

		// Doesn't work if arg doesn't satisfy all the inputs
		expect(() => renderHook(() =>
			// @ts-expect-error -- { numericArg: number } does not satisfy { stringArg: string }
			useContextor(Combined({ numericArg: 3 }))
		)).toThrow(ExpectedStringError);

		// Works if arg satisfies both inputs
		expect(renderHook(() =>
			useContextor(Combined({ numericArg: 3, stringArg: "abcde" }))
		).result.current).toBe("45/210")

		// This should work -- { numericArg: number, stringArg: string } should satisfy both
		const CompatibleArg = createContextor(
			[Input1],
			([input1], arg: { stringArg: string }) =>
				expectNumber(input1) + "/" + expectString(arg.stringArg)
		);

		expect(renderHook(() =>
			useContextor(CompatibleArg({ numericArg: 1000, stringArg: "str" }))
		).result.current).toBe("1042/str");

		const IncompatibleArg = createContextor(
			[Input1],
			// @ts-expect-error -- { numericArg: number } is incompatible with { numericArg: string }
			([input1], arg: { numericArg: string }) =>
				input1 + arg.numericArg.length
		);
	}
);

test("Optional arg combinations", () =>
	{
		// Create contextor with optional structured arg
		const Input1 = createContextor(
			[Context1],
			([context1], arg: { stringArg: string } | undefined) =>
				expectNumber(context1.contextValue) * (arg ? expectString(arg.stringArg).length : 13)
		);

		// Can omit arg
		expect(renderHook(() =>
			useContextor(Input1)
		).result.current).toBe(42 * 13);

		// Can supply a correctly-formed arg
		expect(renderHook(() =>
			useContextor(Input1({ stringArg: "abc" }))
		).result.current).toBe(42 * 3);

		// Create contextor with required structured arg
		const Input2 = createContextor(
			[Context1],
			([context1], arg: { numericArg: number }) =>
				expectNumber(context1.contextValue) + expectNumber(expectObject(arg).numericArg)
		);

		// CANNOT omit arg
		expect(() => renderHook(() =>
			// @ts-expect-error -- { numericArg: number } cannot be omitted
			useContextor(Input2)
		)).toThrow(ExpectedObjectError);

		// Can supply a correctly-formed arg
		expect(renderHook(() =>
			useContextor(Input2({ numericArg: 23 }))
		).result.current).toBe(42 + 23);

		// Can combine contextors, but the arg of the resulting contextor is MANDATORY
		const Combined12 = createContextor(
			[Input1, Input2],
			([input1, input2]) =>
				String(expectNumber(input1)) + "/" + expectNumber(input2)
		);

		// Cannot omit arg
		expect(() => renderHook(() =>
			// @ts-expect-error -- arg cannot be omitted
			useContextor(Combined12)
		)).toThrow(ExpectedObjectError);

		// Cannot supply a partial type
		expect(() => renderHook(() =>
			// @ts-expect-error -- arg must supply entire input type
			useContextor(Combined12({ stringArg: "abc" }))
		)).toThrow(ExpectedNumberError);

		// Arg satisfies both inputs
		expect(renderHook(() =>
			useContextor(Combined12({ stringArg: "abc", numericArg: 5 }))
		).result.current).toBe((42 * 3) + "/" + (42 + 5));

		// Different input with optional and compatible arg
		const Input3 = createContextor(
			[Context1],
			([context1], arg: { numericArg: number } | undefined) =>
				expectNumber(context1.contextValue) * (arg ? expectNumber(arg.numericArg) : 23)
		);

		const Combined13 = createContextor(
			[Input1, Input3],
			([input1, input3], arg) =>
				input1 + input3 + (arg ? expectNumber(arg.numericArg) + expectString(arg.stringArg).length : 0)
		);

		expect(renderHook(() =>
			useContextor(Combined13())
		).result.current).toBe(42 * 13 + 42 * 23 + 0);

		expect(() => renderHook(() =>
			// @ts-expect-error -- missing stringArg
			useContextor(Combined13({ numericArg: 10 }))
		)).toThrow(ExpectedStringError);

		expect(renderHook(() =>
			useContextor(Combined13({ numericArg: 10, stringArg: "abcd" }))
		).result.current).toBe(42 * 4 + 42 * 10 + (10 + 4))

		const Combined23 = createContextor(
			[Input2, Input3],
			([input2, input3], arg) =>
				input2 + input3 + expectObject(arg).numericArg
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- Contextor2 arg is required, so the combined contextor arg is required
			useContextor(Combined23)
		)).toThrow(ExpectedObjectError);

		expect(renderHook(() =>
			useContextor(Combined23({ numericArg: 10 }))
		).result.current).toBe(42 + 10 + 42 * 10 + 10);
	}
);

test("Combining simple arg and structured arg should fail", () =>
	{
		const Input1 = createContextor(
			[Context1],
			([context1], arg: number) =>
				expectNumber(context1.contextValue) + expectNumber(arg)
		);
		const Input2 = createContextor(
			[Context1],
			([context1], arg: { numericArg: number }) =>
				expectNumber(context1.contextValue) + expectObject(arg).numericArg
		);

		const Combined = createContextor(
			// @ts-expect-error -- (number & { numericArg: number }) cannot be fulfilled
			[Input1, Input2],
			([input1, input2]) =>
				// @ts-expect-error -- inputs have unknown types because of invalid invocation
				input1 + input2
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- 42 doesn't satisfy { numericArg: number }
			useContextor(Combined(42))
		)).toThrow(ExpectedObjectError);

		const IncompatibleArg1 = createContextor(
			[Input1],
			// @ts-expect-error -- { numericArg: number } is not compatible with existing arg number
			([input1], arg: { numericArg: number }) =>
				expectNumber(input1) + expectObject(arg).numericArg
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- 42 doesn't satisfy { numericArg: number }
			useContextor(IncompatibleArg1(42))
		)).toThrow(ExpectedObjectError);

		const IncompatibleArg2 = createContextor(
			[Input2],
			// @ts-expect-error -- number is not compatible with { numericArg: number }
			([input2], arg: number) =>
				// @ts-expect-error -- improper contextor infers wrong type for input2
				expectObject(input2).numericArg + expectNumber(arg)
		);

		expect(() => renderHook(() =>
			// @ts-expect-error -- 42 doesn't satisfy number
			useContextor(IncompatibleArg2({ numericArg: 42 }))
		)).toThrow(ExpectedObjectError);
	}
);

test("Nested args", () =>
	{
		const Input1 = createContextor(
			[Context1],
			([context1], arg: { nested: { stringArg: string, extra: { deep: number } | number } }) =>
				`(${expectNumber(context1.contextValue)}, ${expectString(arg.nested.stringArg)})`
		);

		expect(renderHook(() =>
			useContextor(Input1({ nested: { stringArg: "hello", extra: 7 } }))
		).result.current).toBe("(42, hello)");

		const Extended = createContextor(
			[Input1],
			([input1], arg: { nested: { numericArg: number, extra: { deep: number } | number } }) =>
				{
					const { extra } = arg.nested;
					const num = expectNumber(extra instanceof Object ? extra.deep : extra);

					return `(${expectString(input1)}, ${expectNumber(arg.nested.numericArg)}, ${num})`;
				}
		);

		expect(renderHook(() =>
			useContextor(Extended({ nested: { stringArg: "howdy", numericArg: 9, extra: 7 } }))
		).result.current).toBe("((42, howdy), 9, 7)");

		const Input2 = createContextor(
			[Context1],
			([context1], arg: { nested: { numericArg: number } }) =>
				`(${context1.contextValue}, ${expectNumber(arg.nested.numericArg)})`
		);

		expect(renderHook(() =>
			useContextor(Input2({ nested: { numericArg: 99 } }))
		).result.current).toBe("(42, 99)");

		const Combined = createContextor(
			[Input1, Input2],
			([input1, input2], arg) =>
				{
					const { extra } = arg.nested;
					const num = expectNumber(extra instanceof Object ? extra.deep : extra);

					return `(${expectString(input1)}, ${expectString(input2)}, ${num})`;
				}
		)

		expect(renderHook(() =>
			useContextor(Combined({ nested: { stringArg: "ahoy", numericArg: 123, extra: { deep: 37 } } }))
		).result.current).toBe("((42, ahoy), (42, 123), 37)");
	});

test("Can't supply a raw context to useContextor", () =>
	{
		expect(() => renderHook(() =>
			// @ts-expect-error -- Context is not a Contextor
			useContextor(Context1)
		)).toThrow(TypeError);
	});

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