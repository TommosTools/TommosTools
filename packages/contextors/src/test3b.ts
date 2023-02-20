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

function makeCombiner<Inputs extends Tuple<WrappedOrCombiner<{}, Arg>>, Output, Arg>(
	inputs: Inputs,
	combine: (values: OutputsFor<Inputs>, arg: Arg) => Output
): Combiner<Output, Arg>
{
	return (arg: Arg) => {
		const values = inputs.map(input => isWrapped(input) ? unwrap(input) : input(arg));
		return combine(values as OutputsFor<Inputs>, arg);
	}
}

const Context1 = wrap({ a: 5 });
const CX1 = makeCombiner([Context1], (s, arg: { c: number }) => arg);
const ctxinput = makeCombiner([CX1], ([v1], arg: { c: number }) => null);