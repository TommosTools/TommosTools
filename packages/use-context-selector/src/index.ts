import {
	SubscriptionContext,
	Unsubscriber,
	useSubscriber,
} from "contexto";
import {
	useCallback,
	useEffect,
	useState,
} from "react";

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

export function useContextSelector<TInput, TOutput>(
	context:	SubscriptionContext<TInput>,
	selector:	(value: TInput) => TOutput,
	deps?:		unknown[]
): TOutput;

export function useContextSelector<TInput, TKey extends keyof TInput>(
	context:	SubscriptionContext<TInput>,
	selector:	TKey
): TInput[TKey];

export function useContextSelector<TInput, TOutput>(
	context:		SubscriptionContext<TInput>,
	rawSelector:	((value: TInput) => TOutput) | keyof TInput,
	deps?:			unknown[]
)
{
	const subscribe = useSubscriber();

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const selector = useCallback(
		rawSelector instanceof Function
			?	rawSelector
			:	(value: TInput) => value[rawSelector],
		// Ignore changes to rawSelector if it's a function – caller has responsibility for supplying the dependencies
		rawSelector instanceof Function ? (deps || []) : [rawSelector]
	);

	const subscribeWrapper = useCallback(
		() =>
			{
				const [value, unsubscribe] = subscribe(
					context,
					(newValue) =>
						setState((state) =>
							{
								const selection = selector(newValue);

								return (selection !== state.selection)
									?	{ value: newValue, selection, selector, context, unsubscribe }
									:	state;
							})
				) as [TInput, Unsubscriber];

				return { value, unsubscribe };
			},
		[context, selector, subscribe]
	);

	const [state, setState] = useState(() =>
		{
			const { value, unsubscribe } = subscribeWrapper();

			return { value, selection: selector(value), selector, context, unsubscribe };
		});

	useEffect(
		() =>
			{
				if (context !== state.context || selector !== state.selector)
				{
					let { value, unsubscribe, selection } = state;

					if (context !== state.context)
					{
						state.unsubscribe();
						({ value, unsubscribe } = subscribeWrapper());
					}

					// Don't recompute the selection if just the context has changed and its value is the same
					if (selector !== state.selector || value !== state.value)
						selection = selector(value);

					setState({ value, selection, selector, context, unsubscribe });
				}
			},
		[state, context, selector, subscribeWrapper]
	);

	return state.selection;
}

export default useContextSelector;