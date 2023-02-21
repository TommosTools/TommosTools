import react from "react";

type Tuple<T> = [] | [T, ...T[]];

type Wrapped<T> = { $$value: T; $$wrapped: true; }

function wrap<T>(value: T): Wrapped<T> { return { $$value: value, $$wrapped: true }; }
function unwrap<T>(wrapped: Wrapped<T>) { return wrapped.$$value; }
function isWrapped(value: any): value is Wrapped<any> { return "$$wrapped" in value; }

type Combiner<Output, Arg>          = (arg: Arg) => Output;
type WrappedOrCombiner<Output, Arg> = Wrapped<Output> | Combiner<Output, Arg>

type OutputFor<T>   = T extends WrappedOrCombiner<infer Output, {}> ? Output : never;
type OutputsFor<TT extends Tuple<WrappedOrCombiner<any, {}>>> = { [K in keyof TT]: OutputFor<TT[K]> };

function makeCombiner<CombineFunction extends (values: Tuple<any>, arg: any) => any>(
    inputs: CombineFunction extends (values: OutputsFor<infer Inputs>, arg: any) => any ? Inputs : never,
    combine: CombineFunction
)//: Combiner<Output, Arg>
{
    type Inputs = CombineFunction extends (values: OutputsFor<infer Inputs>, arg: any) => any ? Inputs : never;
    type Arg = CombineFunction extends (values: Tuple<any>, arg: infer ArgT) => any ? ArgT : never;

	return (arg: Arg) => {
		const values = (inputs as any[]).map(input => isWrapped(input) ? unwrap(input) : input(arg));
		return combine(values as any, arg);
	}
}

const Context1 = wrap({ a: 5 });
const CX1 = makeCombiner([Context1], (s, arg: { c: number }) => 3);
const ctxinput = makeCombiner([CX1], ([v1], arg: { c: number }) => null);