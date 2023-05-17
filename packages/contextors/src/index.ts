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
	ArglessContextorSource,
	Combiner,
	CompatibleArgFor,
	Contextor,
	ContextorSource,
	ContextorOptions,
	MandatoryArgBase,
	OutputsFor,
	Simplify,
	Tuple,
} from "./types";
import { isContextor, RawContextor } from "./rawcontextor";

//
// Match combiners that produce a contextor with an OPTIONAL argument.
// Contextors with an optional argument can't use an source with a mandatory argument;
// if all the sources accept an optional argument then the resulting contextor will be
// able to accept an undefined argument, or any other type compatible with the argument
// to all the sources.
// 
// This first declaration also provides the default return type when none of the declarations match.
// In this case TS cannot infer `Out` so we default it to `never`, which results in a return type
// of `Contextor<never, never>`, which will be flagged as an error if it is used elsewhere.
//

export function createContextor<
	Sources extends Tuple<ArglessContextorSource>,
	Arg extends MandatoryArgBase<Sources, Arg>,
	Out=never
>(
	sources:	Sources,
	combiner:	Combiner<Sources, Arg | undefined, Out>,
	options?:	ContextorOptions<Sources, Arg>
): (
	[Out] extends [never]
		?	Contextor<never, never>
		:	Contextor<Simplify<Arg & CompatibleArgFor<Sources>>, Out, true>
);

//
// Special case of the above: produce a contextor with an OPTIONAL argument,
// when provided a combiner which takes NO argument.
//
export function createContextor<
	Sources extends Tuple<ArglessContextorSource>,
	Out
>(
	sources:	Sources,
	combiner:	ArgFreeCombiner<Sources, Out>,
	options?:	ContextorOptions<Sources, unknown>
): Contextor<unknown, Out, true>;

//
// General case: produce a contextor that requires an argument.
// This argument must be compatible with the combiner argument and all the sources,
// e.g. combiner taking `{ foo: number }` and source taking `{ bar: string }` produces a
// contextor taking `{ foo: number, bar: string }`.
//
export function createContextor<
	Sources extends Tuple<ContextorSource<any, unknown>>,
	Arg extends MandatoryArgBase<Sources, Arg>,
	Out
>(
	sources:	[CompatibleArgFor<Sources>] extends [never] ? never : Sources,
	combiner:	Combiner<Sources, Arg, Out>,
	options?:	ContextorOptions<Sources, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<Sources>>, Out, false>;

//
// Catch-all: if arguments for the combiner and any sources are incompatible then
// we fall through to this declaration, which provides a more helpful type error.
// 
export function createContextor<
	Sources extends Tuple<ContextorSource<any, unknown>>,
	Arg extends CompatibleArgFor<Sources>,
	Out
>(
	sources:	[CompatibleArgFor<Sources>] extends [never] ? never : Sources,
	combiner:	Combiner<Sources, Arg, Out>,
	options?:	ContextorOptions<Sources, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<Sources>>, Out, false>;

export function createContextor<Sources extends Tuple<ContextorSource<Arg, any>>, Arg, Out>(
	...params: [
		...sources:	(Sources | [Sources]),
		combiner:	Combiner<OutputsFor<Sources>, Arg, Out>,
		options?:	ContextorOptions<Sources, Arg>
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

	const sources = Array.isArray(rawParams[0]) ? rawParams[0] : rawParams;

	assertValidSources(sources);

	return new RawContextor(sources, combiner, options?.isEqual);
}

function assertValidSources(sources: unknown[]): asserts sources is Tuple<ContextorSource<unknown, unknown>>
{
	if (!sources.every((source) => isContext(source) || isContextor(source)))
	{
		if (sources.some(isReactContext))
		{
			throw new Error(
				"createContextor received React.Context source, but Contexto.Context source is required"
			);
		}

		const sourceTypes = sources.map(
			(source) => (typeof source === "function" ? source.toString() : typeof source)
		).join(", ");

		throw new Error(
			`createContextor sources must be Context or Contextor, but received the following types: [${sourceTypes}]`
		);
	}
}

function isReactContext(value: unknown): value is React.Context<unknown>
{
	return (
		value !== null
		&& typeof value === "object"
		&& "$$typeof" in value
		&& (value as any).$$typeof === Symbol.for("react.context")
	);
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