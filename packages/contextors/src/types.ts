/* eslint-disable @typescript-eslint/no-explicit-any */

import { Context } from "contexto";
import { RawContextor } from "./rawcontextor";

export type Tuple<T> = [T, ...T[]] | [];

export type Contextor<Arg, Out, ArgIsOptional extends boolean = boolean> = (
	(true extends ArgIsOptional
		?	((arg?: Arg | undefined) => BoundContextor<Arg, Out>) & { __optional: void }
		:	never)
	|
	(false extends ArgIsOptional
		?	((arg: Arg) => BoundContextor<Arg, Out>) & { __required: void }
		:	never)
) & { raw: RawContextor<any, Arg, Out> };

export type BoundContextor<Arg, Out> = [RawContextor<any, Arg, Out>, Arg];

export type ArglessContextorInput<Out=unknown> = (
	| Context<Out>
	| Contextor<any, Out, true>
);

export type ContextorInput<Arg, Out> = (
	| Context<Out>
	| Contextor<Arg, Out>
);

export type UseContextorInput<Arg, Out> = (
	| Contextor<Arg, Out, true>
	| BoundContextor<Arg, Out>
);

export type OutputsFor<Inputs extends Tuple<ContextorInput<any, unknown>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends ContextorInput<any, infer Out> ? Out : InputsT[Index]
	)
} : never;

export type ArgFreeCombiner<Inputs extends Tuple<unknown>, Out> =
	(...params: [...inputs: Inputs, arg?: never]) => Out;

export type Combiner<Inputs extends Tuple<unknown>, Arg, Out> =
	(...params: [...inputs: Inputs, arg: Arg]) => Out;

export type CombinerParamsAreEqual<T, Arg> =
	(params: [T, Arg], otherParams: [T, Arg]) => boolean;

type ObjectExtract<T, U> = (
	[T, U] extends [object, object]
		?	Simplify<{ [K in (keyof T & keyof U)]: ObjectExtract<T[K], U[K]> }>
		:	T
);

export type MandatoryArgBase<Inputs extends Tuple<ContextorInput<any, unknown>>, Arg> =
    // Can't use vanilla Extract here because Arg introduces a circular constraint
    ObjectExtract<CompatibleArgFor<Inputs>, Arg>;

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

type CompatibleArgsFor<Inputs extends Tuple<ContextorInput<any, any>>> = {
	[Index in keyof Inputs as (Inputs[Index] extends Contextor<any, any> ? Index : never)]: ArgFor<Inputs[Index]>
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

export type CompatibleArgFor<Inputs extends Tuple<ContextorInput<any, any>>> =
	({} extends CompatibleArgsFor<Inputs>	// eslint-disable-line @typescript-eslint/ban-types
		?	{ arg: unknown }				// There are no args to be compatible with
		:	HandleWrappedNever<UnionToIntersection<	// eslint-disable-next-line @typescript-eslint/indent
				WrapArg<CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]>>
	) extends { arg: infer Arg }
		?	[Arg] extends [object] ? (Arg & object) : Arg	// force (primitive & { ... }) to map to never
		:	never;

export type ContextorOptions<Inputs extends Tuple<ContextorInput<any, unknown>>, Arg> =
	Partial<{
		isEqual:	CombinerParamsAreEqual<OutputsFor<Inputs>, Arg>;
	}>;