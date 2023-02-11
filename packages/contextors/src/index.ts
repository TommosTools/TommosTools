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

type ContextorInput<T> = (
	| Context<T>
	| Contextor<T>
);

type Tuple<T> = [] | [T, ...T[]];

type TypesFor<Inputs extends Tuple<ContextorInput<unknown>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<infer T> ? T : InputsT[Index]
	)
} : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Contextor<T, Inputs extends Tuple<ContextorInput<unknown>> = any>
{
	readonly contexts: Set<Context<unknown>>;

	constructor(
		readonly inputs:	Inputs,
		readonly combiner:	(inputs: TypesFor<Inputs>) => T
	)
	{
		this.contexts = new Set();

		for (const input of inputs)
		{
			if (input instanceof Contextor)
				input.contexts.forEach((context) => this.contexts.add(context));
			else	// input is a Context
				this.contexts.add(input);
		}
	}

	subscribe(subscriber: Subscriber, onChange: Listener<T>): [T, Unsubscriber]
	{
		const { inputs } = this;

		const unsubscribers: Unsubscriber[] = [];
		const unsubscribeAll = () => unsubscribers.forEach((unsubscribe) => unsubscribe());

		const inputValues = (
			inputs.map(
				<V>(input: ContextorInput<V>, i: number) =>
				{
					const updateValue = (
						(newValue: V) =>
						{
							inputValues[i] = newValue;
							onChange(this.cachedCombiner(inputValues));
						}
					);

					const [initialValue, unsubscribe] = (
						input instanceof Contextor
							?	input.subscribe(subscriber, updateValue)
							:	subscriber(input, updateValue)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as TypesFor<Inputs>
		);

		const initialValue = this.cachedCombiner(inputValues);

		return [initialValue, unsubscribeAll];
	}

	private cache: NestedCache<T> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private cachedCombiner(inputValues: TypesFor<Inputs>): T
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

export function createContextor<T, Inputs extends Tuple<ContextorInput<unknown>>>(
	inputs: Inputs,
	combiner: (inputs: TypesFor<Inputs>) => T
): Contextor<T>
{
	return new Contextor(inputs, combiner);
}

function contextorReducer<T>(state: State<T>, action: Action<T>): State<T>
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

export function useContextor<T>(contextor: Contextor<T>): T
{
	const subscriber = useSubscriber();

	//
	// `subscribe` creates a closure around `dispatch`, which is defined later;
	// `subscribe` itself is then used in the reducer initialisation which returns `dispatch`.
	// It doesn't matter that `subscribe` isn't memoised here because only its initial value
	// is ever used (in the reducer initialisation).
	//
	const subscribe = (
		(newContextor: Contextor<T>): State<T> =>
		{
			const [initialValue, unsubscribe] = (
				newContextor.subscribe(
					subscriber,
					(updatedValue: T) => dispatch({ type: "setValue", value: updatedValue })
				)
			);

			return { value: initialValue, unsubscribe, subscribe };
		}
	);

	const [{ value: currentValue }, dispatch] = useReducer(
		contextorReducer as Reducer<State<T>, Action<T>>,
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

type State<T> = {
	value:			T;
	unsubscribe?:	Unsubscriber;
	subscribe:		(contextor: Contextor<T>) => State<T>
};
type Action<T> = (
	| { type: "setValue", value: T }
	| { type: "setContextor", contextor: Contextor<T> }
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