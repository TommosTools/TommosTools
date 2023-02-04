/* eslint-disable  @typescript-eslint/no-explicit-any */

import {
	ContextType,
	SubscriptionContext,
	useSubscriber,
} from "contexto";
import { useState } from "react";

/**
 * Extract a value from a context's latest value.
 * 
 * @param context	Contexto context object (returned from `createContext` / `createCompatibleContext`)
 * @param selector	A field in the context value, or a function to derive a value from the context value
 * 
 * `useContextSelector` is more stable than `useContext` – changes to the context value will only cause
 * the calling component to re-render if the _extracted value_ changes.
 * 
 *     useContext(MyContext).field				// calling component is re-rendered every time MyContext changes
 *     useContextSelector(MyContext, "field")	// calling component re-rendered only when .field changes
 * 
 * Example:
 * 
 *     const MyContext = createContext({ quickTick: 0, slowTick: 0 });
 * 
 *     function useTicker(periodMs, delayMs=0) {
 *       const [tick, setTick] = useState(0);
 *       useEffect(() => {
 *         setTimeout(() =>
 *           setInterval(() => setTick(t => t + 1), periodMs),
 *           delayMs
 *         );
 *       }, []);
 *       return tick;
 *     }
 * 
 *     const Provider = ({ children }) => {
 *       const quickTick = useTicker(100);
 *       const slowTick  = useTicker(1000, 50);
 *       return <MyContext.Provider value={{ quickTick, slowTick }} children={children} />
 *     }
 *
 *     const SlowConsumer = () => {
 *       // Will render only once a second
 *       const tick = useContextSelector(MyContext, "slowTick");
 *       return <>{tick}</>
 *     }
 *     const QuickConsumer = () => {
 *       // Will render 10 times a second (not 11)
 *       const tick = useContextSelector(MyContext, "quickTick");
 *       return <>{tick}</>
 *     }
 * 
 *     const App = () =>
 *       <Provider>
 *         <SlowConsumer/>
 *         <QuickConsumer/>
 *       </Provider>
 */

export function useContextSelector<C extends SubscriptionContext<any>, R>(
	context: C,
	selector: (value: ContextType<C>) => R
): R;

export function useContextSelector<C extends SubscriptionContext<any>, K extends keyof ContextType<C>>(
	context: C,
	selector: keyof ContextType<C>
): ContextType<C>[K];

export function useContextSelector<C extends SubscriptionContext<any>>(
	context: C,
	selector: ((value: any) => any) | keyof ContextType<C>
)
{
	const subscribe = useSubscriber();

	const [selection, setSelection] = useState(
		() =>
		{
			const selectorFn = (
				selector instanceof Function
					?	selector
					:	(contextValue: ContextType<C>) => contextValue[selector]
			);

			const [initialContextValue] = subscribe(
				context,
				(contextValue) => setSelection(selectorFn(contextValue))
			) as any;

			return selectorFn(initialContextValue);
		}
	);

	return selection;
}

export default useContextSelector;