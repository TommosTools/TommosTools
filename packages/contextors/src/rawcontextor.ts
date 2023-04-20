import {
	Context,
	isContext,
	Listener,
	Subscriber,
	Unsubscriber,
} from "contexto";
import { MemoSlotIterator, MemoSlotProvider } from "./memoslots";
import type {
	BoundContextor,
	Combiner,
	CombinerParamsAreEqual,
	Contextor,
	ContextorInput,
	OutputsFor,
	Tuple,
} from "./types";
import { isBoundContextor } from "./utils";

export class RawContextor<Inputs extends Tuple<ContextorInput<Arg, unknown>>, Arg, Out>
{
	readonly contexts: Set<Context<unknown>>;

	constructor(
		readonly inputs:	Inputs,
		readonly combiner:	Combiner<OutputsFor<Inputs>, Arg, Out>,
		readonly isEqual?:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>
	)
	{
		this.contexts = new Set();

		for (const input of inputs)
		{
			if (isContext(input))
				this.contexts.add(input);
			else /* if (isContextor(input)) */
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

	subscribe(
		subscriber:	Subscriber,
		onChange:	Listener<Out>,
		arg:		Arg,
		opts?:		{ memoProvider: MemoSlotProvider }
	): [Out, Unsubscriber]
	{
		const { inputs } = this;

		const unsubscribers: Unsubscriber[] = [];
		const unsubscribeAll = () => unsubscribers.forEach((unsubscribe) => unsubscribe());

		const inputValues = (
			inputs.map(
				<InnerOut>(input: ContextorInput<Arg, InnerOut>, i: number) =>
				{
					const updateValue = (
						(newValue: InnerOut) =>
						{
							inputValues[i] = newValue;
							onChange(this.computeWithCache(inputValues, arg, opts?.memoProvider.iterator()));
						}
					);

					const [initialValue, unsubscribe] = (
						isContext(input)
							?	subscriber(input, updateValue)
							:	isBoundContextor(input)
								?	input[0].subscribe(subscriber, updateValue, arg, opts)
								:	input.raw.subscribe(subscriber, updateValue, arg, opts)
					);

					unsubscribers.push(unsubscribe);

					return initialValue;
				}
			) as unknown as OutputsFor<Inputs>
		);

		const initialValue = this.computeWithCache(inputValues, arg, opts?.memoProvider.iterator());

		return [initialValue, unsubscribeAll];
	}

	private computeWithCache(inputValues: OutputsFor<Inputs>, arg: Arg, memoSlots?: MemoSlotIterator): Out
	{
		return (
			this.isEqual
				?	this.computeWithMemoiseCache(inputValues, arg, memoSlots)
				:	this.computeWithMultiCache(inputValues, arg)
		);
	}

	private computeWithMemoiseCache(inputValues: OutputsFor<Inputs>, arg: Arg, memoSlots?: MemoSlotIterator): Out
	{
		const memoSlot = memoSlots?.next();

		if (memoSlot?.inputValues
			&& this.isEqual!(	// eslint-disable-line @typescript-eslint/no-non-null-assertion
				[inputValues, arg],
				[memoSlot.inputValues, memoSlot.arg] as [OutputsFor<Inputs>, Arg]
			)
		)
			return memoSlot.out as Out;

		const out = this.combiner(...inputValues, arg);

		if (memoSlot)
		{
			memoSlot.inputValues	= inputValues;
			memoSlot.arg			= arg;
			memoSlot.out			= out;
		}

		return out;
	}

	private multiCache: NestedCache<Out> = new WeakMap();

	// Arbitrary object scoped to the Contextor that can be used to index a WeakMap
	private TerminalCacheKey = {};

	private computeWithMultiCache(inputValues: OutputsFor<Inputs>, arg: Arg): Out
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

		let cacheRef = this.multiCache;

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
		const value = this.combiner(...inputValues, arg);
		cacheRef.set(this.TerminalCacheKey, { keys: inputValuesWithArg, value });
		return value;
	}
}

export function isContextor<Arg, Out>(value: unknown)
	: value is Contextor<Arg, Out> | BoundContextor<Arg, Out>
{
	return (
		(value instanceof Object && (value as { raw?: unknown }).raw instanceof RawContextor)
	||	(value instanceof Array && value[0] instanceof RawContextor)
	);
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