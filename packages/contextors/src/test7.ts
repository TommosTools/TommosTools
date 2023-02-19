import react from "react";
import { Context, createContext, useContext, isContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]]

class RawContextor<T, Inputs extends Tuple<ContextorInput<any, Arg>>, Arg>
{
    constructor(
        private inputs: Inputs,
        private combiner: (values: OutputsFor<Inputs, Arg>, arg: Arg) => T
    )
    {}

    call(arg: Arg): T
    {
        const values = this.inputs.map(input => isContext(input) ? useContext(input) : input.call(arg)) as OutputsFor<Inputs, Arg>;
        return this.combiner(values, arg);    
    }
}
type ContextorInput<T, Arg> = Context<T> | RawContextor<T, any, Arg>

type OutputFor<Input, Arg> = Input extends RawContextor<infer T, any, Arg> ? T : never;

type OutputsFor<Inputs, Arg> = { [K in keyof Inputs]: OutputFor<Inputs[K], Arg> };

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type ArgsFor<Inputs extends Tuple<ContextorInput<any, any>>> = {
	[Index in keyof Inputs]: (
        // TODO FIXME: filter this down to just the RawContextor inputs
		Inputs[Index] extends ContextorInput<any, infer Arg> ? Arg : Inputs[Index]
	)
}

type ArgFor<Inputs extends Tuple<ContextorInput<any, any>>> =
	UnionToIntersection<ArgsFor<Inputs>[number]>;

function createContextor<T, Inputs extends Tuple<ContextorInput<any, any>>>(
	inputs: Inputs,
	combiner: (values: OutputsFor<Inputs, ArgFor<Inputs>>, arg: ArgFor<Inputs>) => T
): ContextorInput<T, ArgFor<Inputs>>
{
    return new RawContextor(inputs, combiner);
}

const g0 = createContext(1234);
const f0 = createContextor([g0], ([g0val], arg: { a: number }) => arg.a + g0val);
const f1 = createContextor([g0], (values, arg: { b: number }) => arg.toString());
const f2 = createContextor([f0,f1,g0], (values: [number,string,number], arg: { a: number, b: number}) => null);

const Context1 = createContext({ a: 5 });
const Context2 = createContext({ b: 33 });
//const CX1: RawContextor<{ c: number },[ContextorInput<{a:number},any>],{c:number}> = createContextor([Context1], (s, arg: { c: number }) => arg);
const CX1 = createContextor([Context1], (s, arg: { c: number }) => arg);
const CX2 = createContextor([Context2], (s, arg: { d: string }) => arg);
const adsfadsf = createContextor([Context1, Context2], ([v1,v2], arg: { a: number }) => null)
const ctxinput = createContextor([CX1], ([v1], arg: { c: number }) => arg.c)     // should not error
const kkj = createContextor([CX1, CX2], ([v1,v2], arg: { c: number }) => null)  // should error because arg doesn't include d: string