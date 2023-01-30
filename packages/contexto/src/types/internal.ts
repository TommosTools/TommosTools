import type {
	Context,
	ContextDict,
	ContextId,
	Contexto,
	ContextTuple,
	SubscriptionContext,
} from ".";
import { CONTEXTO_KEY } from ".";
import type { ContextInstance } from "../ContextInstance";
import { IS_NON_PRODUCTION_ENVIRONMENT } from "../env";

export type InternalContext<T> = Context<T> & {
	readonly [CONTEXTO_KEY]:	{
		id:				ContextId;
		type:			"Subscription" | "Proxy";
		defaultValue:	T;
	}
};

export type InternalContextTuple	= InternalContext<unknown>[];
export type InternalContextDict		= { [K: string]: InternalContext<unknown> };

export type InstancesFor<Contexts> = Contexts extends infer ContextsT ? {
	[Index in keyof ContextsT]: (
		ContextsT[Index] extends Context<infer T> ? (ContextInstance<T> | undefined) : ContextsT[Index]
	)
} : never;

export type InternalContextsFor<Contexts> = {
	[Index in keyof Contexts]: (
		Contexts[Index] extends Context<infer T> ? InternalContext<T> : Contexts[Index]
	)
};

export type ContextInstanceStack = Contexto & {
	[id: ContextId]: ContextInstance<unknown>;
};

export const getContextId	= (context: InternalContext<unknown>): ContextId => (
	context[CONTEXTO_KEY].id
);

export const getContextIds	= (contexts: InternalContext<unknown>[]): ContextId[] => (
	contexts.map((context) => getContextId(context))
);

export function assertInternalContext<T>(context: Context<T>)
	: asserts context is InternalContext<T>
{
	if (IS_NON_PRODUCTION_ENVIRONMENT && !(CONTEXTO_KEY in context))
		throw new Error("Contexto Context is required");
}

export function assertSubscriptionContext<T>(context: Context<T>)
	: asserts context is SubscriptionContext<T> & InternalContext<T>
{
	assertInternalContext(context);

	if (IS_NON_PRODUCTION_ENVIRONMENT && context[CONTEXTO_KEY].type !== "Subscription")
		throw new Error(`Expected SubscriptionContext, got ${context[CONTEXTO_KEY].type}Context`);
}

export function asInternalContexts<Contexts extends ContextTuple | ContextDict>(contexts: Contexts)
	: InternalContextsFor<Contexts>
{
	if (IS_NON_PRODUCTION_ENVIRONMENT)
	{
		if (!Object.values(contexts).every((context) => CONTEXTO_KEY in context))
			throw new Error("Contexto Contexts are required");
	}

	return contexts as unknown as InternalContextsFor<Contexts>;
}