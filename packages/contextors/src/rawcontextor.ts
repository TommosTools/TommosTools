import {
	Context,
	isContext,
	Listener,
	Subscriber,
	Unsubscriber,
} from "contexto";
import { MemoSlotIterator, MemoSlotProvider } from "./memoslots";
import type {
	Combiner,
	CombinerParamsAreEqual,
	Contextor,
	ContextorSource,
	OutputsFor,
	Tuple,
} from "./types";

export class RawContextor<Sources extends Tuple<ContextorSource<Arg, unknown>>, Arg, Out>
{
	readonly contexts: Set<Context<unknown>>;

	constructor(
		readonly sources:	Sources,
		readonly combiner:	Combiner<Sources, Arg, Out>,
		readonly isEqual?:	CombinerParamsAreEqual<OutputsFor<Sources>, Arg>
	)
	{
		this.contexts = new Set();

		for (const source of sources)
		{
			if (isContext(source))
				this.contexts.add(source);
			else /* if (isContextor(source)) */
				source.contexts.forEach((context) => this.contexts.add(context));
		}
	}

	subscribe(
		subscriber:	Subscriber,
		onChange:	Listener<Out>,
		arg:		Arg,
		opts?:		{ memoProvider: MemoSlotProvider }
	): [Out, Unsubscriber]
	{
		const { sources } = this;

		const unsubscribers: Unsubscriber[] = [];
		const unsubscribeAll = () => unsubscribers.forEach((unsubscribe) => unsubscribe());

		const sourceValues = (
			sources.map(
				<InnerOut>(source: ContextorSource<Arg, InnerOut>, i: number) =>
				{
					const updateValue = (
						(newValue: InnerOut) =>
						{
							sourceValues[i] = newValue;
							onChange(this.computeWithCache(sourceValues, arg, opts?.memoProvider.iterator()));
						}
					);

					const [initialValue, unsubscribe] = (
						isContext(source)
							?	subscriber(source, updateValue)
							:	source.subscribe(subscriber, updateValue, arg, opts)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as OutputsFor<Sources>
		);

		const initialValue = this.computeWithCache(sourceValues, arg, opts?.memoProvider.iterator());

		return [initialValue, unsubscribeAll];
	}

	private computeWithCache(sourceValues: OutputsFor<Sources>, arg: Arg, memoSlots?: MemoSlotIterator): Out
	{
		return (
			this.isEqual
				?	this.computeWithMemoiseCache(sourceValues, arg, memoSlots)
				:	this.computeWithMultiCache(sourceValues, arg)
		);
	}

	private computeWithMemoiseCache(sourceValues: OutputsFor<Sources>, arg: Arg, memoSlots?: MemoSlotIterator): Out
	{
		const memoSlot = memoSlots?.next();

		if (memoSlot?.sourceValues
			&& this.isEqual!(	// eslint-disable-line @typescript-eslint/no-non-null-assertion
				[sourceValues, arg],
				[memoSlot.sourceValues, memoSlot.arg] as [OutputsFor<Sources>, Arg]
			)
		)
			return memoSlot.out as Out;

		const out = this.combiner(...sourceValues, arg);

		if (memoSlot)
		{
			memoSlot.sourceValues	= sourceValues;
			memoSlot.arg			= arg;
			memoSlot.out			= out;
		}

		return out;
	}

	private multiCache: NestedCache<Out> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private computeWithMultiCache(sourceValues: OutputsFor<Sources>, arg: Arg): Out
	{
		//
		// Caching of combined values using nested WeakMaps.
		//
		// Where the context values are objects, they are used to create a chain of WeakMaps
		// with the last map in the chain containing a memoised combined value computed from
		// the source values.
		// This final cache level stores the latest value computed for the objects
		// in the sourceValues -- if there are non-objects in the sourceValues then only the
		// result for the most recent source value is cached.
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

		let cacheRef = this.multiCache;

		const sourceValuesWithArg = [...sourceValues, arg];

		for (const source of sourceValuesWithArg)
		{
			if (isObject(source))
			{
				let nextCacheRef = cacheRef.get(source) as NestedCache<Out>;
				if (nextCacheRef)
					cacheRef = nextCacheRef;
				else
				{
					nextCacheRef = new WeakMap();
					cacheRef.set(source, nextCacheRef);
					cacheRef = nextCacheRef;
				}
			}
		}

		const terminalCache = cacheRef.get(this.TerminalCacheKey);

		if (isTerminalCache(terminalCache) && shallowEqual(terminalCache.keys, sourceValuesWithArg))
		{
			// Cached value was found
			return terminalCache.value;
		}
		// Recompute value, and store in cache
		const value = this.combiner(...sourceValues, arg);
		cacheRef.set(this.TerminalCacheKey, { keys: sourceValuesWithArg, value });
		return value;
	}
}

export function isContextor<Arg, Out>(value: unknown)
	: value is Contextor<Arg, Out>
{
	return (value instanceof RawContextor);
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