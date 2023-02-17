import type {
	Context as ReactContext,
	ExoticComponent,
	ForwardRefExoticComponent,
	ReactNode,
	RefAttributes,
} from "react";

export const CONTEXTO_MAIN_KEY: unique symbol;
export const CONTEXTO_KEY: unique symbol;

export const INHERIT: unique symbol;

export type ContextId = string;

type BaseContext = {
	[CONTEXTO_KEY]: unknown;
};

export type Context<T> = SubscriptionContext<T> | ProxyContext<T>;

export type SubscriptionContext<T> = ContextoSubscriptionContext<T> | CompatibleSubscriptionContext<T>;

export type ContextoSubscriptionContext<T> = BaseContext & {
	displayName?:		string;
	readonly Provider:	ProviderComponentType<T>;
	readonly Consumer:	ConsumerComponentType<T>;
};

export type CompatibleSubscriptionContext<T> = ContextoSubscriptionContext<T> & ReactContext<T>;

export type ProxyContext<T> = BaseContext & {
	displayName?:		string;
	readonly Consumer:	ConsumerComponentType<T>;
};

export type Revision<T>		= T | ((oldValue: T) => T);
export type ValueUpdater<T>	= (revision: Revision<T>) => void;

export type Listener<T>		= (newValue: T) => void;
export type Unsubscriber	= () => void;

export type ProviderProps<T> = {
	children?: ReactNode;
} & (
	{
		initialValue: T | typeof INHERIT;
		value?: never;
	} | {
		initialValue?: never;
		value: T;
	}
);

export type ProviderRef<T> = { update: ValueUpdater<T>, getSnapshot: () => T };
export type ProviderComponentType<T> = (
	ForwardRefExoticComponent<ProviderProps<T> & RefAttributes<ProviderRef<T>>>
);

export type ConsumerProps<T> = {
	children: (value: T) => ReactNode;
	isEqual?: IsEqual<T>;
};
export type ConsumerComponentType<T> = ExoticComponent<ConsumerProps<T>>;

export type IsEqual<T> = (oldValue: T, newValue: T, context: Context<T>) => boolean;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContextType<C extends Context<any>> = C extends Context<infer T> ? T : never;

export type ContextTuple	= [] | [Context<unknown>, ...Context<unknown>[]];	// Ensure that tuple mapping works
export type ContextDict		= { [K: string]: Context<unknown> };

export type ContextTypes<Contexts> = Contexts extends infer ContextsT ? {
	[Index in keyof ContextsT]: (
		ContextsT[Index] extends Context<infer T> ? T : ContextsT[Index]
	)
} : never;

export type SomeTypeFor<Contexts> = ContextTypes<Contexts>[keyof ContextTypes<Contexts>];

export type ContextOptions = Partial<{
	contextId: ContextId,
	displayName: string,
}>;

/**
 * Creates a special Context object for use with Contexto's extended context operations.
 * 
 * @param defaultValue The value provided to context consumers when there is no matching
 * Provider components above them in the component tree.
 * @param options (optional)
 * @param options.contextId A unique string used to identify this context when "hot reloading"
 * (aka "fast refresh") is enabled. If no identifier is provided then all Contexto context values
 * reset on page refresh during development, so use of `contextId` is *strongly recommended*.
 * @param options.displayName Set the `.displayName` property of the new context object.
 * 
 * @returns A subscription context object that can be read using useContext and useContexts,
 * and updated using imperative updates.
 */
export declare function createContext<T>(
	defaultValue: T,
	options?: ContextOptions
): ContextoSubscriptionContext<T>;

/**
 * Creates a special Context object for use with Contexto's extended context operations which
 * is also fully compatible with the standard React context operations.
 * 
 * @param defaultValue The value provided to context consumers when there is no matching
 * Provider components above them in the component tree.
 * @param options (optional)
 * @param options.contextId A unique string used to identify this context when "hot reloading"
 * (aka "fast refresh") is enabled. If no identifier is provided then all Contexto context values
 * reset on page refresh during development, so use of `contextId` is *strongly recommended*.
 * @param options.displayName Set the `.displayName` property of the new context object.
 * 
 * @returns A subscription context object that can be read using useContext and useContexts,
 * and updated using imperative updates, and is fully compatible with the standard React
 * context operations.
 */
export declare function createCompatibleContext<T>(
	defaultValue: T,
	options?: ContextOptions,
): CompatibleSubscriptionContext<T>;

export type ProxyContextOptions = Partial<{
	contextId: ContextId;
}>;

/**
 * Wraps a standard `React.Context` object to create a special Context object suitable for
 * use with Contexto's `useContext` and `useContexts` hooks.
 * 
 * @param context A standard `React.Context`.
 * @param options (optional)
 * @param options.contextId A unique string used to identify this context when "hot reloading".
 * @returns A read-only proxy Context object to allow contexts created outside the Contexto
 * ecosystem to be used with Contexto's consumer hooks.
 */
export declare function createProxyContext<T>(context: ReactContext<T>, options?: ProxyContextOptions): ProxyContext<T>;

/**
 * Consume and subscribe to updates of a context's value in a function component.
 * 
 * @param context A Contexto context previously created with `createContext`, `createCompatibleContext`,
 * or `createProxyContext`.
 * @param isEqual A function to compare two context values.
 * @returns The context value for the calling component.
 */
export declare function useContext<T>(context: Context<T>, isEqual?: IsEqual<T>): T;

/**
 * Consume and subscribe to updates of multiple contexts' values in a function component.
 * 
 * @param contexts A list or object containing zero or more Contexto contexts previously created
 * with `createContext`, `createCompatibleContext`, or `createProxyContext`.
 * @param isEqual A function to compare two values from a single context.
 * @returns An array (or object) mapping each context in the input to the corresponding
 * context value for the calling component.
 */
export declare function useContexts<Contexts extends ContextTuple | ContextDict>(
	contexts: Contexts,
	isEqual?: IsEqual<SomeTypeFor<Contexts>>
): ContextTypes<Contexts>;

/**
 * Prepare a function to update the value of a Contexto context.
 * 
 * @param context A Contexto context previously created with `createContext` or `createCompatibleContext`.
 * @returns A stable function which updates the value of the nearest containing Provider
 * for the given context.
 */
export declare function useContextUpdate<T>(context: SubscriptionContext<T>): ValueUpdater<T>;

export type Contexto = {
	[CONTEXTO_MAIN_KEY]: void;
};

export type BridgeProviderProps = {
	value:		Contexto;
	children?:	ReactNode;
};

export declare function BridgeProvider(props: BridgeProviderProps): ReactNode;

/**
 * Return an object that can be passed to a <BridgeProvider> to "bridge" contexts
 * between different renderers.
 * 
 * @param contexts A list of Contexto contexts.
 */
export declare function useBridgeValue(contexts: ContextTuple): Contexto;

/** API access: not for general consumption. */
export type Subscriber = <T>(context: Context<T>, callback: Listener<T>) => [T, Unsubscriber];
export declare function useSubscriber(): Subscriber;
export declare function isContext(value: unknown): value is Context<unknown>;