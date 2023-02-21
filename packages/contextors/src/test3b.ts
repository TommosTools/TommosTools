import react from "react";

type Tuple<T> = [] | [T, ...T[]];

type Wrapped<T> = { $$value: T; $$wrapped: true; }

function wrap<T>(value: T): Wrapped<T> { return { $$value: value, $$wrapped: true }; }
function unwrap<T>(wrapped: Wrapped<T>) { return wrapped.$$value; }
function isWrapped(value: any): value is Wrapped<any> { return "$$wrapped" in value; }

type Combiner<Output, Arg>          = (arg: Arg) => Output;
type WrappedOrCombiner<Output, Arg> = Wrapped<Output> | Combiner<Output, Arg>

type OutputFor<T>   = T extends WrappedOrCombiner<infer Output, {}> ? Output : never;
type OutputsFor<TT> = { [K in keyof TT]: OutputFor<TT[K]> };

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;


type ArgsFor<Inputs extends Tuple<WrappedOrCombiner<{}, {}>>> = Inputs extends infer InputsT ? {
	[Index in keyof InputsT]: (
		InputsT[Index] extends WrappedOrCombiner<any, infer Arg> ? Arg : InputsT[Index]
	)
} : never;

type ArgFor<Inputs extends Tuple<WrappedOrCombiner<{}, {}>>> =
	UnionToIntersection<ArgsFor<Inputs>[number]>;

type SingleArgFor<Input> =
    Input extends Combiner<{}, infer Arg> ? Arg : {};

function makeCombiner<Output, Inputs extends WrappedOrCombiner<{}, Arg>, Arg extends {}>(
	combine: (arg: Arg & SingleArgFor<Inputs>, values: OutputFor<Inputs>) => Output,
    inputs: Inputs
): Combiner<Output, Arg & SingleArgFor<Inputs>>
{
	return (arg: Arg & SingleArgFor<Inputs>) => {
		const values = (isWrapped(inputs) ? unwrap(inputs) : inputs(arg));
		return combine(arg, values as OutputFor<Inputs>);
	}
}

const Context1 = wrap({ a: 5 });
const CX1 = makeCombiner((arg: { c: number }, s) => 3, Context1);
const ctxinput = makeCombiner((arg, v1) => null, CX1);