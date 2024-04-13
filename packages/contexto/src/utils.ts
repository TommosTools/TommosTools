import {
	useEffect,
	useLayoutEffect,
} from "react";
import { IS_SSR } from "./env";

export const runWithNormalPriority = (() =>
	{
		try
		{
			//
			// Load scheduler library if available.
			// Not available in Preact, not available in React/RN unless explicitly installed.
			//

			// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
			const scheduler = require("scheduler");
			return (block: () => void) => scheduler.unstable_runWithPriority(scheduler.unstable_NormalPriority, block);
		}
		catch (e)
		{
			// Use default immediate evaluation
			return (block: () => void) => block();
		}
	}
)();

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