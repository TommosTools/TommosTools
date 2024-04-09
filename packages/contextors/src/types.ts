/* eslint-disable @typescript-eslint/no-explicit-any */

import { Context } from "contexto";
import { RawContextor } from "./rawcontextor";

export type Tuple<T> = [T, ...T[]] | [];

export type Contextor<Tag, Out, TagIsOptional extends boolean = boolean> = (
	(true extends TagIsOptional
		?	RawContextor<any, Tag, Out> & { __optional: void }
		:	never)
	|
	(false extends TagIsOptional
		?	RawContextor<any, Tag, Out> & { __required: void }
		:	never)
);

export type TaglessContextorSource<Out=unknown> = (
	| Context<Out>
	| Contextor<any, Out, true>
);

export type ContextorSource<Tag, Out> = (
	| Context<Out>
	| Contextor<Tag, Out>
);

export type OutputsFor<Sources extends Tuple<ContextorSource<any, unknown>>> = Sources extends infer SourcesT ? {
	[Index in keyof SourcesT]: (
		SourcesT[Index] extends ContextorSource<any, infer Out> ? Out : SourcesT[Index]
	)
} : never;

export type TagFreeCombiner<Sources extends Tuple<ContextorSource<any, unknown>>, Out> =
	((...params: [...sources: OutputsFor<Sources>, tag?: never]) => Out);

export type Combiner<Sources extends Tuple<ContextorSource<any, unknown>>, Tag, Out> =
	((...params: [...sources: OutputsFor<Sources>, tag: Tag]) => Out);

export type CombinerParamsAreEqual<T, Tag> =
	(params: [T, Tag], otherParams: [T, Tag]) => boolean;

type ObjectExtract<T, U> = (
	[T, U] extends [object, object]
		?	Simplify<{ [K in (keyof T & keyof U)]: ObjectExtract<T[K], U[K]> }>
		:	T
);

export type MandatoryTagBase<Sources extends Tuple<ContextorSource<any, unknown>>, Tag> =
    // Can't use vanilla Extract here because Tag introduces a circular constraint
    ObjectExtract<CompatibleTagFor<Sources>, Tag>;

export type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

type CompatibleTagsFor<Sources extends Tuple<ContextorSource<any, any>>> = {
	[Index in keyof Sources as (Sources[Index] extends Contextor<any, any> ? Index : never)]: TagFor<Sources[Index]>
};

type TagFor<K> =
	K extends Contextor<infer Tag, any, true>
		?	Tag
		:	K extends Contextor<infer Tag, any, false>
			?	Tag
			:	never;

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type WrapTag<T> = {
	[K in keyof T]: { tag: T[K] }
};

type HandleWrappedNever<T> = [T] extends [never] ? { tag: never } : T;

export type CompatibleTagFor<Sources extends Tuple<ContextorSource<any, any>>> =
	({} extends CompatibleTagsFor<Sources>	// eslint-disable-line @typescript-eslint/ban-types
		?	{ tag: unknown }				// There are no tags to be compatible with
		:	HandleWrappedNever<UnionToIntersection<	// eslint-disable-next-line @typescript-eslint/indent
				WrapTag<CompatibleTagsFor<Sources>>[keyof CompatibleTagsFor<Sources>]>>
	) extends { tag: infer Tag }
		?	[Tag] extends [object] ? (Tag & object) : Tag	// force (primitive & { ... }) to map to never
		:	never;

export type ContextorOptions<Sources extends Tuple<ContextorSource<any, unknown>>, Tag> =
	Partial<{
		isEqual:	CombinerParamsAreEqual<OutputsFor<Sources>, Tag>;
	}>;