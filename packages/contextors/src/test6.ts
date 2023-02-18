import react from "react";
import { Context, createContext, useContext, isContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

class RawContextor<T, Arg, Inputs extends Tuple<ContextorInput<Arg, any>>>
{
    constructor(
        private inputs: Inputs,
        private combiner: (values: OutputsFor<Inputs>, arg: Arg) => T
    )
    {}

    call(arg: Arg): T
    {
        const values = this.inputs.map(input => isContext(input) ? useContext(input) : input.call(arg)) as OutputsFor<Inputs>;
        return this.combiner(values, arg);    
    }
}
type ContextorInput<T, Arg> = Context<T> | RawContextor<T, Arg, any>

type OutputFor<Input> = Input extends ContextorInput<infer T, any> ? T : never;

type OutputsFor<TT> = { [K in keyof TT]: OutputFor<TT[K]> };

function createContextor<T, Arg, Inputs extends Tuple<ContextorInput<any, Arg>>>(
	inputs: Inputs,
	combiner: (values: OutputsFor<Inputs>, arg: Arg) => T
): RawContextor<T, Arg, Inputs>
{
    return new RawContextor(inputs, combiner);
}

const g0 = createContext(1234);
const f0 = createContextor([g0], ([g0val], arg: { a: number }) => arg.a + g0val);
const f1 = createContextor([], (values, arg: { b: number }) => arg.toString());
const f2 = createContextor([f0,f1,g0], (values: [number,string,number], arg: { a: number, b: number}) => null);

const Context1 = createContext({ a: 5 });
const Context2 = createContext({ b: 33 });
const CX1 = createContextor([Context1], (s, arg: { c: number }) => arg);
const CX2 = createContextor([Context2], (s, arg: { d: string }) => arg);
const adsfadsf = createContextor([Context1, Context2], ([v1,v2], arg: { a: number }) => null)
const ctxinput = createContextor([CX1], ([v1], arg: { c: number }) => null)
const kkj = createContextor([CX1, CX2], ([v1,v2], arg: { c: number }) => null)
