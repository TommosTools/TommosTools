/* eslint-disable max-classes-per-file */

import { renderHook } from "@testing-library/react";
import { createContext } from "contexto";
import { createContextor, useContextor } from "..";

const Context1 = createContext({ contextValue: 42 }, { contextId: "Context1" });

// Silence the console errors
jest.spyOn(console, "error").mockImplementation(() => jest.fn());

class ExpectedNumberError extends Error {}	// eslint-disable-line @typescript-eslint/brace-style
class ExpectedStringError extends Error {}	// eslint-disable-line @typescript-eslint/brace-style
class ExpectedBooleanError extends Error {}	// eslint-disable-line @typescript-eslint/brace-style
class ExpectedObjectError extends Error {}	// eslint-disable-line @typescript-eslint/brace-style
function expectNumber(x: number)
{
	if (typeof x === "number")
		return x;
	throw new ExpectedNumberError();
}
function expectString(x: string)
{
	if (typeof x === "string")
		return x;
	throw new ExpectedStringError();
}
function expectBoolean(x: boolean)
{
	if (typeof x === "boolean")
		return x;
	throw new ExpectedBooleanError();
}
function expectObject<T extends object>(x: T): T
{
	if (typeof x === "object")
		return x;
	throw new ExpectedObjectError();
}

test("Create and use contextor with single context source and mandatory tag", () =>
{
	const Contextor = createContextor(
		[Context1],
		(context1, tag: { numericVal: number }) => context1.contextValue + tag.numericVal
	);

	expect(() => renderHook(
		// @ts-expect-error -- contextor requires a tag, so the bare call is forbidden
		() => useContextor(Contextor)
	)).toThrow(TypeError);

	expect(renderHook(
		() => useContextor(Contextor, { numericVal: 5 })
	).result.current).toBe(42 + 5);
});

test("Create and use contextor with single context source and optional tag", () =>
{
	const Contextor = createContextor(
		[Context1],
		(context1, tag: { stringVal: string } | undefined) => (
			String(expectNumber(context1.contextValue)) + expectString(tag?.stringVal ?? "")
		)
	);

	expect(renderHook(
		() => useContextor(Contextor)
	).result.current).toBe("42");

	expect(renderHook(
		() => useContextor(Contextor, undefined)	// Equivalent to bare call
	).result.current).toBe("42");

	expect(renderHook(
		() => useContextor(Contextor, { stringVal: "!" })
	).result.current).toBe("42!");
});

test("Create and use contextor with single context source and no tag", () =>
{
	const TaglessContextor = createContextor(
		[Context1],
		(context1) => expectNumber(context1.contextValue) * 2
	);

	expect(renderHook(
		() => useContextor(TaglessContextor)
	).result.current).toBe(42 * 2);

	expect(renderHook(
		() => useContextor(TaglessContextor, undefined)	// equivalent to bare call
	).result.current).toBe(42 * 2);
});

test("Create contextors with no sources", () =>
{
	// Weird, but we'll allow it
	const Trivial = createContextor([], () => 23);
	expect(renderHook(
		() => useContextor(Trivial)
	).result.current).toBe(23);

	// Possibly even weirder, but we'll allow it too
	const TrivialWithTag = createContextor([], (tag: number) => 23 + tag);
	expect(renderHook(
		() => useContextor(TrivialWithTag, 37)
	).result.current).toBe(23 + 37);
});

test("Create contextor from contextor sources with simple/no tags", () =>
{
	// Building block: a contextor with a single context source and no tag
	const BaseSource = createContextor([Context1], (context1) => context1.contextValue);

	// Building block: a contextor with a single contextor source and no tag
	const Source0 = createContextor([BaseSource], (baseSource) => baseSource * 2);

	// Create a contextor that combines a Context and an tagless Contextor
	const ContextCombinedWithTaglessContextor = createContextor(
		[Context1, Source0],
		(context1, sourceValue0) => expectNumber(context1.contextValue) + expectNumber(sourceValue0)
	);
	expect(renderHook(
		() => useContextor(ContextCombinedWithTaglessContextor)
	).result.current).toBe(42 + 42 * 2);

	// Create a contextor that combines a Context and a Contextor that requires a tag
	const Source1 = createContextor(
		[BaseSource],
		(baseSourceValue, factor: number) => expectNumber(baseSourceValue) * expectNumber(factor)
	);
	const ContextCombinedWithTagContextor = createContextor(
		[Context1, Source1],
		(context1, sourceValue1) => expectNumber(context1.contextValue) + expectNumber(sourceValue1)
	);
	expect(() => renderHook(
		// @ts-expect-error -- required tag is being omitted
		() => useContextor(ContextCombinedWithTagContextor)
	)).toThrow(ExpectedNumberError);
	expect(renderHook(
		() => useContextor(ContextCombinedWithTagContextor, 3)
	).result.current).toBe(42 + 42 * 3);

	// Create a contextor that combines a Contextor that does not require a tag and a Contextor that requires a tag
	const TaglessContextorCombinedWithTagContextor = createContextor(
		[Source0, Source1],
		(sourceValue0, sourceValue1) => expectNumber(sourceValue0) + expectNumber(sourceValue1)
	);
	expect(() => renderHook(
		// @ts-expect-error -- required tag is being omitted
		() => useContextor(TaglessContextorCombinedWithTagContextor)
	)).toThrow(ExpectedNumberError);
	expect(renderHook(
		() => useContextor(TaglessContextorCombinedWithTagContextor, 3)
	).result.current).toBe(42 * 2 + 42 * 3);

	const Source2 = createContextor(
		[BaseSource],
		(baseSourceValue, exp: number) => expectNumber(baseSourceValue) ** expectNumber(exp)
	);

	// Create a contextor that combines contextors with compatible tags
	const CompatibleCombined = createContextor(
		[Source1, Source2],
		(sourceValue1, sourceValue2) => expectNumber(sourceValue1) + expectNumber(sourceValue2)
	);
	expect(renderHook(
		() => useContextor(CompatibleCombined, 2)
	).result.current).toBe(42 * 2 + 42 * 42);

	// Prevent creation of contextor that combines contextors with incompatible tags
	const CompatibleCombinedWithOwnIncompatibleTag = createContextor(
		[Source1, Source2],
		// @ts-expect-error -- Source1 and Source2 have tag `number`, which is incompatible with combiner tag `string`
		(sourceValue1, sourceValue2, salt: string) => (
			expectString(salt).indexOf("x") + (expectNumber(sourceValue1) - expectNumber(sourceValue2))
		)
	);
	expect(() => renderHook(
		// @ts-expect-error -- CompatibleCombinedWithOwnIncompatibleTag is not a valid Contextor
		() => useContextor(CompatibleCombinedWithOwnIncompatibleTag, 2)
	)).toThrow(ExpectedStringError);

	const Source3 = createContextor(
		[BaseSource],
		(baseSourceValue, negate: boolean) => (
			expectBoolean(negate) ? -expectNumber(baseSourceValue) : expectNumber(baseSourceValue)
		)
	);

	const IncompatibleCombined = createContextor(
		// @ts-expect-error -- Source1 and Source3 have incompatible tags
		[Source1, Source3],
		(sourceValue1, sourceValue3) => (
			// @ts-expect-error -- sources have unknown types because of invalid invocation
			expectNumber(sourceValue1) * expectNumber(sourceValue3)
		)
	);

	expect(() => renderHook(
		// @ts-expect-error -- IncompatibleCombined is not a valid Contextor
		() => useContextor(IncompatibleCombined)
	)).toThrow(ExpectedNumberError);
	expect(() => renderHook(
		// @ts-expect-error -- IncompatibleCombined is not a valid Contextor
		() => useContextor(IncompatibleCombined, true)
	)).toThrow(ExpectedNumberError);
});

test("Create contextor from contextor sources with structured tags", () =>
{
	const Source1 = createContextor(
		[Context1],
		(context1, tag: { numericVal: number }) => (
			expectNumber(context1.contextValue) + expectNumber(tag.numericVal)
		)
	);
	const Source2 = createContextor(
		[Context1],
		(context1, tag: { stringVal: string }) => (
			expectNumber(context1.contextValue) * expectString(tag.stringVal).length
		)
	);
	const Combined = createContextor(
		[Source1, Source2],
		(sourceValue1, sourceValue2) => (
			`${expectNumber(sourceValue1)}/${expectNumber(sourceValue2)}`
		)
	);

	// Doesn't work as a bare contextor
	expect(() => renderHook(
		// @ts-expect-error -- contextor requires a tag, so the bare call is forbidden
		() => useContextor(Combined)
	)).toThrow(TypeError);

	// Doesn't work if tag is empty
	expect(() => renderHook(
		// @ts-expect-error -- {} does not satisfy { numericVal: number, stringVal: string }
		() => useContextor(Combined, {})
	)).toThrow(ExpectedNumberError);

	// Doesn't work if tag doesn't satisfy all the sources
	expect(() => renderHook(
		// @ts-expect-error -- { numericVal: number } does not satisfy { stringVal: string }
		() => useContextor(Combined, { numericVal: 3 })
	)).toThrow(ExpectedStringError);

	// Works if tag satisfies both sources
	expect(renderHook(
		() => useContextor(Combined, { numericVal: 3, stringVal: "abcde" })
	).result.current).toBe("45/210");

	// This should work -- { numericVal: number, stringVal: string } should satisfy both
	const CompatibleTag = createContextor(
		[Source1],
		(sourceValue1, tag: { stringVal: string }) => (
			`${expectNumber(sourceValue1)}/${expectString(tag.stringVal)}`
		)
	);

	expect(renderHook(
		() => useContextor(CompatibleTag, { numericVal: 1000, stringVal: "str" })
	).result.current).toBe("1042/str");

	// IncompatibleTag
	createContextor(
		[Source1],
		// @ts-expect-error -- { numericVal: number } is incompatible with { numericVal: string }
		(sourceValue1, tag: { numericVal: string }) => sourceValue1 + tag.numericVal.length
	);
});

test("Optional tag combinations", () =>
{
	// Create contextor with optional structured tag
	const Source1 = createContextor(
		[Context1],
		(context1, tag: { stringVal: string } | undefined) => (
			expectNumber(context1.contextValue) * (tag ? expectString(tag.stringVal).length : 13)
		)
	);

	// Can omit tag
	expect(renderHook(
		() => useContextor(Source1)
	).result.current).toBe(42 * 13);

	// Can supply a correctly-formed tag
	expect(renderHook(
		() => useContextor(Source1, { stringVal: "abc" })
	).result.current).toBe(42 * 3);

	// Create contextor with required structured tag
	const Source2 = createContextor(
		[Context1],
		(context1, tag: { numericVal: number }) => (
			expectNumber(context1.contextValue) + expectNumber(expectObject(tag).numericVal)
		)
	);

	// CANNOT omit tag
	expect(() => renderHook(
		// @ts-expect-error -- { numericVal: number } cannot be omitted
		() => useContextor(Source2)
	)).toThrow(ExpectedObjectError);

	// Can supply a correctly-formed tag
	expect(renderHook(
		() => useContextor(Source2, { numericVal: 23 })
	).result.current).toBe(42 + 23);

	// Can combine contextors, but the tag of the resulting contextor is MANDATORY
	const Combined12 = createContextor(
		[Source1, Source2],
		(sourceValue1, sourceValue2) => (
			`${expectNumber(sourceValue1)}/${expectNumber(sourceValue2)}`
		)
	);

	// Cannot omit tag
	expect(() => renderHook(
		// @ts-expect-error -- tag cannot be omitted
		() => useContextor(Combined12)
	)).toThrow(ExpectedObjectError);

	// Cannot supply a partial type
	expect(() => renderHook(
		// @ts-expect-error -- tag must supply entire source type
		() => useContextor(Combined12, { stringVal: "abc" })
	)).toThrow(ExpectedNumberError);

	// Tag satisfies both sources
	expect(renderHook(
		() => useContextor(Combined12, { stringVal: "abc", numericVal: 5 })
	).result.current).toBe(`${42 * 3}/${42 + 5}`);

	// Different source with optional and compatible tag
	const Source3 = createContextor(
		[Context1],
		(context1, tag: { numericVal: number } | undefined) => (
			expectNumber(context1.contextValue) * (tag ? expectNumber(tag.numericVal) : 23)
		)
	);

	const Combined13 = createContextor(
		[Source1, Source3],
		(sourceValue1, sourceValue3, tag) => (
			sourceValue1 + sourceValue3 + (tag ? expectNumber(tag.numericVal) + expectString(tag.stringVal).length : 0)
		)
	);

	expect(renderHook(
		() => useContextor(Combined13)
	).result.current).toBe(42 * 13 + 42 * 23 + 0);

	expect(() => renderHook(
		// @ts-expect-error -- missing stringVal
		() => useContextor(Combined13, { numericVal: 10 })
	)).toThrow(ExpectedStringError);

	expect(renderHook(
		() => useContextor(Combined13, { numericVal: 10, stringVal: "abcd" })
	).result.current).toBe(42 * 4 + 42 * 10 + (10 + 4));

	const Combined23 = createContextor(
		[Source2, Source3],
		(sourceValue2, sourceValue3, tag) => (
			sourceValue2 + sourceValue3 + expectObject(tag).numericVal
		)
	);

	expect(() => renderHook(
		// @ts-expect-error -- Contextor2 tag is required, so the combined contextor tag is required
		() => useContextor(Combined23)
	)).toThrow(ExpectedObjectError);

	expect(renderHook(
		() => useContextor(Combined23, { numericVal: 10 })
	).result.current).toBe(42 + 10 + 42 * 10 + 10);
});

test("Combining simple tag and structured tag should fail", () =>
{
	const Source1 = createContextor(
		[Context1],
		(context1, tag: number) => (
			expectNumber(context1.contextValue) + expectNumber(tag)
		)
	);
	const Source2 = createContextor(
		[Context1],
		(context1, tag: { numericVal: number }) => (
			expectNumber(context1.contextValue) + expectObject(tag).numericVal
		)
	);

	const Combined = createContextor(
		// @ts-expect-error -- (number & { numericVal: number }) cannot be fulfilled
		[Source1, Source2],
		(sourceValue1, sourceValue2) => (
			// @ts-expect-error -- sources have unknown types because of invalid invocation
			sourceValue1 + sourceValue2
		)
	);

	expect(() => renderHook(
		// @ts-expect-error -- 42 doesn't satisfy { numericVal: number }
		() => useContextor(Combined, 42)
	)).toThrow(ExpectedObjectError);

	const IncompatibleTag1 = createContextor(
		[Source1],
		// @ts-expect-error -- { numericVal: number } is not compatible with existing tag number
		(sourceValue1, tag: { numericVal: number }) => (
			expectNumber(sourceValue1) + expectObject(tag).numericVal
		)
	);

	expect(() => renderHook(
		// @ts-expect-error -- 42 doesn't satisfy { numericVal: number }
		() => useContextor(IncompatibleTag1, 42)
	)).toThrow(ExpectedObjectError);

	const IncompatibleTag2 = createContextor(
		[Source2],
		// @ts-expect-error -- number is not compatible with { numericVal: number }
		(sourceValue2, tag: number) => (
			// @ts-expect-error -- improper contextor infers wrong type for sourceValue2
			expectObject(sourceValue2).numericVal + expectNumber(tag)
		)
	);

	expect(() => renderHook(
		// @ts-expect-error -- 42 doesn't satisfy number
		() => useContextor(IncompatibleTag2, { numericVal: 42 })
	)).toThrow(ExpectedObjectError);
});

test("Nested tags", () =>
{
	const Source1 = createContextor(
		[Context1],
		(context1, tag: { nested: { stringVal: string, extra: { deep: number } | number } }) => (
			`(${expectNumber(context1.contextValue)}, ${expectString(tag.nested.stringVal)})`
		)
	);

	expect(renderHook(
		() => useContextor(Source1, { nested: { stringVal: "hello", extra: 7 } })
	).result.current).toBe("(42, hello)");

	const Extended = createContextor(
		[Source1],
		(sourceValue1, tag: { nested: { numericVal: number, extra: { deep: number } | number } }) =>
		{
			const { extra } = tag.nested;
			const num = expectNumber(extra instanceof Object ? extra.deep : extra);

			return `(${expectString(sourceValue1)}, ${expectNumber(tag.nested.numericVal)}, ${num})`;
		}
	);

	expect(renderHook(
		() => useContextor(Extended, { nested: { stringVal: "howdy", numericVal: 9, extra: 7 } })
	).result.current).toBe("((42, howdy), 9, 7)");

	const Source2 = createContextor(
		[Context1],
		(context1, tag: { nested: { numericVal: number } }) => (
			`(${context1.contextValue}, ${expectNumber(tag.nested.numericVal)})`
		)
	);

	expect(renderHook(
		() => useContextor(Source2, { nested: { numericVal: 99 } })
	).result.current).toBe("(42, 99)");

	const Combined = createContextor(
		[Source1, Source2],
		(sourceValue1, sourceValue2, tag) =>
		{
			const { extra } = tag.nested;
			const num = expectNumber(extra instanceof Object ? extra.deep : extra);

			return `(${expectString(sourceValue1)}, ${expectString(sourceValue2)}, ${num})`;
		}
	);

	expect(renderHook(
		() => useContextor(Combined, { nested: { stringVal: "ahoy", numericVal: 123, extra: { deep: 37 } } })
	).result.current).toBe("((42, ahoy), (42, 123), 37)");
});

test("Can't supply a raw context to useContextor", () =>
{
	expect(() => renderHook(
		// @ts-expect-error -- Context is not a Contextor
		() => useContextor(Context1)
	)).toThrow(TypeError);
});

test("test indexable tag merging with keyed tag", () =>
{
	const Source1 = createContextor(
		[Context1],
		(context1, tag: { [k: string]: number }) => `(${context1.contextValue}, ${JSON.stringify(tag)})`
	);
	const Source2 = createContextor(
		[Context1],
		(context1, tag: { foo: number }) => `(${context1.contextValue}, ${expectNumber(tag.foo)})`
	);

	const CombinedContextor = createContextor(
		[Source1, Source2],
		(sourceValue1, sourceValue2) => `(${sourceValue1}, ${sourceValue2})`
	);

	expect(() => renderHook(
		// @ts-expect-error -- tag is required
		() => useContextor(CombinedContextor)
	)).toThrow(TypeError);

	expect(renderHook(
		() => useContextor(CombinedContextor, { foo: 23 })
	).result.current).toBe("((42, {\"foo\":23}), (42, 23))");
});

test("Combiner using rest parameter", () =>
{
	const ContextA = createContext("a", { contextId: "a" });
	const ContextB = createContext("b", { contextId: "b" });
	const ContextC = createContext("c", { contextId: "c" });

	const Contextor = createContextor(
		[ContextA, ContextB, ContextC],
		(...args) => `${expectString(args[0])}:${expectString(args[1])}:${expectString(args[2])}`
	);

	expect(renderHook(
		() => useContextor(Contextor)
	).result.current).toBe("a:b:c");
});