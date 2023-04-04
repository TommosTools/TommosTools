import { createContext as createReactContext } from "react";
import { batchedUpdates } from "./targetPlatform/batchedUpdates";
import {
	Contexto,
	Listener,
	Revision,
	Unsubscriber,
} from "./types";
import { ContextInstanceStack } from "./types/internal";
import { runWithNormalPriority } from "./utils";

export const InstanceStackContext = (() => createReactContext<ContextInstanceStack>({} as Contexto))();
InstanceStackContext.displayName = "Contexto.InstanceStack";

export class ContextInstance<T>
{
	private	store:						T;

	private readonly listeners:			Set<Listener<T>>;

	constructor(initialValue: T)
	{
		this.store = initialValue;

		// listeners is read-only but its contents are mutable
		this.listeners = new Set<Listener<T>>();

		this.subscribe					= this.subscribe.bind(this);
		this.update						= this.update.bind(this);
		this.updateWithNormalPriority	= this.updateWithNormalPriority.bind(this);
	}

	get snapshot(): T
	{
		return this.store;
	}

	subscribe(onChange: Listener<T>): Unsubscriber
	{
		const { listeners } = this;

		listeners.add(onChange);
		return () => listeners.delete(onChange);
	}

	update(revision: Revision<T>): void
	{
		const { store, listeners } = this;

		const value = revision instanceof Function
			?	revision(store)
			:	revision;

		this.store = value;
		batchedUpdates(() => listeners.forEach((notify) => notify(value)));
	}

	updateWithNormalPriority(revision: Revision<T>): void
	{
		runWithNormalPriority(() => this.update(revision));
	}
}