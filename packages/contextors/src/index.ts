import {
	Listener,
	Subscriber,
	Unsubscriber,
	useSubscriber,
} from "contexto";
import type { Context } from "contexto";
import {
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
		const { inputs, combiner } = this;

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
							onChange(combiner(inputValues));
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

		const initialValue = combiner(inputValues);

		return [initialValue, unsubscribeAll];
	}
}

export function createContextor<T, Inputs extends Tuple<ContextorInput<unknown>>>(
	inputs: Inputs,
	combiner: (inputs: TypesFor<Inputs>) => T
): Contextor<T>
{
	return new Contextor(inputs, combiner);
}

export function useContextor<T>(contextor: Contextor<T>): T
{
	const subscriber = useSubscriber();

	const subscribeToContextor = (
		(newContextor: Contextor<T>): State<T> =>
		{
			const [initialValue, unsubscribe] = (
				newContextor.subscribe(
					subscriber,
					(updatedValue: T) => dispatch({ type: "setValue", value: updatedValue })
				)
			);

			return { value: initialValue, unsubscribe };
		}
	);

	const [{ value: currentValue }, dispatch] = (
		useReducer(
			(state: State<T>, action: Action<T>): State<T> =>
			{
				const { value, unsubscribe } = state;

				switch (action.type)
				{
					case "setValue":
						return { value: action.value, unsubscribe };
					case "unsetContextor":
						unsubscribe?.();
						return { value };
					case "setContextor":
						return subscribeToContextor(action.contextor);
					default:
						return state;
				}
			},
			contextor,
			(initialContextor) => subscribeToContextor(initialContextor)
		)
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
	value: T;
	unsubscribe?: Unsubscriber;
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
		[effect, hasMounted, ...deps]	// eslint-disable-line react-hooks/exhaustive-deps
	);
}