import { Context, useContext, isContext, createContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Out> = (arg: Arg) => Out;

type InputsFor<Ins extends Tuple<any>, Arg> = {
    [Index in keyof Ins]:
        Index extends number
            ?   (F<Arg, Ins[Index]> | Context<Ins[Index]>)
            :   Ins[Index]
}

function makeF<Ins extends Tuple<any>, Arg, Out>(
    inputSources: InputsFor<Ins, Arg>,
    converter: (inputs: Ins, arg: Arg) => Out
): F<Arg, Out>
{
    return (arg: Arg) =>
        {
            const inputs: Ins = inputSources.map((source: Ins[number]) =>
                isContext(source) ? useContext(source) : source(arg));

            return converter(inputs, arg);
        }
}

const contextValue1 = createContext({ a: 5 });
const F1 = makeF([contextValue1], (s, arg: { c: number }) => 3);
const FInput = makeF([F1], (v1, arg: { c: number, d: string }) => null);