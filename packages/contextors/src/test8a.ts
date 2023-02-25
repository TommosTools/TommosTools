import { Context, useContext, isContext, createContext } from "contexto";

type F<Arg, Out> = (arg: Arg) => Out;

function makeF<In, Arg, Out>(
    inputSource: F<Arg, In> | Context<In>,
    converter: (input: In, arg: Arg) => Out
): F<Arg, Out>
{
    return isContext(inputSource)
        ?   (arg: Arg) => converter(useContext(inputSource), arg)
        :   (arg: Arg) => converter(inputSource(arg), arg);
}

const contextValue1 = createContext({ a: 5 });
const F1 = makeF(contextValue1, (s, arg: { c: number }) => 3);
const FInput = makeF(F1, (v1, arg: { c: number, d: string }) => null);