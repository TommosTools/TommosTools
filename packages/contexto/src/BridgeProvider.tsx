import React from "react";
import { InstanceStackContext } from "./ContextInstance";
import { useInternalContexts } from "./hooks";
import {
	BridgeProviderProps,
	Contexto,
	ContextTuple
} from "./types";
import { getContextIds } from "./types/internal";
import { pick } from "./utils";

export const BridgeProvider = (props: BridgeProviderProps) =>
	<InstanceStackContext.Provider {...props} />

export function useBridgeValue(contexts: ContextTuple): Contexto
{
	const internalContexts	= useInternalContexts(contexts);

	const allInstances		= React.useContext(InstanceStackContext);
	const filteredInstances	= React.useMemo(
		() => pick(allInstances, getContextIds(internalContexts)),
		[allInstances, internalContexts]);

	return filteredInstances as Contexto;
}
