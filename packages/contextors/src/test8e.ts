import { Context, useContext, isContext, createContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Out, Optional> =
    true extends Optional
        ?   ((arg?: Arg) => Out)
        :   (arg: Arg) => Out

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type CompatibleArgsFor<Inputs extends Tuple<Context<any> | F<any, any, boolean>>> = {
    [Index in Exclude<keyof Inputs, keyof []> as (Inputs[Index] extends (F<any, any, boolean>) ? Index : never)]:
        ArgFor<Inputs[Index]>
}

type ArgFor<K> =
    K extends F<infer Arg, any, true>
        ?   Arg | undefined
        :   K extends F<infer Arg, any, false>
            ?   Arg
            :   never;

type PredicateWrap<T> =
{
    [K in keyof T]: { predicate: T[K] }
}

type CompatibleArgFor0<Inputs extends Tuple<Context<any> | F<any, any, boolean>>> =
    ({} extends CompatibleArgsFor<Inputs>
        ?   { predicate: unknown | undefined }    // There are no args to be compatible with
        :   ((UnionToIntersection<PredicateWrap<
        CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]>)
    )
    )

type CompatibleArgFor<Inputs extends Tuple<Context<any> | F<any, any, boolean>>> =
    CompatibleArgFor0<Inputs> extends { predicate: infer T } ? T : never;

type LJJLLJ = UnionToIntersection<[{ a: string } | undefined] | [{ b: string }]>[0]

type YYY = CompatibleArgFor<[F<{a: number}, any, boolean>, Context<"">, F<{a: string}, any, boolean>]>
type YYY1 = CompatibleArgFor<[Context<"">]>
type YYY2 = CompatibleArgsFor<[F<number | undefined, any, boolean>, F<string | number | undefined, any, boolean>]>
type YYY4 = PredicateWrap<YYY2>[keyof YYY2];
type LJJL = UnionToIntersection<YYY4>["predicate"]
const LJKJLLJ: LJJL = 3;

type YYY3 = CompatibleArgFor<[ F<number, any, false>, F<number | string | undefined, any, true> ]>

type OutputsOf<Inputs extends Tuple<Context<any> | F<any, any, boolean>>> = {
    [Index in keyof Inputs]:
        Inputs[Index] extends F<any, infer Out, boolean>
            ?   Out
            :   Inputs[Index] extends Context<infer Out>
                    ?   Out
                    :   never
}

function makeF<
    Inputs extends Tuple<Context<any> | F<any, any, true>>,
    Arg extends CompatibleArgFor<Inputs>,
    Out
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg?: Arg) => Out
): F<Arg, Out, true>;

function makeF<
    Inputs extends Tuple<Context<any> | F<any, any, boolean>>,
    Arg extends CompatibleArgFor<Inputs>,
    Out
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg: Arg) => Out
): F<Arg, Out, false>;

function makeF<
    Inputs extends Tuple<Context<any> | F<any, any, boolean>>,
    Arg extends CompatibleArgFor<Inputs>,
    Out,
    Optional extends boolean
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg: Arg) => Out
)
{
    return ((arg: Arg) =>
        {
            const inputs = (inputSources as any[]).map((source) =>
                isContext(source) ? useContext(source) : source(arg)) as OutputsOf<Inputs>;

            return converter(inputs, arg);
        }) as F<Arg, Out, Optional>
}

type XXX = ((x?: number) => any) extends ((x: undefined) => any) ? true : false;

const contextValue1 = createContext({ a: 5 });
type TTT = CompatibleArgFor<[typeof contextValue1]>;
const F1 = makeF([contextValue1], ([s], arg: { cArg: number }) => 3);
const F2 = makeF([contextValue1], ([s], arg: { dArg: string }) => "Sadf");
const FInput = makeF([F1, F2], ([v1, v2], arg: { cArg: number, dArg: string }) => ({ val: "ADf" }));
const GInput = makeF([FInput, F1], ([v1, v2], arg: { cArg: number }) => "ASdf")
F1();       // error: expects arg
GInput();   // error: expects arg
GInput({ cArg: 3, dArg: "ADF" })

type AAAAAA = CompatibleArgsFor<[typeof F1, typeof F2]>
type LKJLKJLKJ = ArgFor<typeof F1>
type jjl = typeof F1 extends F<any, any, infer Optional> ? Optional : never;

const F3 = makeF([contextValue1], ([s], arg?: { c: number }) => 3 + (arg?.c ?? 0));
const F4 = makeF([F3], ([s], arg?: { c: number }) => null);

type ArgOf<TT extends F<any, any, boolean>> = (TT extends F<infer Arg, any, any> ? Arg : never) | (TT extends F<any, any, true> ? undefined : never);
type FDKLFJKL = ArgOf<typeof F3>
type LJLJ = CompatibleArgFor<[typeof contextValue1]>;

GInput({ cArg: 3, dArg: "sdf" })
F3();
F4();

type GetArgOf<Func> = Func extends (arg: infer Arg) => any ? Arg : never;

function F<
    Func extends (arg: any) => any,
    Arg extends GetArgOf<Func>
>(func: Func): ((arg: Arg) => void)
{
    return (arg: Arg) => { func(arg); }
}

const baseF = (arg?: string) => 33;
type G = GetArgOf<typeof baseF>
const FF = F(baseF);