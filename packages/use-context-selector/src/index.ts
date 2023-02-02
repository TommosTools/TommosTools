import {
	SubscriptionContext,
	useSubscriber,
} from "contexto";
import { useState } from "react";

export function useContextSelector<T, R>(
	context: SubscriptionContext<T>,
	selector: (value: T) => R
): R
{
	const subscribe = useSubscriber();

	const [selection, setSelection] = useState(
		(): R =>
		{
			const [initialContextValue] = subscribe(
				context,
				(contextValue) => setSelection(selector(contextValue))
			);
			return selector(initialContextValue);
		}
	);

	return selection;
}

export default useContextSelector;