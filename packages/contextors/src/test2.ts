import react from "react";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Output> = (arg: Arg) => Output;
type ValueOrF<Arg, Output> = Output | F<Arg, Output>

type OutputFor<T> = T extends ValueOrF<{}, infer Output> ? Output : never;
type OutputsFor<TT> = { [K in keyof TT]: OutputFor<TT[K]> };

function makeF<Arg, Inputs extends Tuple<ValueOrF<Arg, {}>>, Output>(
	inputs: Inputs,
	combiner: (values: OutputsFor<Inputs>, arg: Arg) => Output
): F<Arg, Output>
{
	return (arg: Arg) => {
		const values = inputs.map(input => input instanceof Function ? input(arg) : input) as OutputsFor<Inputs>;
		return combiner(values, arg);
	}
}

const g0 = 1234;
const f0 = makeF([g0], ([g0val], arg: { a: number }) => arg.a + g0val);
const f1 = makeF([], (values, arg: { b: number }) => arg.toString());
const f2 = makeF([f0,f1,g0], (values: [number,string,number], arg: { a: number, b: number}) => null);