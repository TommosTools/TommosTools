import {
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

type Contextor<Arg, Out, ArgIsOptional extends boolean = boolean> =
	(true extends ArgIsOptional
		?	((arg?: Arg | undefined) => RawContextor<any, Arg, Out>) & { __optional: void }
		:	never)
	|
	(false extends ArgIsOptional
		?	((arg: Arg) => RawContextor<any, Arg, Out>) & { __required: void }
		:	never)

type BoundContextor<Arg, Out> =	[RawContextor<any, Arg, Out>, Arg]

type ContextorInput<Arg, Out> = (
	| Context<Out>
	| Contextor<Arg, Out, false>
	| Contextor<Arg, Out, true>
);

type Tuple<T> = [] | [T, ...T[]];

type OutputsFor<Inputs extends Tuple<ContextorInput<any, unknown>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<any, infer Out> ? Out : InputsT[Index]
	)
} : never;

type ContextorX<Inputs extends Tuple<ContextorInput<Arg, unknown>>, Arg, Out, Bound extends boolean> = (
	Bound extends true
		?	Arg extends undefined
				?	[RawContextor<Inputs, Arg, Out>, Arg] | RawContextor<Inputs, Arg, Out>
				:	[RawContextor<Inputs, Arg, Out>, Arg]
		:	RawContextor<Inputs, Arg, Out>
)

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
			if (isContextor(input))
				input.contexts.forEach((context) => this.contexts.add(context));
			else	// input is a Context
				this.contexts.add(input);
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
							onChange(this.cachedCombiner(inputValues));
						}
					);

					const [initialValue, unsubscribe] = (
						isContextor(input)
							?	input.subscribe(subscriber, updateValue, arg!)
							:	subscriber(input, updateValue)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as OutputsFor<Inputs>
		);

		const initialValue = this.cachedCombiner(inputValues);

		return [initialValue, unsubscribeAll];
	}

	private cache: NestedCache<Out> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private cachedCombiner(inputValues: OutputsFor<Inputs>): Out
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

		for (const input of inputValues)
		{
			if (isObject(input))
			{
				let nextCacheRef = cacheRef.get(input) as NestedCache<T>;
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

		if (isTerminalCache(terminalCache) && shallowEqual(terminalCache.keys, inputValues))
		{
			// Cached value was found
			return terminalCache.value;
		}
		// Recompute value, and store in cache
		const value = this.combiner(inputValues);
		cacheRef.set(this.TerminalCacheKey, { keys: [...inputValues], value });
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

export function createContextor<Inputs extends Tuple<ArglessContextorInput<unknown>>, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<unknown, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<unknown, unknown>>, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<CompatibleArgFor<Inputs>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<unknown, unknown>>, Arg extends undefined, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Exclude<Arg, undefined> & CompatibleArgFor<Inputs>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<unknown, unknown>>, Arg, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Arg & CompatibleArgFor<Inputs>, Out, false>;

export function createContextor<Inputs extends Tuple<ContextorInput<any, Arg>>, Arg, Out>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
)
{
	const contextor = new RawContextor(inputs, combiner);

	return (arg: Arg) => contextor.withArg(arg);
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

export function useContextor<Arg, Out>(contextor: Contextor<any, Arg, Out, true>): Out
{
	const subscriber = useSubscriber();

	//
	// `subscribe` creates a closure around `dispatch`, which is defined later;
	// `subscribe` itself is then used in the reducer initialisation which returns `dispatch`.
	// It doesn't matter that `subscribe` isn't memoised here because only its initial value
	// is ever used (in the reducer initialisation).
	//
	const subscribe = (
		(newContextor: Contextor<any, Arg, Out, true>): State<Arg, Out> =>
		{
			const [rawContextor, arg] = (
				(newContextor instanceof RawContextor)
					?	[newContextor, undefined]	// Arg extends undefined -- allow raw contextor
					:	newContextor
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
	subscribe:		(contextor: Contextor<any, Arg, Out, true>) => State<Arg, Out>
};
type Action<Arg, Out> = (
	| { type: "setValue", value: Out }
	| { type: "setContextor", contextor: Contextor<any, Arg, Out, true> }
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
        ?   Arg | undefined
        :   K extends Contextor<infer Arg, any, false>
            ?   Arg
            :   never;

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type WrapArg<T> = {
    [K in keyof T]: { arg: T[K] }
}

type CompatibleArgFor<Inputs extends Tuple<ContextorInput<any, any>>> =
	({} extends CompatibleArgsFor<Inputs>
		?   { arg: unknown }    // There are no args to be compatible with
		:   UnionToIntersection<
				WrapArg<CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]
			>
	) extends { arg: infer Arg } ? Arg : never;
