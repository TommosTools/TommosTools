import { useCallback, useContext as useReactContext } from "react";
import { ContextInstance, InstanceStackContext } from "./ContextInstance";
import { CONTEXTO_KEY, Listener, SubscriptionContext } from "./types";
import { assertSubscriptionContext, getContextId } from "./types/internal";

export type Subscriber		= <T>(context: SubscriptionContext<T>, callback: Listener<T>) => [T, Unsubscriber];
export type Unsubscriber	= () => void;

/**
 * Prepare a function to subscribe to updates of Contexto contexts.
 * 
 * @returns A stable `Subscriber` function associated with the Context values
 * at the calling component's position in the component tree.
 * 
 * Calling the `Subscriber` function adds a listener callback for a SubscriptionContext:
 * the given listener will be invoked with the latest value every time the
 * nearest Provider's value is updated (either by changing the value prop
 * or by imperative update).
 * It returns a tuple containing the current value of the context and a function to
 * unsubscribe from further updates.
 * 
 *   const subscribe = useSubscriber();
 * 
 *   let [latestValue, unsubscribe] =
 *       subscribe(SomeContext, newValue => { latestValue = newValue });
 *   // ...
 *   unsubscribe();
 */
export function useSubscriber(): Subscriber
{
	const instances = useReactContext(InstanceStackContext);

	return useCallback(
		<T>(context: SubscriptionContext<T>, callback: Listener<T>) =>
		{
			assertSubscriptionContext(context);

			const instance		= instances[getContextId(context)] as ContextInstance<T>;
			const currentValue	= instance ? instance.snapshot : context[CONTEXTO_KEY].defaultValue;

			const unsubscriber	= instance?.subscribe(callback) ?? (() => undefined);

			return [currentValue, unsubscriber];
		},
		[instances]
	);
}