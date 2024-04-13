import {
	useEffect,
	useLayoutEffect,
} from "react";
import { IS_SSR } from "./env";

//
// Use scheduler library if available.
// Not available in Preact, not available in React/RN unless explicitly installed.
//

let runWithNormalPriorityImpl = (block: () => void) => block();

import("scheduler")
	.then((scheduler) =>
		{
			runWithNormalPriorityImpl = (
				(block: () => void) =>
					scheduler.unstable_runWithPriority(scheduler.unstable_NormalPriority, block)
			);
		})
	.catch(() =>
		{
			/* ignore */
		});

export const runWithNormalPriority = (block: () => void) => runWithNormalPriorityImpl(block);

export const useIsomorphicLayoutEffect = IS_SSR ? useEffect : useLayoutEffect;

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