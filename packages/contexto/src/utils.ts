import {
	useEffect,
	useLayoutEffect,
} from "react";
import {
	unstable_NormalPriority as NormalPriority,
	unstable_runWithPriority as runWithPriority,
} from "scheduler";
import { IS_SSR } from "./env";

export const useIsomorphicLayoutEffect = IS_SSR ? useEffect : useLayoutEffect;

export const runWithNormalPriority = (
	runWithPriority
		?	(block: () => void) => runWithPriority(NormalPriority, block)
		:	(block: () => void) => block()		// For preact-compatibility, which doesn't have runWithPriority
);

export function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K>
{
	const result = {} as Pick<T, K>;

	for (const key of keys)
	{
		if (key in value)
			result[key] = value[key];
	}

	return result;
}