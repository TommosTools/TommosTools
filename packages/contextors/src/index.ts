import {
	createContext,
	isContext,
	Listener,
	Subscriber,
	Unsubscriber,
	useSubscriber,
} from "contexto";
import type { Context } from "contexto";
import {
	Reducer,
	useEffect,
	useReducer,
	useRef,
} from "react";

type Contextor<Arg, Out, ArgIsOptional extends boolean = boolean> = (
	(true extends ArgIsOptional
		?	((arg?: Arg | undefined) => BoundContextor<Arg, Out>) & { __optional: void }
		:	never)
	|
	(false extends ArgIsOptional
		?	((arg: Arg) => BoundContextor<Arg, Out>) & { __required: void }
		:	never)
) & { raw: RawContextor<any, Arg, Out> };

type BoundContextor<Arg, Out> =	[RawContextor<any, Arg, Out>, Arg]

function isBoundContextor<Arg, Out>(contextor: Contextor<Arg, Out> | BoundContextor<Arg, Out>)
	: contextor is BoundContextor<Arg, Out>
{
	return contextor instanceof Array;
}

type ArglessContextorInput = (
	| Context<unknown>
	| Contextor<any, unknown, true>
)

type ContextorInput<Arg, Out> = (
	| Context<Out>
	| Contextor<Arg, Out>
);

type UseContextorInput<Arg, Out> = (
	| Contextor<Arg, Out, true>
	| BoundContextor<Arg, Out>
)

type Tuple<T> = [] | [T, ...T[]];

type OutputsFor<Inputs extends Tuple<ContextorInput<any, unknown>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<any, infer Out> ? Out : InputsT[Index]
	)
} : never;

type OptionalIfUndefined<Arg> = Arg extends undefined ? [arg?: Arg] : [arg: Arg];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class RawContextor<Inputs extends Tuple<ContextorInput<Arg, unknown>>, Arg, Out>
{
	readonly contexts: Set<Context<unknown>>;

	constructor(
		readonly inputs:	Inputs,
		readonly combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
	)
	{
		this.contexts = new Set();

		for (const input of inputs)
		{
			if (isContext(input))
				this.contexts.add(input);
			else //if (isContextor(input))
			{
				if (isBoundContextor(input))
					input[0].contexts.forEach((context) => this.contexts.add(context));
				else
					input.raw.contexts.forEach((context) => this.contexts.add(context));
			}
		}
	}

	withArg(arg: Arg): BoundContextor<Arg, Out>
	{
		return [this, arg];
	}

	subscribe(subscriber: Subscriber, onChange: Listener<Out>, arg: Arg): [Out, Unsubscriber];
	subscribe(subscriber: Subscriber, onChange: Listener<Out>, ...args: OptionalIfUndefined<Arg>): [Out, Unsubscriber];
	subscribe(subscriber: Subscriber, onChange: Listener<Out>, arg?: Arg): [Out, Unsubscriber]
	{
		const { inputs } = this;

		const unsubscribers: Unsubscriber[] = [];
		const unsubscribeAll = () => unsubscribers.forEach((unsubscribe) => unsubscribe());

		const inputValues = (
			inputs.map(
				<Out>(input: ContextorInput<Arg, Out>, i: number) =>
				{
					const updateValue = (
						(newValue: Out) =>
						{
							inputValues[i] = newValue;
							onChange(this.cachedCombiner(inputValues, arg!));
						}
					);

					const [initialValue, unsubscribe] = (
						isContext(input)
							?	subscriber(input, updateValue)
							:	isBoundContextor(input)
									?	input[0].subscribe(subscriber, updateValue, arg!)
									:	input.raw.subscribe(subscriber, updateValue, arg!)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as OutputsFor<Inputs>
		);

		const initialValue = this.cachedCombiner(inputValues, arg!);

		return [initialValue, unsubscribeAll];
	}

	private cache: NestedCache<Out> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private cachedCombiner(inputValues: OutputsFor<Inputs>, arg: Arg): Out
	{
		//
		// Caching of combined values using nested WeakMaps.
		//
		// Where the context values are objects, they are used to create a chain of WeakMaps
		// with the last map in the chain containing a memoised combined value computed from
		// the input values.
		// This final cache level stores the latest value computed for the objects
		// in the inputValues -- if there are non-objects in the inputValues then only the
		// result for the most recent input is cached.
		//
		// e.g.
		//   cachedCombiner([obj1, obj2, obj3, obj4])    // First access -- cache miss
		//   cachedCombiner([obj1, obj2, obj3, obj4])    // Cache HIT
		//   cachedCombiner([obj1, obj2, obj3, "foo"])   // Cache miss
		//   cachedCombiner([obj1, obj2, obj3, "bar"])   // Cache miss
		//   cachedCombiner([obj1, obj2, obj3, "bar"])   // Cache HIT
		//   cachedCombiner([obj1, obj2, obj3, "foo"])   // Cache miss
		//   cachedCombiner([obj1, obj2, obj3, "bar"])   // Cache miss
		//   cachedCombiner([obj1, obj2, obj3, obj4])    // Cache HIT
		//   cachedCombiner([obj1, obj2, "foo", "bar"])  // Cache miss
		//   cachedCombiner([obj1, obj2, "foo", "bar"])  // Cache HIT
		//
		// Each cache is specific to the Contextor, but is shared between all `useContextor`
		// usages referencing that Contextor, regardless of which Context.Provider they
		// subscribe to.
		//

		let cacheRef = this.cache;

		const inputValuesWithArg = [...inputValues, arg];

		for (const input of inputValuesWithArg)
		{
			if (isObject(input))
			{
				let nextCacheRef = cacheRef.get(input) as NestedCache<Out>;
				if (nextCacheRef)
					cacheRef = nextCacheRef;
				else
				{
					nextCacheRef = new WeakMap();
					cacheRef.set(input, nextCacheRef);
					cacheRef = nextCacheRef;
				}
			}
		}

		const terminalCache = cacheRef.get(this.TerminalCacheKey);

		if (isTerminalCache(terminalCache) && shallowEqual(terminalCache.keys, inputValuesWithArg))
		{
			// Cached value was found
			return terminalCache.value;
		}
		// Recompute value, and store in cache
		const value = this.combiner(inputValues, arg);
		cacheRef.set(this.TerminalCacheKey, { keys: inputValuesWithArg, value });
		return value;
	}
}

export function isContextor<Arg, Out>(value: unknown)
	: value is Contextor<Arg, Out> | BoundContextor<Arg, Out>
{
	return (value instanceof RawContextor) || (value instanceof Array && value[0] instanceof RawContextor);
}

type TerminalCache<T> = { value: T, keys: unknown[] };
type NestedCache<T>	= WeakMap<object, NestedCache<T> | TerminalCache<T>>;

function isTerminalCache<T>(cache: NestedCache<T> | TerminalCache<T> | undefined): cache is TerminalCache<T>
{
	return cache !== undefined && !(cache instanceof WeakMap);
}

function isObject(value: unknown): value is object
{
	return value instanceof Object;
}

const shallowEqual = (array1: unknown[], array2: unknown[]) => (
	(array1 === array2)
	|| ((array1.length === array2.length) && array1.every((keyComponent, i) => keyComponent === array2[i]))
);

type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

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
export function createContextor<Inputs extends Tuple<ArglessContextorInput>, Arg, Out=never>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg | undefined) => Out
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
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<unknown, Out, true>;

//
// General case: produce a contextor that requires an argument.
// This argument must be compatible with the combiner argument and all the inputs,
// e.g. combiner taking `{ foo: number }` and input taking `{ bar: string }` produces a
// contextor taking `{ foo: number, bar: string }`.
//
export function createContextor<
	Inputs extends Tuple<ContextorInput<any, unknown>>,
	Arg extends CompatibleArgFor<Inputs>,
	Out
>(
	inputs:		[CompatibleArgFor<Inputs>] extends [never] ? never : Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
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
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Simplify<Arg & CompatibleArgFor<Inputs>>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<Arg, any>>, Arg, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
)
{
	const raw = new RawContextor(inputs, combiner);

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
	const subscriber = useSubscriber();

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
					arg!	// nb: arg may be undefined here but only if Arg extends undefined
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
			dispatch({ type: "setContextor", contextor });
			return () => dispatch({ type: "unsetContextor" });
		},
		[dispatch, contextor]
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

type CompatibleArgsFor<Inputs extends Tuple<ContextorInput<any, any>>> = {
	[Index in Exclude<keyof Inputs, keyof []> as (Inputs[Index] extends Contextor<any, any> ? Index : never)]:
		ArgFor<Inputs[Index]>
}

type ArgFor<K> =
    K extends Contextor<infer Arg, any, true>
        ?   Arg
        :   K extends Contextor<infer Arg, any, false>
            ?   Arg
            :   never;

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type WrapArg<T> = {
    [K in keyof T]: { arg: T[K] }
}

type HandleWrappedNever<T> = [T] extends [never] ? { arg: never } : T;

type CompatibleArgFor<Inputs extends Tuple<ContextorInput<any, any>>> =
	({} extends CompatibleArgsFor<Inputs>
		?   { arg: unknown }    // There are no args to be compatible with
		:   HandleWrappedNever<UnionToIntersection<
				WrapArg<CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]
			>>
	) extends { arg: infer Arg }
		?	[Arg] extends [object] ? (Arg & object) : Arg	// force (primitive & { ... }) to map to never
		:	never;