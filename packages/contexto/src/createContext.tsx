import type {
	ComponentType,
	Context as ReactContext,
	PropsWithChildren,
	Provider as ReactProvider,
} from "react";
import {
	createContext as createReactContext,
	forwardRef,
	useContext as useReactContext,
	useImperativeHandle,
	useRef,
	useState
} from "react";
import {
	ContextInstance,
	InstanceStackContext
} from "./ContextInstance";
import {
	IS_NON_PRODUCTION_ENVIRONMENT,
	WARN_ABOUT_MISSING_CONTEXT_ID,
} from "./env";
import { useContext } from "./hooks";
import type {
	CompatibleSubscriptionContext,
	ConsumerProps,
	Context,
	ContextId,
	ContextOptions,
	ProviderComponentType,
	ProviderProps,
	ProviderRef,
	ProxyContext,
	ProxyContextOptions,
	SubscriptionContext,
} from "./types";
import {
	CONTEXTO_KEY,
	INHERIT,
} from "./types";
import {
	ContextInstanceStack,
	InternalContext,
} from "./types/internal";
import { useIsomorphicLayoutEffect } from "./utils";

const DEFAULT_DISPLAY_NAME = "Contexto";

export function createContext<T>(defaultValue: T, options?: ContextOptions): SubscriptionContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
		{
			const displayName = options?.displayName;

			const context: any = { displayName };
			
			context.Provider		= createProvider(id, undefined, defaultValue);
			context.Consumer		= createConsumer(context);
			context[CONTEXTO_KEY]	= { id, defaultValue, type: "Subscription" };

			installDisplayNameGetter(context.Provider, context);

			return context;
		});
}

export function createCompatibleContext<T>(defaultValue: T, options?: ContextOptions): CompatibleSubscriptionContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
		{
			const displayName = options?.displayName;

			const context: any = createReactContext(defaultValue);
			
			context.Provider		= createProvider(id, context, defaultValue);
			context.Consumer		= createConsumer(context);
			context[CONTEXTO_KEY]	= { id, defaultValue, type: "Subscription" };

			installDisplayNameGetter(context.Provider, context);

			return context;
		});
}

export function createProxyContext<T>(context: ReactContext<T>, options?: ProxyContextOptions): ProxyContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
		{
			if (IS_NON_PRODUCTION_ENVIRONMENT && CONTEXTO_KEY in context)
				throw new Error("createProxyContext(..) expects a React.Context, not a contexto.Context");
			
			const anyContext	= context as any;
			const defaultValue	= anyContext._currentValue as T;	// NAUGHTY!  Shouldn't go fossicking around the react internals
	
			anyContext.Provider			= createProxyProvider(id, context, defaultValue);
			anyContext.Consumer			= createConsumer(anyContext);
			anyContext[CONTEXTO_KEY]	= { id, defaultValue, type: "Proxy" };

			installDisplayNameGetter(context.Provider, anyContext);
	
			return anyContext;
		});
}

const generateContextId = (() =>
	{
		let counter = 0;
		return (): ContextId => String(++counter);
	}
)();

const contextCache: { [K: ContextId]: InternalContext<any> } = {};

function createOrRetrieve<ContextFactory extends (id: ContextId) => Context<any>>(
	contextId:	ContextId | undefined,
	factory:	ContextFactory
): ReturnType<ContextFactory>
{
	if (WARN_ABOUT_MISSING_CONTEXT_ID && contextId === undefined)
		console.warn("No contextId provided to createContext(..) / createCompatibleContext(..) / createProxyContext(..).  React / Fast Refresh compatibility is limited.");

	if (contextId !== undefined && contextCache[contextId])
		return contextCache[contextId] as ReturnType<ContextFactory>;

	const id		= contextId ?? generateContextId();
	const context	= factory(id);

	contextCache[id] = context as any;

	return context as ReturnType<ContextFactory>;
}

function installDisplayNameGetter(Provider: ComponentType<any>, context: InternalContext<any>)
{
	Object.defineProperty(Provider, "displayName", {
		get() {
			return `${context.displayName ?? DEFAULT_DISPLAY_NAME}.${context[CONTEXTO_KEY].type}Provider`;
		}
	});
}

function createProvider<T, CompatContext extends ReactContext<T> | undefined>(id: ContextId, compatContext: CompatContext, defaultValue: T)
{
	const Provider = compatContext?.Provider;

	return forwardRef<ProviderRef<T>, ProviderProps<T>>(
		({ children, ...props }, ref) =>
		{
			if (IS_NON_PRODUCTION_ENVIRONMENT && ("initialValue" in props && "value" in props))
				throw new Error("Cannot provide both value and initialValue props");

			const disableValueUpdates	= "initialValue" in props;
			const value					= (disableValueUpdates ? props.initialValue : props.value) as T;

			const [instances, thisInstance] = useContextInstance<T>(id, value, defaultValue);

			// Update whenever the Provider's `value` prop changes (unless this behaviour has been disabled)
			useUpdateWhenValueChanges(thisInstance, value, !disableValueUpdates);

			// Expose methods on refs to Provider components.
			useImperativeHandle(ref,
				() =>
				({
					update: thisInstance.update,
					getSnapshot: () => thisInstance.snapshot
				}),
				[thisInstance]);
			
			if (Provider)
				children = <CompatibilityWrapper provider={Provider} instance={thisInstance} children={children} />;
			
			return <InstanceStackContext.Provider value={instances} children={children} />
		}) as ProviderComponentType<T>;
}

function createConsumer<T>(context: Context<T>)
{
	return ({ children, isEqual }: ConsumerProps<T>) =>
		{
			const value = useContext(context, isEqual);

			return children(value);
		}
}

type CompatibilityWrapperProps<T> = PropsWithChildren<{
	provider: ReactProvider<T>;
	instance: ContextInstance<T>;
}>

function CompatibilityWrapper<T>({ provider: Provider, instance, children }: CompatibilityWrapperProps<T>)
{
	const [value, setValue] = useState<T>(instance.snapshot);

	useIsomorphicLayoutEffect(
		() => instance.subscribe(setValue),
		[instance, setValue]
	);

	return <Provider value={value} children={children} />
}

function createProxyProvider<T>(id: ContextId, context: ReactContext<T>, defaultValue: T)
{
	const { Provider: BaseProvider } = context;

	return ({ children, value }: PropsWithChildren<{ value: T }>) =>
		{
			const [instances, thisInstance]	= useContextInstance(id, value, defaultValue);

			useUpdateWhenValueChanges(thisInstance, value, true);

			return (
				<InstanceStackContext.Provider value={instances}>
					<BaseProvider value={value} children={children} />
				</InstanceStackContext.Provider>
			);
		};
}

function useContextInstance<T>(id: ContextId, initialValueOrInherit: T | typeof INHERIT, defaultValue: T): [ContextInstanceStack, ContextInstance<T>]
{
	const existingInstances	= useReactContext(InstanceStackContext);
	const initialValue		= (
		initialValueOrInherit !== INHERIT
			?	initialValueOrInherit
			:	(id in existingInstances)
				?	existingInstances[id].snapshot
				:	defaultValue
	);

	const [instances]		= useState<ContextInstanceStack>(() => ({
		...existingInstances,
		[id]: new ContextInstance(initialValue)
	}));

	return [instances, instances[id] as ContextInstance<T>];
}

function useUpdateWhenValueChanges<T>(instance: ContextInstance<T>, value: T, enabled: boolean)
{
	const prevValue = useRef<T | undefined>(value);

	useIsomorphicLayoutEffect(
		() =>
		{
			if (enabled && value !== prevValue.current)
			{
				instance.updateWithNormalPriority(value);
				prevValue.current = value;
			}
		},
		[enabled, instance, value]
	);
}
