import type { BoundContextor, Contextor } from "./types";

export function isBoundContextor<Arg, Out>(contextor: Contextor<Arg, Out> | BoundContextor<Arg, Out>)
	: contextor is BoundContextor<Arg, Out>
{
	return contextor instanceof Array;
}