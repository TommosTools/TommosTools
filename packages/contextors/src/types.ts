/* eslint-disable @typescript-eslint/no-explicit-any */

import { Context } from "contexto";
import { RawContextor } from "./rawcontextor";

export type Tuple<T> = [T, ...T[]] | [];

export type Contextor<Arg, Out, ArgIsOptional extends boolean = boolean> = (
	(true extends ArgIsOptional
		?	RawContextor<any, Arg, Out> & { __optional: void }
		:	never)
	|
	(false extends ArgIsOptional
		?	RawContextor<any, Arg, Out> & { __required: void }
		:	never)
);

export type ArglessContextorSource<Out=unknown> = (
	| Context<Out>
	| Contextor<any, Out, true>
);

export type ContextorSource<Arg, Out> = (
	| Context<Out>
	| Contextor<Arg, Out>
);

export type OutputsFor<Sources extends Tuple<ContextorSource<any, unknown>>> = Sources extends infer SourcesT ? {
	[Index in keyof SourcesT]: (
		SourcesT[Index] extends ContextorSource<any, infer Out> ? Out : SourcesT[Index]
	)
} : never;

export type ArgFreeCombiner<Sources extends Tuple<ContextorSource<any, unknown>>, Out> =
	((...params: [...sources: OutputsFor<Sources>, arg?: never]) => Out);

export type Combiner<Sources extends Tuple<ContextorSource<any, unknown>>, Arg, Out> =
	((...params: [...sources: OutputsFor<Sources>, arg: Arg]) => Out);

export type CombinerParamsAreEqual<T, Arg> =
	(params: [T, Arg], otherParams: [T, Arg]) => boolean;

type ObjectExtract<T, U> = (
	[T, U] extends [object, object]
		?	Simplify<{ [K in (keyof T & keyof U)]: ObjectExtract<T[K], U[K]> }>
		:	T
);

export type MandatoryArgBase<Sources extends Tuple<ContextorSource<any, unknown>>, Arg> =
    // Can't use vanilla Extract here because Arg introduces a circular constraint
    ObjectExtract<CompatibleArgFor<Sources>, Arg>;

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

type CompatibleArgsFor<Sources extends Tuple<ContextorSource<any, any>>> = {
	[Index in keyof Sources as (Sources[Index] extends Contextor<any, any> ? Index : never)]: ArgFor<Sources[Index]>
};

type ArgFor<K> =
	K extends Contextor<infer Arg, any, true>
		?	Arg
		:	K extends Contextor<infer Arg, any, false>
			?	Arg
			:	never;

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type WrapArg<T> = {
	[K in keyof T]: { arg: T[K] }
};

type HandleWrappedNever<T> = [T] extends [never] ? { arg: never } : T;

export type CompatibleArgFor<Sources extends Tuple<ContextorSource<any, any>>> =
	({} extends CompatibleArgsFor<Sources>	// eslint-disable-line @typescript-eslint/ban-types
		?	{ arg: unknown }				// There are no args to be compatible with
		:	HandleWrappedNever<UnionToIntersection<	// eslint-disable-next-line @typescript-eslint/indent
				WrapArg<CompatibleArgsFor<Sources>>[keyof CompatibleArgsFor<Sources>]>>
	) extends { arg: infer Arg }
		?	[Arg] extends [object] ? (Arg & object) : Arg	// force (primitive & { ... }) to map to never
		:	never;

export type ContextorOptions<Sources extends Tuple<ContextorSource<any, unknown>>, Arg> =
	Partial<{
		isEqual:	CombinerParamsAreEqual<OutputsFor<Sources>, Arg>;
	}>;