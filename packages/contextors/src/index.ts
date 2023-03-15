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

type MandatoryArgBase<Inputs extends Tuple<ContextorInput<any, unknown>>, Arg> = (
	[CompatibleArgFor<Inputs>] extends [Record<any, any>]
		?	Pick<CompatibleArgFor<Inputs>, keyof Arg & keyof CompatibleArgFor<Inputs>>
		:	CompatibleArgFor<Inputs>
);

export function createContextor<Inputs extends Tuple<ArglessContextorInput>, Arg, Out=never>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg | undefined) => Out
): (
	[Out] extends [never]
		?	Contextor<never, never>
		:	Contextor<Arg & CompatibleArgFor<Inputs>, Out, true>
);

export function createContextor<
	Inputs extends Tuple<ArglessContextorInput>,
	Out
>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg?: never) => Out
): Contextor<unknown, Out, true>;

export function createContextor<
	Inputs extends Tuple<ContextorInput<any, unknown>>,
	Arg extends MandatoryArgBase<Inputs, Arg>,
	Out
>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Arg & CompatibleArgFor<Inputs>, Out, false>;

// Catch-all: won't match any inputs that didn't match the previous declaration, but will provide more useful error message
export function createContextor<
	Inputs extends Tuple<ContextorInput<any, unknown>>,
	Arg extends CompatibleArgFor<Inputs>,
	Out
>(
	inputs:		Inputs,
	combiner:	(inputs: OutputsFor<Inputs>, arg: Arg) => Out
): Contextor<Arg & CompatibleArgFor<Inputs>, Out, false>;

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

const contextValue1 = createContext({ a: 5 });
const F1 = createContextor([contextValue1], ([s], arg: { cArg: number }) => 3);
const F2 = createContextor([contextValue1], ([s], arg: { dArg: string } | undefined) => "Sadf");

const FInput = createContextor([F1, F2], ([v1, v2], arg: { cArg: number, dArg: string }) => ({ val: "ADf" }));
const GInput = createContextor([FInput, F1], ([v1, v2], arg: { cArg: number }) => "ASdf")

const F3 = createContextor([contextValue1], ([s], arg: { c: number, d?: string }) => 3 + (arg.c ?? 0));
const F4 = createContextor([F3], ([s], arg: { c: number } | undefined) => null);
const F5 = createContextor([F4], ([s], arg: { blern: string }) => String(s) + arg.blern);

const F6 = createContextor([F1], ([s], arg: { cArg: string }) => null);	// error: { cArg: string } is incompatible with { cArg: number }

const G0 = createContext({ a: 22 });
const G1 = createContextor([G0], ([g0]) => g0.a);
const G2 = createContextor([G0, G1], ([g0, g1]) => g0.a + g1);
const G3 = createContextor([G0, G1], ([g0, g1], factor: number) => g0.a + g1 * factor);
const G4 = createContextor([G2, G3], ([g2, g3]) => g2 + g3);
const G5 = createContextor([G2, G3], ([g2, g3], negate: boolean) => negate ? -(g2 + g3) : (g2 + g3));	// error: boolean is incompatible with number
const G6 = createContextor([G2, G1], ([g2, g1], negate: number | undefined) => g2 + g1);
const G7 = createContextor([G2, G1], ([g2, g1], negate: number) => g2 + g1);

F1();		// error: expects arg

F2();

F2({});		// error: must supply dArg

F2({ dArg: "Asdf" });
FInput({ cArg: 3, dArg: "asdf" });

GInput();	// error: expects arg

GInput({ cArg: 3, dArg: "asdf" });

F3();		// error: expects { c, d? }

F3({ c: 3 });
F3({ c: 3, d: "Adsf" });
F4({ c: 9 });
F5({ blern: "3", c: 3, d: undefined });

G1();
G2();
G3(5);

G4(); 		// error: wants a number

G4(3);

G5(true); 	// error: nothing satisfies number & boolean

G6(3);
G7(3);

useContextor(contextValue1);	// error: context is not a contextor

useContextor(F1);				// error: F1 requires { cArg }

useContextor(F1({ cArg: 3 }));
useContextor(F2);
useContextor(F2());
useContextor(F2({ dArg: "asdf" }));

useContextor(F3);				// error: F3 requires args

useContextor(F3({ c: 3 }));

useContextor(F4);				// error: F4 requires args

useContextor(F4());				// error: F4 requires args

useContextor(F4({ }));			// error: F4 requires c

useContextor(F4({ c: 3 }));
useContextor(F5({ blern: "Asdf", c: 3 }));

useContextor(G0);				// error: context is not a contextor

useContextor(G1);
useContextor(G2);

useContextor(G3);				// error: requires param

useContextor(G3(3));

useContextor(G4);				// error: requires param

useContextor(G4(3));

useContextor(G5(false));		// error: boolean & number is never

useContextor(G6);
useContextor(G6(3));

useContextor(G7);				// error: requires number

useContextor(G7(3));