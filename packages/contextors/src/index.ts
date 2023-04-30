/* eslint-disable @typescript-eslint/no-explicit-any */

import {
	isContext,
	Unsubscriber,
	useSubscriber,
} from "contexto";
import {
	Reducer,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { MemoSlotProvider } from "./memoslots";
import {
	ArgFreeCombiner,
	ArglessContextorInput,
	Combiner,
	CompatibleArgFor,
	Contextor,
	ContextorInput,
	ContextorOptions,
	MandatoryArgBase,
	OutputsFor,
	Simplify,
	Tuple,
} from "./types";
import { isContextor, RawContextor } from "./rawcontextor";

//
// Match combiners that produce a contextor with an OPTIONAL argument.
// Contextors with an optional argument can't use an input with a mandatory argument;
// if all the inputs accept an optional argument then the resulting contextor will be
// able to accept an undefined argument, or any other type compatible with the argument
// to all the inputs.
// 
// This first declaration also provides the default return type when none of the declarations match.
// In this case TS cannot infer `Out` so we default it to `never`, which results in a return type
// of `Contextor<never, never>`, which will be flagged as an error if it is used elsewhere.
//

export function createContextor<
	Inputs extends Tuple<ArglessContextorInput>,
	Arg extends MandatoryArgBase<Inputs, Arg>,
	Out=never
>(
	inputs:		Inputs,
	combiner:	Combiner<Inputs, Arg | undefined, Out>,
	options?:	ContextorOptions<Inputs, Arg>
): (
	[Out] extends [never]
		?	Contextor<never, never>
		:	Contextor<Simplify<Arg & CompatibleArgFor<Inputs>>, Out, true>
);

//
// Special case of the above: produce a contextor with an OPTIONAL argument,
// when provided a combiner which takes NO argument.
//
export function createContextor<
	Inputs extends Tuple<ArglessContextorInput>,
	Out
>(
	inputs:		Inputs,
	combiner:	ArgFreeCombiner<Inputs, Out>,
	options?:	ContextorOptions<Inputs, unknown>
): Contextor<unknown, Out, true>;

//
// General case: produce a contextor that requires an argument.
// This argument must be compatible with the combiner argument and all the inputs,
// e.g. combiner taking `{ foo: number }` and input taking `{ bar: string }` produces a
// contextor taking `{ foo: number, bar: string }`.
//
export function createContextor<
	Inputs extends Tuple<ContextorInput<any, unknown>>,
	Arg extends MandatoryArgBase<Inputs, Arg>,
	Out
>(
	inputs:		[CompatibleArgFor<Inputs>] extends [never] ? never : Inputs,
	combiner:	Combiner<Inputs, Arg, Out>,
	options?:	ContextorOptions<Inputs, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<Inputs>>, Out, false>;

//
// Catch-all: if arguments for the combiner and any inputs are incompatible then
// we fall through to this declaration, which provides a more helpful type error.
// 
export function createContextor<
	Inputs extends Tuple<ContextorInput<any, unknown>>,
	Arg extends CompatibleArgFor<Inputs>,
	Out
>(
	inputs:		[CompatibleArgFor<Inputs>] extends [never] ? never : Inputs,
	combiner:	Combiner<Inputs, Arg, Out>,
	options?:	ContextorOptions<Inputs, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<Inputs>>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<Arg, any>>, Arg, Out>(
	...params: [
		...inputs:	(Inputs | [Inputs]),
		combiner:	Combiner<OutputsFor<Inputs>, Arg, Out>,
		options?:	ContextorOptions<Inputs, Arg>
	]
)
{
	const rawParams	= [...params as any];
	const lastParam	= rawParams.pop();

	const [combiner, options] = (
		(typeof lastParam === "object")
			? [rawParams.pop(),	lastParam]
			: [lastParam,		{}]
	);

	const inputs = Array.isArray(rawParams[0]) ? rawParams[0] : rawParams;

	assertValidInputs(inputs);

	return new RawContextor(inputs, combiner, options?.isEqual);
}

function assertValidInputs(inputs: unknown[]): asserts inputs is Tuple<ContextorInput<unknown, unknown>>
{
	if (!inputs.every((input) => isContext(input) || isContextor(input)))
	{
		const inputTypes = inputs.map(
			(input) => (typeof input === "function" ? input.toString() : typeof input)
		).join(", ");

		throw new Error(
			`createContextor inputs must be Context or Contextor, but received the following types: [${inputTypes}]`
		);
	}
}

function contextorReducer<T, Arg>(state: State<T, Arg>, action: Action<T, Arg>): State<T, Arg>
{
	const { value, unsubscribe, subscribe } = state;

	switch (action.type)
	{
		case "setValue":
			return { value: action.value, unsubscribe, subscribe };
		case "unsetContextor":
			unsubscribe?.();
			return { value, subscribe };
		case "setContextor":
			return { ...subscribe(action.contextor, action.arg), subscribe };
		default:
			return state;
	}
}

//
// Consume and subscribe to updates of a contextor's value in a function component.
//
// @param contextor
// A Contextor previously created with `createContextor`
//
// @param arg
// An argument to apply to the contextor, as allowed/required.
//
// @returns - The latest value of the contextor within the calling component.
//
export function useContextor<Arg, Out>(contextor: Contextor<Arg, Out, true>, arg?: Arg): Out;
export function useContextor<Arg, Out>(contextor: Contextor<Arg, Out, false>, arg: Arg): Out;
export function useContextor<Arg, Out>(contextor: Contextor<Arg, Out>, arg?: Arg): Out
{
	const subscriber		= useSubscriber();
	const [memoProvider]	= useState(() => new MemoSlotProvider());

	//
	// `subscribe` creates a closure around `dispatch`, which is defined later;
	// `subscribe` itself is then used in the reducer initialisation which returns `dispatch`.
	// It doesn't matter that `subscribe` isn't memoised here because only its initial value
	// is ever used (in the reducer initialisation).
	//
	const subscribe = (
		(newContextor: Contextor<Arg, Out>): State<Arg, Out> =>
		{
			const [initialValue, unsubscribe] = (
				newContextor.subscribe(
					subscriber,
					(updatedValue: Out) => dispatch({ type: "setValue", value: updatedValue }),
					(arg as Arg),	// nb: arg may be undefined here but only if Arg extends undefined
					{ memoProvider }
				)
			);

			return { value: initialValue, unsubscribe, subscribe };
		}
	);

	const [{ value: currentValue }, dispatch] = useReducer(
		contextorReducer as Reducer<State<Arg, Out>, Action<Arg, Out>>,
		contextor,
		subscribe
	);

	useEffectOnUpdate(
		() =>
		{
			dispatch({ type: "setContextor", contextor, arg: (arg as Arg) });
			return () => dispatch({ type: "unsetContextor" });
		},
		[dispatch, contextor, arg]
	);

	return currentValue;
}

type State<Arg, Out> = {
	value:			Out;
	unsubscribe?:	Unsubscriber;
	subscribe:		(contextor: Contextor<Arg, Out>, arg: Arg) => State<Arg, Out>
};
type Action<Arg, Out> = (
	| { type: "setValue", value: Out }
	| { type: "setContextor", contextor: Contextor<Arg, Out>, arg: Arg }
	| { type: "unsetContextor" }
);

function useEffectOnUpdate(effect: () => (void | (() => void)), deps: unknown[])
{
	const hasMounted = useRef(false);

	useEffect(
		() =>	// eslint-disable-line consistent-return
		{
			if (hasMounted.current)
				return effect();
			hasMounted.current = true;
		},
		[hasMounted, ...deps]	// eslint-disable-line react-hooks/exhaustive-deps
	);
}