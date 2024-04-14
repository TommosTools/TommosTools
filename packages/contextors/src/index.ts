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
	TagFreeCombiner,
	TaglessContextorSource,
	Combiner,
	CompatibleTagFor,
	Contextor,
	ContextorSource,
	ContextorOptions,
	MandatoryTagBase,
	OutputsFor,
	Simplify,
	Tuple,
} from "./types";
import { isContextor, RawContextor } from "./rawcontextor";

//
// Match combiners that produce a contextor with an OPTIONAL tag argument.
// Contextors with an optional tag can't use an source with a mandatory tag;
// if all the sources accept an optional tag then the resulting contextor will be
// able to accept an undefined tag, or any other type compatible with the argument
// to all the sources.
// 
// This first declaration also provides the default return type when none of the declarations match.
// In this case TS cannot infer `Out` so we default it to `never`, which results in a return type
// of `Contextor<never, never>`, which will be flagged as an error if it is used elsewhere.
//

export function createContextor<
	Sources extends Tuple<TaglessContextorSource>,
	Tag extends MandatoryTagBase<Sources, Tag>,
	Out=never
>(
	sources:	Sources,
	combiner:	Combiner<Sources, Tag | undefined, Out>,
	options?:	ContextorOptions<Sources, Tag>
): (
	[Out] extends [never]
		?	Contextor<never, never>
		:	Contextor<Simplify<Tag & CompatibleTagFor<Sources>>, Out, true>
);

//
// Special case of the above: produce a contextor with an OPTIONAL tag argument,
// when provided a combiner which takes NO tag.
//
export function createContextor<
	Sources extends Tuple<TaglessContextorSource>,
	Out
>(
	sources:	Sources,
	combiner:	TagFreeCombiner<Sources, Out>,
	options?:	ContextorOptions<Sources, unknown>
): Contextor<unknown, Out, true>;

//
// General case: produce a contextor that requires a tag argument.
// This tag must be compatible with the tag expected by the combiner and all the sources,
// e.g. combiner taking `{ foo: number }` and source taking `{ bar: string }` produces a
// contextor taking `{ foo: number, bar: string }`.
//
export function createContextor<
	Sources extends Tuple<ContextorSource<any, unknown>>,
	Tag extends MandatoryTagBase<Sources, Tag>,
	Out
>(
	sources:	[CompatibleTagFor<Sources>] extends [never] ? never : Sources,
	combiner:	Combiner<Sources, Tag, Out>,
	options?:	ContextorOptions<Sources, Tag>
): Contextor<Simplify<Tag & CompatibleTagFor<Sources>>, Out, false>;

//
// Catch-all: if tags for the combiner and any sources are incompatible then
// we fall through to this declaration, which provides a more helpful type error.
// 
export function createContextor<
	Sources extends Tuple<ContextorSource<any, unknown>>,
	Tag extends CompatibleTagFor<Sources>,
	Out
>(
	sources:	[CompatibleTagFor<Sources>] extends [never] ? never : Sources,
	combiner:	Combiner<Sources, Tag, Out>,
	options?:	ContextorOptions<Sources, Tag>
): Contextor<Simplify<Tag & CompatibleTagFor<Sources>>, Out, false>;

export function createContextor<Sources extends Tuple<ContextorSource<Tag, any>>, Tag, Out>(
	...params: [
		...sources:	(Sources | [Sources]),
		combiner:	Combiner<OutputsFor<Sources>, Tag, Out>,
		options?:	ContextorOptions<Sources, Tag>
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
		&& "$$typeof" in value!	// eslint-disable-line @typescript-eslint/no-non-null-assertion
		&& (value as any).$$typeof === Symbol.for("react.context")
	);
}

function contextorReducer<T, Tag>(state: State<T, Tag>, action: Action<T, Tag>): State<T, Tag>
{
	const { value, unsubscribe, subscribe } = state;

	switch (action.type)
	{
		case "setValue":
			return (
				// Only update state if value has changed
				(action.value !== value)
					?	{ value: action.value, unsubscribe, subscribe }
					:	state
			);
		case "unsetContextor":
			unsubscribe?.();
			return { value, subscribe };
		case "setContextor":
			return { ...subscribe(action.contextor, action.tag), subscribe };
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
// @param tag
// An argument to apply to the contextor, as allowed/required.
//
// @returns - The latest value of the contextor within the calling component.
//
export function useContextor<Tag, Out>(contextor: Contextor<Tag, Out, true>, tag?: Tag): Out;
export function useContextor<Tag, Out>(contextor: Contextor<Tag, Out, false>, tag: Tag): Out;
export function useContextor<Tag, Out>(contextor: Contextor<Tag, Out>, tag?: Tag): Out
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
		(newContextor: Contextor<Tag, Out>): State<Tag, Out> =>
		{
			const [initialValue, unsubscribe] = (
				newContextor.subscribe(
					subscriber,
					(updatedValue: Out) => dispatch({ type: "setValue", value: updatedValue }),
					(tag as Tag),	// nb: tag may be undefined here but only if Tag extends undefined
					{ memoProvider }
				)
			);

			return { value: initialValue, unsubscribe, subscribe };
		}
	);

	const [{ value: currentValue }, dispatch] = useReducer(
		contextorReducer as Reducer<State<Tag, Out>, Action<Tag, Out>>,
		contextor,
		subscribe
	);

	useEffectOnUpdate(
		() =>
		{
			dispatch({ type: "setContextor", contextor, tag: (tag as Tag) });
			return () => dispatch({ type: "unsetContextor" });
		},
		[dispatch, contextor, tag]
	);

	return currentValue;
}

type State<Tag, Out> = {
	value:			Out;
	unsubscribe?:	Unsubscriber;
	subscribe:		(contextor: Contextor<Tag, Out>, tag: Tag) => State<Tag, Out>
};
type Action<Tag, Out> = (
	| { type: "setValue", value: Out }
	| { type: "setContextor", contextor: Contextor<Tag, Out>, tag: Tag }
	| { type: "unsetContextor" }
);

function useEffectOnUpdate(effect: () => (void | (() => void)), deps: unknown[])
{
	const prevDepsRef = useRef(deps);

	useEffect(
		() =>	// eslint-disable-line consistent-return
		{
			const prevDeps = prevDepsRef.current;

			if (prevDeps && deps !== prevDeps)
			{
				if (deps?.length !== prevDeps.length || prevDeps.some((prev, i) => prev !== deps[i]))
					return effect();
			}

			prevDepsRef.current = deps;
		},
		[prevDepsRef, ...deps]	// eslint-disable-line react-hooks/exhaustive-deps
	);
}