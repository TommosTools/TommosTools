/* eslint-disable @typescript-eslint/no-explicit-any */

import {
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
	ArglessContextorInput,
	CombinerParamsAreEqual,
	CompatibleArgFor,
	Contextor,
	ContextorInput,
	MandatoryArgBase,
	OutputFor,
	OutputsFor,
	Simplify,
	Tuple,
	UseContextorInput,
} from "./types";
import { RawContextor } from "./rawcontextor";
import { isBoundContextor } from "./utils";

export function createSimpleContextor<
	Input extends ArglessContextorInput,
	Arg extends MandatoryArgBase<[Input], Arg>,
	Out=never
>(
	input:		Input,
	extractor:	(input: OutputFor<Input>, arg: Arg | undefined) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputFor<Input>, Arg>
): (
	[Out] extends [never]
		?	Contextor<never, never>
		:	Contextor<Simplify<Arg & CompatibleArgFor<[Input]>>, Out, true>
);

export function createSimpleContextor<
	Input extends ArglessContextorInput,
	Out
>(
	input:		Input,
	extractor:	(input: OutputFor<Input>, arg?: never) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputFor<Input>, unknown>
): Contextor<unknown, Out, true>;

export function createSimpleContextor<
	Input extends ContextorInput<any, unknown>,
	Arg extends MandatoryArgBase<[Input], Arg>,
	Out
>(
	input:		[CompatibleArgFor<[Input]>] extends [never] ? never : Input,
	extractor:	(input: OutputFor<Input>, arg: Arg) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputFor<Input>, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<[Input]>>, Out, false>;

export function createSimpleContextor<
	Input extends ContextorInput<any, unknown>,
	Arg extends CompatibleArgFor<[Input]>,
	Out
>(
	input:		Input,
	extractor:	[CompatibleArgFor<[Input]>] extends [never] ? never : Input,
	isEqual?:	CombinerParamsAreEqual<OutputFor<Input>, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<[Input]>>, Out, false>;

export function createSimpleContextor<Input extends ContextorInput<Arg, unknown>, Arg, Out>(
	input:		Input,
	extractor:	(input: OutputFor<Input>, arg: Arg) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputFor<Input>, Arg>
)
{
	type Output = OutputFor<Input>;

	const wrappedInput = [input];

	const wrappedCombiner = (inputs: [OutputFor<Input>], arg: Arg) => extractor(inputs[0], arg);

	const wrappedIsEqual = isEqual && (
		([[output1], arg1]: [[Output], Arg], [[output2], arg2]: [[Output], Arg]) => (
			isEqual([output1, arg1], [output2, arg2])
		)
	);

	const raw = new RawContextor(wrappedInput as any, wrappedCombiner as any, wrappedIsEqual as any);

	const contextor = (arg: Arg) => raw.withArg(arg);
	contextor.raw = raw;

	return contextor;
}

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
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg | undefined) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>
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
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, unknown>
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
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>
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
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>
): Contextor<Simplify<Arg & CompatibleArgFor<Inputs>>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<Arg, any>>, Arg, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out,
	isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>
)
{
	const raw = new RawContextor(inputs, combiner, isEqual);

	const contextor = (arg: Arg) => raw.withArg(arg);
	contextor.raw = raw;

	return contextor;
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
			return { ...subscribe(action.contextor), subscribe };
		default:
			return state;
	}
}

//
// Consume and subscribe to updates of a contextor's value in a function component.
//
// @param contextor
// A Contextor previously created with `createContextor`, with bound argument as required.
//
// @returns - The latest value of the contextor within the calling component.
//
export function useContextor<Arg, Out>(contextor: UseContextorInput<Arg, Out>): Out
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
		(newContextor: UseContextorInput<Arg, Out>): State<Arg, Out> =>
		{
			const [rawContextor, arg] = (
				isBoundContextor(newContextor)
					?	newContextor
					:	newContextor(undefined)	// Arg extends undefined -- allow unbound contextor
			);
			const [initialValue, unsubscribe] = (
				rawContextor.subscribe(
					subscriber,
					(updatedValue: Out) => dispatch({ type: "setValue", value: updatedValue }),
					arg,	// nb: arg may be undefined here but only if Arg extends undefined
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

	const [rawContextor, arg] = isBoundContextor(contextor) ? contextor : [contextor, undefined];

	useEffectOnUpdate(
		() =>
		{
			dispatch({ type: "setContextor", contextor });
			return () => dispatch({ type: "unsetContextor" });
		},
		[dispatch, rawContextor, arg]
	);

	return currentValue;
}

type State<Arg, Out> = {
	value:			Out;
	unsubscribe?:	Unsubscriber;
	subscribe:		(contextor: UseContextorInput<Arg, Out>) => State<Arg, Out>
};
type Action<Arg, Out> = (
	| { type: "setValue", value: Out }
	| { type: "setContextor", contextor: UseContextorInput<Arg, Out> }
	| { type: "unsetContextor" }
);

function useEffectOnUpdate(effect: () => (() => void), deps: unknown[])
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