import {
	createContext,
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

type ContextorInput<T, Arg> = (
	| Context<T>
	| Contextor<T, Arg, false>
);

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type xXX = UnionToIntersection<{ a: number } | { b: string }>;

type Tuple<T> = [] | [T, ...T[]];

type TypesFor<Inputs extends Tuple<ContextorInput<unknown, any>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<infer T, any> ? T : InputsT[Index]
	)
} : never;

type ArgsFor<Inputs extends Tuple<ContextorInput<any, any>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<any, infer Arg> ? Arg : InputsT[Index]
	)
} : never;

type ArgFor<Inputs extends Tuple<ContextorInput<unknown, any>>> =
	UnionToIntersection<ArgsFor<Inputs>[number]>;

/*
type ArgFor<Inputs extends Tuple<ContextorInput<unknown, any>>> =
	Inputs extends [ContextorInput<any, infer Arg>]
		?	(Arg extends undefined ? {} : Arg)
		:	Inputs extends [ContextorInput<any, infer Arg>, ...infer InputsT]
				?	(InputsT extends Tuple<ContextorInput<unknown, unknown>> ? ArgFor<InputsT> : never)
					& (Arg extends undefined ? {} : Arg)
				:	never;
*/

type Contextor<T, Arg, Bound extends boolean, Inputs extends Tuple<ContextorInput<unknown, Arg>> = any> = (
	Bound extends true
		?	Arg extends undefined
				?	[RawContextor<T, Arg, Inputs>, Arg] | RawContextor<T, Arg, Inputs>
				:	[RawContextor<T, Arg, Inputs>, Arg]
		:	RawContextor<T, Arg, Inputs>
)

type OptionalIfUndefined<Arg> = Arg extends undefined ? [arg?: Arg] : [arg: Arg];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class RawContextor<T, Arg, Inputs extends Tuple<ContextorInput<any, Arg>> = any>
{
	readonly contexts: Set<Context<unknown>>;

	constructor(
		readonly inputs:	Inputs,
		readonly combiner:
			Arg extends undefined
				?	(inputs: TypesFor<Inputs>, arg?: Arg) => T
				:	(inputs: TypesFor<Inputs>, arg: Arg) => T
	)
	{
		this.contexts = new Set();

		for (const input of inputs)
		{
			if (input instanceof RawContextor)
				input.contexts.forEach((context) => this.contexts.add(context));
			else	// input is a Context
				this.contexts.add(input);
		}
	}

	withArg(arg: Arg): Contextor<T, Arg, true, Inputs>;
	withArg(...args: OptionalIfUndefined<Arg>): Contextor<T, Arg, true, Inputs>;
	withArg(arg?: Arg): Contextor<T, Arg, true, Inputs>
	{
		return [this, arg] as unknown as Contextor<T, Arg, true, Inputs>;
	}

	subscribe(subscriber: Subscriber, onChange: Listener<T>, arg: Arg): [T, Unsubscriber];
	subscribe(subscriber: Subscriber, onChange: Listener<T>, ...args: OptionalIfUndefined<Arg>): [T, Unsubscriber];
	subscribe(subscriber: Subscriber, onChange: Listener<T>, arg?: Arg): [T, Unsubscriber]
	{
		const { inputs } = this;

		const unsubscribers: Unsubscriber[] = [];
		const unsubscribeAll = () => unsubscribers.forEach((unsubscribe) => unsubscribe());

		const inputValues = (
			inputs.map(
				<V>(input: ContextorInput<V, Arg>, i: number) =>
				{
					const updateValue = (
						(newValue: V) =>
						{
							inputValues[i] = newValue;
							onChange(this.cachedCombiner(inputValues, arg!));
						}
					);

					const [initialValue, unsubscribe] = (
						input instanceof RawContextor
							?	input.subscribe(subscriber, updateValue, arg!)
							:	subscriber(input, updateValue)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as TypesFor<Inputs>
		);

		const initialValue = this.cachedCombiner(inputValues, arg!);

		return [initialValue, unsubscribeAll];
	}

	private cache: NestedCache<T> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private cachedCombiner(inputValues: TypesFor<Inputs>, arg: Arg): T
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
		const value = this.combiner(inputValues, arg);
		cacheRef.set(this.TerminalCacheKey, { keys: [...inputValues], value });
		return value;
	}
}

export function isContextor<T, Arg, Bound extends boolean>(value: unknown): value is Contextor<T, Arg, Bound>
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

const Context1 = createContext({ a: 5 });
const Context2 = createContext({ b: 33 });
const CX1 = createContextor([Context1], (s, arg: { c: number }) => arg);
const CX2 = createContextor([Context2], (s, arg: { d: string }) => arg);
type KJKJL = ArgsFor<[typeof CX1]>;
type JKJKL = ArgFor<[typeof CX1]>;
const adsfadsf = createContextor([Context1, Context2], ([v1,v2], arg: { a: number }) => null)
const ctxinput = createContextor<null, undefined, [RawContextor<null, undefined, [Context<{c:number}>]>]>([CX1], ([v1]) => null)
const kkj = createContextor([CX1, CX2], ([v1,v2], arg) => null)

export function createContextor<T, Arg, Inputs extends Tuple<ContextorInput<any, Arg>>>(
	inputs: Inputs,
	combiner:
		Arg extends undefined
			?	(inputs: TypesFor<Inputs>, arg?: Arg) => T
			:	(inputs: TypesFor<Inputs>, arg: Arg) => T
): Contextor<T, Arg, false, Inputs>
{
	return new RawContextor(inputs, combiner);
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

export function useContextor<T, Arg>(contextor: Contextor<T, Arg, true>): T
{
	const subscriber = useSubscriber();

	//
	// `subscribe` creates a closure around `dispatch`, which is defined later;
	// `subscribe` itself is then used in the reducer initialisation which returns `dispatch`.
	// It doesn't matter that `subscribe` isn't memoised here because only its initial value
	// is ever used (in the reducer initialisation).
	//
	const subscribe = (
		(newContextor: Contextor<T, Arg, true>): State<T, Arg> =>
		{
			const [rawContextor, arg] = (
				(newContextor instanceof RawContextor)
					?	[newContextor, undefined]	// Arg extends undefined -- allow raw contextor
					:	newContextor
			);
			const [initialValue, unsubscribe] = (
				rawContextor.subscribe(
					subscriber,
					(updatedValue: T) => dispatch({ type: "setValue", value: updatedValue }),
					arg!	// nb: arg may be undefined here but only if Arg extends undefined
				)
			);

			return { value: initialValue, unsubscribe, subscribe };
		}
	);

	const [{ value: currentValue }, dispatch] = useReducer(
		contextorReducer as Reducer<State<T, Arg>, Action<T, Arg>>,
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

type State<T, Arg> = {
	value:			T;
	unsubscribe?:	Unsubscriber;
	subscribe:		(contextor: Contextor<T, Arg, true>) => State<T, Arg>
};
type Action<T, Arg> = (
	| { type: "setValue", value: T }
	| { type: "setContextor", contextor: Contextor<T, Arg, true> }
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