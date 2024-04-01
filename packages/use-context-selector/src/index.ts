import {
	SubscriptionContext,
	Unsubscriber,
	useSubscriber,
} from "contexto";
import {
	useCallback,
	useEffect,
	useReducer,
} from "react";

type State<TInput, TSelector extends (value: TInput) => unknown> = {
	latestInput:	TInput,
	selection:		ReturnType<TSelector>;
	selector:		TSelector;
	context:		SubscriptionContext<TInput>;
	unsubscribe:	Unsubscriber;
};

type Action<TInput, TSelector extends (value: TInput) => unknown> = (
	| { type: "update", value: TInput }
	| { type: "reconfigure", context: SubscriptionContext<TInput>, selector: TSelector }
);

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

	type Selector = typeof selector;

	const listenForUpdates = (subscriptionContext: SubscriptionContext<TInput>): [TInput, Unsubscriber] =>
		subscribe(subscriptionContext, (value) => dispatch({ type: "update", value }));

	const [state, dispatch] = useReducer(
		(prevState: State<TInput, Selector>, action: Action<TInput, Selector>) =>
			{
				if (action.type === "update")
				{
					const selection = prevState.selector(action.value);

					// Only update if the selection has changed
					if (selection !== prevState.selection)
					{
						return {
							...prevState,
							selection:		prevState.selector(action.value),
							latestInput:	action.value,
						};
					}
				}
				else if (action.type === "reconfigure")
				{
					if (prevState.context !== action.context || prevState.selector !== action.selector)
					{
						let { latestInput, unsubscribe } = prevState;

						// If the context has changed(!), unsubscribe from the old and subscribe to the new
						if (action.context !== prevState.context)
						{
							prevState.unsubscribe();

							[latestInput, unsubscribe] = listenForUpdates(action.context);
						}

						// Only recompute the selected value if the selector or the input has changed
						const selection = (
							(action.selector !== prevState.selector || latestInput !== prevState.latestInput)
								?	action.selector(latestInput)
								:	prevState.selection
						);

						return {
							latestInput,
							selection,
							selector:	action.selector,
							context:	action.context,
							unsubscribe,
						};
					}
				}

				return prevState;
			},
		null,
		() =>
			{
				const [latestInput, unsubscribe]	= listenForUpdates(context);
				const selection						= selector(latestInput);

				return {
					latestInput,
					selection,
					selector,
					context,
					unsubscribe,
				};
			}
	);

	useEffect(
		() =>
			{
				//
				// Listen for changed context and/or selector.
				// Although the reconfigure action is a no-op if context and selector are both unchanged,
				// any call to dispatch() causes a re-render, so we guard against that.
				//

				if (context !== state.context || selector !== state.selector)
					dispatch({ type: "reconfigure", context, selector });
			},
		[context, state.context, selector, state.selector]
	);

	return state.selection;
}

export default useContextSelector;