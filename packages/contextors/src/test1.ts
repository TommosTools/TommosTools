import react from "react";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Output> = (arg: Arg) => Output;

type OutputFor<T> = T extends F<{}, infer Output> ? Output : never;
type OutputsFor<TT> = { [K in keyof TT]: OutputFor<TT[K]> };

function makeF<Arg, Inputs extends Tuple<F<Arg, {}>>, Output>(
	inputs: Inputs,
	combiner: (values: OutputsFor<Inputs>, arg: Arg) => Output
): F<Arg, Output>
{
	return (arg: Arg) => {
		const values = inputs.map(input => input(arg)) as OutputsFor<Inputs>;
		return combiner(values, arg);
	}
}

const f0 = makeF([], (values, arg: { a: number }) => arg.a);
const f1 = makeF([], (values, arg: { b: string }) => arg.toString());
const f2 = makeF([f0,f1], (values: [number,string], arg: { a: number, b: string}) => null);