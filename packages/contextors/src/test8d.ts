import { Context, useContext, isContext, createContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Out> = (arg: Arg) => Out;

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type InputsFor<Ins extends Tuple<any>, Args extends Tuple<any>> = {
    [Index in keyof Ins]:
        Index extends keyof Args
            ?   Context<Ins[Index]> | F<Args[Index], Ins[Index]>
            :   never
}

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N
type IsAny<T> = IfAny<T, true, never>

type IsUnknown<T> = IsAny<T> extends true ? never : unknown extends T ? true : never

type KnownArgsFor<Args extends Tuple<any>> = {
    [Index in keyof Args as (Extract<Index, number> & (IsUnknown<Args[Index]> extends true ? never : Index))]:
        Args[Index]
}
type CombineArgs<Args extends Tuple<any>> =
    UnionToIntersection<KnownArgsFor<Args>[keyof KnownArgsFor<Args>]>

type XXX = KnownArgsFor<["a"]>

type CompatibleArgsFor<Inputs extends Tuple<Context<any> | F<any, any>>> = {
    [Index in Exclude<keyof Inputs, keyof []> as (Inputs[Index] extends F<any, any> ? Index : never)]:
        Inputs[Index] extends F<infer Arg, any> ? Arg : never
}

type CompatibleArgFor<Inputs extends Tuple<Context<any> | F<any, any>>> =
    {} extends CompatibleArgsFor<Inputs>
        ?   unknown
        :   UnionToIntersection<CompatibleArgsFor<Inputs>[keyof CompatibleArgsFor<Inputs>]>

type YYY = CompatibleArgFor<[F<{a: number}, any>, Context<"">, F<{a: string}, any>]>
type YYY1 = CompatibleArgFor<[Context<"">]>

type OutputsOf<Inputs extends Tuple<Context<any> | F<any, any>>> = {
    [Index in keyof Inputs]:
        Inputs[Index] extends F<any, infer Out>
            ?   Out
            :   Inputs[Index] extends Context<infer Out>
                    ?   Out
                    :   never
}

function makeF<Inputs extends Tuple<Context<any> | F<any, any>>, Arg extends CompatibleArgFor<Inputs>, Out>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg: Arg) => Out
): F<Arg, Out>
{
    return (arg: Arg) =>
        {
            const inputs = (inputSources as any[]).map((source) =>
                isContext(source) ? useContext(source) : source(arg)) as OutputsOf<Inputs>;

            return converter(inputs, arg);
        }
}

const contextValue1 = createContext({ a: 5 });
const F1 = makeF([contextValue1], ([s], arg: { c: number }) => 3);
const F2 = makeF([contextValue1], ([s], arg: { d: string }) => "Sadf");
const FInput = makeF([F1, F2], ([v1, v2], arg: { c: number, d: string }) => ({ val: "ADf" }));
const GInput = makeF([FInput, F1], ([v1, v2], arg: { c: number }) => "ASdf")

GInput({ c: 3, d: "sdf" })