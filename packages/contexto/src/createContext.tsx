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
	useState,
} from "react";
import {
	ContextInstance,
	InstanceStackContext,
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
	ContextInstanceStack,
	CONTEXTO_KEY,
	INHERIT,
	InternalContext,
} from "./types/internal";
import { useIsomorphicLayoutEffect } from "./utils";

const DEFAULT_DISPLAY_NAME = "Contexto";

export function createContext<T>(defaultValue: T, options?: ContextOptions): SubscriptionContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
	{
		const displayName = options?.displayName;

		// Bit of messiness here so we can close around `context`
		const internalContext = { displayName } as InternalContext<T>;

		const Provider = createProvider(id, undefined, defaultValue) as ComponentType<unknown>;

		Object.defineProperties(internalContext, {
			Provider: { value: Provider },
			Consumer: { value: createConsumer(internalContext) },
			[CONTEXTO_KEY]: { value: { id, defaultValue, type: "Subscription" } },
		});

		installDisplayNameGetter(Provider, internalContext);

		return internalContext as SubscriptionContext<T>;
	});
}

export function createCompatibleContext<T>(defaultValue: T, options?: ContextOptions): CompatibleSubscriptionContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
	{
		// Can treat vanilla React context as an internal context during initialisation only
		const reactContext		= createReactContext(defaultValue);
		const internalContext	= reactContext as InternalContext<T>;

		const Provider = createProvider(id, reactContext, defaultValue) as ComponentType<unknown>;

		Object.defineProperties(internalContext, {
			Provider: { value: Provider },
			Consumer: { value: createConsumer(internalContext) },
			[CONTEXTO_KEY]: { value: { id, defaultValue, type: "Subscription" } },
		});

		installDisplayNameGetter(Provider, internalContext);

		return internalContext as CompatibleSubscriptionContext<T>;
	});
}

export function createProxyContext<T>(context: ReactContext<T>, options?: ProxyContextOptions): ProxyContext<T>
{
	return createOrRetrieve(options?.contextId, (id: ContextId) =>
	{
		if (IS_NON_PRODUCTION_ENVIRONMENT && CONTEXTO_KEY in context)
			throw new Error("createProxyContext(..) expects a React.Context, not a contexto.Context");

		// NAUGHTY!  Shouldn't go fossicking around the react internals
		// eslint-disable-next-line no-underscore-dangle
		const defaultValue = (context as unknown as { _currentValue: T })._currentValue;

		const internalContext = context as InternalContext<T>;

		const Provider = createProxyProvider(id, context, defaultValue) as ComponentType<unknown>;

		Object.defineProperties(context, {
			Provider: { value: Provider },
			Consumer: { value: createConsumer(internalContext) },
			[CONTEXTO_KEY]: { value: { id, defaultValue, type: "Proxy" } },
		});

		installDisplayNameGetter(Provider, internalContext);

		return internalContext;
	});
}

const generateContextId = (() =>
{
	let counter = 0;
	return (): ContextId => String(++counter);	// eslint-disable-line no-plusplus
})();

const contextCache: { [K: ContextId]: InternalContext<unknown> } = {};

type BaseContextFactory = (id: ContextId) => Context<unknown>;

function createOrRetrieve<ContextFactory extends BaseContextFactory>(
	contextId:	ContextId | undefined,
	factory:	ContextFactory
): ReturnType<ContextFactory>
{
	if (WARN_ABOUT_MISSING_CONTEXT_ID && contextId === undefined)
	{
		// eslint-disable-next-line no-console
		console.warn("No contextId provided to context constructor. React / Fast Refresh compatibility is limited.");
	}

	if (contextId !== undefined && contextCache[contextId])
		return contextCache[contextId] as ReturnType<ContextFactory>;

	const id		= contextId ?? generateContextId();
	const context	= factory(id);

	contextCache[id] = context as InternalContext<unknown>;

	return context as ReturnType<ContextFactory>;
}

function installDisplayNameGetter(Provider: ComponentType<unknown>, context: InternalContext<unknown>)
{
	Object.defineProperty(Provider, "displayName", {
		get()
		{
			return `${context.displayName ?? DEFAULT_DISPLAY_NAME}.${context[CONTEXTO_KEY].type}Provider`;
		},
	});
}

function createProvider<T, CompatContext extends ReactContext<T> | undefined>(
	contextId:		ContextId,
	compatContext:	CompatContext,
	defaultValue:	T
)
{
	const Provider = compatContext?.Provider;

	return forwardRef<ProviderRef<T>, ProviderProps<T>>(
		(props, ref) =>
		{
			if (IS_NON_PRODUCTION_ENVIRONMENT && ("initialValue" in props && "value" in props))
				throw new Error("Cannot provide both value and initialValue props");

			const disableValueUpdates	= "initialValue" in props;
			const value					= (disableValueUpdates ? props.initialValue : props.value) as T;

			const [instances, thisInstance] = useContextInstance<T>(contextId, value, defaultValue);

			// Update whenever the Provider's `value` prop changes (unless this behaviour has been disabled)
			useUpdateWhenValueChanges(thisInstance, value, !disableValueUpdates);

			// Expose methods on refs to Provider components.
			useImperativeHandle(
				ref,
				() => ({
					update: thisInstance.update,
					getSnapshot: () => thisInstance.snapshot,
				}),
				[thisInstance]
			);

			const children = Provider
				?	<CompatibilityWrapper provider={Provider} instance={thisInstance} children={props.children} />
				:	props.children;

			return <InstanceStackContext.Provider value={instances} children={children} />;
		}
	) as ProviderComponentType<T>;
}

function createConsumer<T>(context: Context<T>)
{
	return ({ children, isEqual }: ConsumerProps<T>) =>
	{
		const value = useContext(context, isEqual);

		return children(value);
	};
}

type CompatibilityWrapperProps<T> = PropsWithChildren<{
	provider: ReactProvider<T>;
	instance: ContextInstance<T>;
}>;

function CompatibilityWrapper<T>({ provider: Provider, instance, children }: CompatibilityWrapperProps<T>)
{
	const [value, setValue] = useState<T>(instance.snapshot);

	useIsomorphicLayoutEffect(
		() => instance.subscribe(setValue),
		[instance, setValue]
	);

	return <Provider value={value} children={children} />;
}

function createProxyProvider<T>(id: ContextId, context: ReactContext<T>, defaultValue: T)
{
	const { Provider: BaseProvider } = context;

	// eslint-disable-next-line react/function-component-definition
	return ({ children, value }: PropsWithChildren<{ value: T }>) =>
	{
		const [instances, thisInstance]	= useContextInstance(id, value, defaultValue);

		useUpdateWhenValueChanges(thisInstance, value, true);

		return (
			<InstanceStackContext.Provider value={instances}/* eslint-disable-line react/jsx-indent */>
				<BaseProvider value={value} children={children} /* eslint-disable-line react/jsx-indent */ />
			</InstanceStackContext.Provider>
		);
	};
}

function useContextInstance<T>(
	contextId:				ContextId,
	initialValueOrInherit:	T | typeof INHERIT,
	defaultValue:			T
): [ContextInstanceStack, ContextInstance<T>]
{
	const existingInstances	= useReactContext(InstanceStackContext);
	const initialValue		= (				// eslint-disable-line @typescript-eslint/no-extra-parens
		initialValueOrInherit !== INHERIT	// eslint-disable-line no-nested-ternary
			?	initialValueOrInherit
			:	contextId in existingInstances
				?	existingInstances[contextId].snapshot
				:	defaultValue
	);

	const [instances]		= useState<ContextInstanceStack>(() => ({
		...existingInstances,
		[contextId]: new ContextInstance(initialValue),
	}));

	return [instances, instances[contextId] as ContextInstance<T>];
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