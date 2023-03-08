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

type ContextorInput<Out, Arg> = (
	| Context<Out>
	| AnyContextor<Out, Arg>
);

type ArglessContextorInput<Out> = (
	| Context<Out>
	| Contextor<Out, unknown, true, false>
)

type AnyContextor<Out, Arg> = (
	| Contextor<Out, Arg, false, false>
	| Contextor<Out, Arg, true, false>
);

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type Tuple<T> = [] | [T, ...T[]];

type OutputsFor<Inputs extends Tuple<ContextorInput<unknown, any>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<infer T, any> ? T : InputsT[Index]
	)
} : never;


type Contextor<T, Arg, ArgIsOptional extends boolean, Bound extends boolean, Inputs extends Tuple<ContextorInput<unknown, Arg>> = any> = (
	Bound extends true
		?	Arg extends undefined
				?	[RawContextor<T, Arg, ArgIsOptional, Inputs>, Arg] | RawContextor<T, Arg, ArgIsOptional, Inputs>
				:	[RawContextor<T, Arg, Inputs>, Arg]
		:	RawContextor<T, Arg, Inputs>
)

type OptionalIfUndefined<Arg> = Arg extends undefined ? [arg?: Arg] : [arg: Arg];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class RawContextor<Out, Arg, ArgIsOptional, Inputs extends Tuple<ContextorInput<any, Arg>> = any>
{
	readonly contexts:	Set<Context<unknown>>;
	readonly inputs:	Inputs;
	readonly combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out;

	constructor(
		inputs:		Inputs,
		combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
	)
	{
		this.contexts	= new Set();
		this.inputs		= inputs;
		this.combiner	= combiner;

		for (const input of inputs)
		{
			if (input instanceof RawContextor)
				input.contexts.forEach((context) => this.contexts.add(context));
			else	// input is a Context
				this.contexts.add(input);
		}
	}

	withArg(arg: Arg): Contextor<Out, Arg, true, Inputs>;
	withArg(...args: OptionalIfUndefined<Arg>): Contextor<Out, Arg, true, Inputs>;
	withArg(arg?: Arg): Contextor<Out, Arg, true, Inputs>
	{
		return [this, arg] as unknown as Contextor<Out, Arg, true, Inputs>;
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
				<V,>(input: ContextorInput<V, Arg>, i: number) =>
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

		for (const input of inputValues)
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

const Context1 = createContext("ASDFAS");
const Context2 = createContext(33);
const CX1 = createContextor<number,number,[Context<string>]>([Context1], (s: [string], arg: number) => arg);
type JKJKL = ArgFor<[typeof Context1,]>;
const adsfadsf = createContextor([Context1, Context2], ([v1,v2]: [string,number], arg: { a: number }) => null)

type ArgFor<K> =
	K extends Contextor<any, infer Arg, true>
		?   Arg | undefined     // Partial<Arg> isn't quite correct ... need to preserve individual nullable options
		:   K extends Contextor<any, infer Arg, false>
			?   Arg
			:   never;

type CompatibleArgsFor<Inputs extends Tuple<ContextorInput<any, any>>> = {
	[Index in Exclude<keyof Inputs, keyof []>
		as (Inputs[Index] extends AnyContextor<any, any> ? Index : never)]:
			ArgFor<Inputs[Index]>
}

type ArgWrap<T> = {
	[K in keyof T]: { arg: T[K] }
}

type CompatibleArgFor<Inputs extends Tuple<ContextorInput<any, any>>> =
	({} extends CompatibleArgsFor<Inputs>
		?   { arg: unknown }    // There are no args to be compatible with
		:   UnionToIntersection<
				ArgWrap<CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]
			>
	) extends { arg: infer Arg } ? Arg : never;







export function createContextor<Out, Inputs extends Tuple<ArglessContextorInput<unknown>>>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<Out, unknown, true, false>;

export function createContextor<Out, Inputs extends Tuple<ContextorInput<unknown, unknown>>>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<Out, CompatibleArgFor<Inputs>, true, false>;

export function createContextor<Out, Arg extends undefined, Inputs extends Tuple<ContextorInput<unknown, unknown>>>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Out, Exclude<Arg, undefined> & CompatibleArgFor<Inputs>, true, false>;

export function createContextor<Out, Arg, Inputs extends Tuple<ContextorInput<unknown, unknown>>>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Out, Arg & CompatibleArgFor<Inputs>, false, false>;

export function createContextor<Out, Arg, Inputs extends Tuple<ContextorInput<any, Arg>>>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
)//: Contextor<T, ArgFor<Inputs> & Arg, false, Inputs>
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