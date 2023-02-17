import react from "react";
import { Context, createContext, useContext, isContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

class F<Arg, Inputs extends Tuple<ContextOrF<Arg, any>>, Output>
{
    constructor(
        private inputs: Inputs,
        private combiner: (values: OutputsFor<Inputs>, arg: Arg) => Output
    )
    {}

    call(arg: Arg): Output
    {
        const values = this.inputs.map(input => isContext(input) ? useContext(input) : input.call(arg)) as OutputsFor<Inputs>;
        return this.combiner(values, arg);    
    }
}
type ContextOrF<Arg, Output> = Context<Output> | F<Arg, any, Output>

type OutputFor<T> = T extends ContextOrF<any, infer Output> ? Output : never;

type OutputsFor<TT> = { [K in keyof TT]: OutputFor<TT[K]> };

function makeF<Arg, Inputs extends Tuple<ContextOrF<Arg, any>>, Output>(
	inputs: Inputs,
	combiner: (values: OutputsFor<Inputs>, arg: Arg) => Output
): F<Arg, Inputs, Output>
{
    return new F(inputs, combiner);
}

const g0 = createContext(1234);
const f0 = makeF([g0], ([g0val], arg: { a: number }) => arg.a + g0val);
const f1 = makeF([], (values, arg: { b: number }) => arg.toString());
const f2 = makeF([f0,f1,g0], (values: [number,string,number], arg: { a: number, b: number}) => null);