import {
	useCallback,
	useContext as useReactContext,
	useMemo,
	useState,
} from "react";
import { InstanceStackContext } from "./ContextInstance";
import type { ContextInstance } from "./ContextInstance";
import {
	Context,
	ContextDict,
	ContextTuple,
	IsEqual,
	SomeTypeFor,
	SubscriptionContext,
	ContextTypes,
	ValueUpdater,
} from "./types";
import {
	assertInternalContext,
	getContextId,
	asInternalContexts,
	assertSubscriptionContext,
	CONTEXTO_KEY,
} from "./types/internal";
import type { InternalContextsFor } from "./types/internal";
import { useIsomorphicLayoutEffect } from "./utils";
import { IS_NON_PRODUCTION_ENVIRONMENT } from "./env";

export function useContext<T>(
	context:	Context<T>,
	isEqual:	IsEqual<T> = Object.is
): T
{
	assertInternalContext(context);

	const instance = useReactContext(InstanceStackContext)[getContextId(context)] as ContextInstance<T>;

	// Store the value as a tuple rather than raw value, to allow forced refresh with custom isEqual
	const [value, setValue] = useState<[T]>(
		[instance ? instance.snapshot : context[CONTEXTO_KEY].defaultValue]
	);

	useIsomorphicLayoutEffect(
		() => instance?.subscribe(	// `subscribe(..)` returns the appropriate unsubscribe / cleanup function
			(newValue) =>
			{
				setValue(
					(oldValue) => (isEqual(oldValue[0], newValue, context) ? oldValue : [newValue])
				);
			}
		),
		[instance, context, setValue, isEqual]
	);

	return value[0];
}

type ContextSubscribers = {
	instance?: ContextInstance<unknown>;
	keys: (string | number)[]
};
type ContextMap = Map<Context<unknown>, ContextSubscribers>;

function useContextMap(contexts: InternalContextsFor<ContextTuple | ContextDict>)
{
	const allInstances	= useReactContext(InstanceStackContext);
	const contextMap	= useMemo(
		() =>
		{
			const map: ContextMap = new Map();

			for (const [key, context] of Object.entries(contexts))
			{
				const subscribers = map.get(context);

				if (subscribers)
					subscribers.keys.push(key);
				else
				{
					map.set(context, {
						instance: allInstances[getContextId(context)],	// potentially undefined
						keys: [key],
					});
				}
			}

			return map;
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[allInstances, ...Object.keys(contexts), ...Object.values(contexts)]
	);

	return contextMap;
}

function constructValues<Contexts extends ContextTuple | ContextDict>(
	contextMap: ContextMap,
	contexts: InternalContextsFor<Contexts>
)
{
	const inputs = Object.entries(contexts)
		.map(
			([key, context]) =>
			{
				const { instance }	= contextMap.get(context) ?? {};
				const value			= instance ? instance.snapshot : context[CONTEXTO_KEY].defaultValue;
				return { key, value };
			}
		);

	return (
		Array.isArray(contexts)
			?	inputs.map(({ value }) => value)
			:	Object.fromEntries(inputs.map(({ key, value }) => [key, value]))
	) as ContextTypes<Contexts>;
}

export function useInternalContexts<Contexts extends ContextTuple | ContextDict>(contexts: Contexts)
{
	return useMemo(
		() => asInternalContexts(contexts),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[...Object.keys(contexts), ...Object.values(contexts)]
	);
}

export function useContexts<Contexts extends ContextTuple | ContextDict>(
	contexts:	Contexts,
	isEqual:	IsEqual<SomeTypeFor<Contexts>> = Object.is
): ContextTypes<Contexts>
{
	type LocalContextTypes	= ContextTypes<Contexts>;

	const internalContexts	= useInternalContexts(contexts);
	const contextMap		= useContextMap(internalContexts);

	const initialValues		= useMemo(
		() => constructValues(contextMap, internalContexts),
		[contextMap, internalContexts]
	);
	const [values, setValues]	= useState(initialValues);

	// Detect changes to the input context specification, and recompute the entire output
	useIsomorphicLayoutEffect(
		() => setValues(initialValues),
		[setValues, initialValues]
	);

	const replaceValue = useCallback(
		<Keys extends (keyof LocalContextTypes)[]>(
			keys: Keys,
			newValue: LocalContextTypes[Keys[0]],
			context: Context<LocalContextTypes[Keys[0]]>
		) =>
		{
			setValues(
				(previous) =>
				{
					// If nothing has changed then don't update the cached values
					if (isEqual(previous[keys[0]], newValue, context))
						return previous;

					// Clone old cache value, and update the changed key(s)
					const newValues = (
						Array.isArray(previous)
							?	[...previous]
							:	{ ...previous }
					) as LocalContextTypes;

					for (const key of keys)
						newValues[key] = newValue;

					return newValues;
				}
			);
		},
		[setValues, isEqual]
	);

	// Detect incremental changes to existing input context specification
	// (i.e. subscribe to context value changes)
	useIsomorphicLayoutEffect(
		() =>
		{
			const unsubscribers = Array.from(
				contextMap,
				([context, { keys, instance }]) => (	// eslint-disable-line @typescript-eslint/no-extra-parens
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					instance?.subscribe((newValue) => replaceValue(keys as any, newValue, context))
				)
			);

			return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
		},
		[contextMap, replaceValue]
	);

	return values as unknown as ContextTypes<Contexts>;
}

// eslint-disable-next-line
const stub = () => {};

export function useContextUpdate<T>(context: SubscriptionContext<T>): ValueUpdater<T>
{
	assertInternalContext(context);
	assertSubscriptionContext(context);

	const instance = useReactContext(InstanceStackContext)[getContextId(context)];

	if (!instance)
	{
		if (IS_NON_PRODUCTION_ENVIRONMENT)
			throw new Error("useContextUpdate() can only be used within a matching <Provider>");
		else
			return stub;
	}

	return instance.update;
}