import { Context, useContext, isContext, createContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

type F<Out> = () => Out;

type InputsFor<Ins extends Tuple<any>> = {
    [Index in keyof Ins]:
    Context<Ins[Index]> | F<Ins[Index]>
        // Index extends keyof []
        //     ?   Ins[Index]
        //     :   (F<Ins[Index]> | Context<Ins[Index]>)
}

function makeF<Ins extends Tuple<any>, Out>(
    inputSources: InputsFor<Ins>,
    converter: (inputs: Ins) => Out
): F<Out>
{
    return () =>
        {
            const inputs = (inputSources as any[]).map((source) =>
                isContext(source) ? useContext(source) : source()) as Ins;

            return converter(inputs);
        }
}

const contextValue1 = createContext({ a: 5 });
const F1 = makeF([contextValue1], ([s]) => 3);
const F2 = makeF([contextValue1], ([s]) => "Sadf");
const FInput = makeF([F1, F2], ([v1, v2]) => ({ val: "ADf" }));
const GInput = makeF([FInput, F1], ([v1, v2]) => "ASdf")