import { Context, useContext, isContext, createContext } from "contexto";

type Tuple<T> = [] | [T, ...T[]];

type F<Arg, Out, Optional> =
    true extends Optional
        ?   ((arg?: Arg | undefined) => Out) & { optionalF: void }
        :   ((arg: Arg) => Out) & { requiredF: void }

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type CompatibleArgsFor<Inputs extends Tuple<Context<any> | F<any, any, true> | F<any, any, false>>> = {
    [Index in Exclude<keyof Inputs, keyof []> as (Inputs[Index] extends (F<any, any, true> | F<any, any, false>) ? Index : never)]:
        ArgFor<Inputs[Index]>
}

type ArgFor<K> =
    K extends F<infer Arg, any, true>
        ?   Arg | undefined     // Partial<Arg> isn't quite correct ... need to preserve individual nullable options
        :   K extends F<infer Arg, any, false>
            ?   Arg
            :   never;

type PredicateWrap<T> =
{
    [K in keyof T]: { predicate: T[K] }
}

type CompatibleArgFor0<Inputs extends Tuple<Context<any> | F<any, any, true> | F<any, any,false>>> =
    ({} extends CompatibleArgsFor<Inputs>
        ?   { predicate: unknown }    // There are no args to be compatible with
        :   ((UnionToIntersection<PredicateWrap<
                CompatibleArgsFor<Inputs>>[keyof CompatibleArgsFor<Inputs>]>)
            )
    )

type UndefinedToOptional<T> = { 
    [K in keyof T as (undefined extends T[K] ? never : K)]: T[K] 
} & {
    [K in keyof T as (undefined extends T[K] ? K : never)]?: T[K]
}

type CompatibleArgFor<Inputs extends Tuple<Context<any> | F<any, any, true> | F<any, any,false>>> =
    CompatibleArgFor0<Inputs> extends { predicate: infer T } ? T : never;

type LJJLLJ = UnionToIntersection<[{ a: string } | undefined] | [{ b: string }]>[0]

type YYY = CompatibleArgFor<[F<{a: number}, any, boolean>, Context<"">, F<{a: string}, any, boolean>]>
type YYY1 = CompatibleArgFor<[Context<"">]>
type YYY2 = CompatibleArgsFor<[F<number | undefined, any, boolean>, F<string | number | undefined, any, boolean>]>
type YYY4 = PredicateWrap<YYY2>[keyof YYY2];
type LJJL = UnionToIntersection<YYY4>["predicate"]
const LJKJLLJ: LJJL = 3;

type YYY3 = CompatibleArgFor<[ F<number, any, false>, F<number | string | undefined, any, true> ]>

type OutputsOf<Inputs extends Tuple<Context<any> | F<any, any, true> | F<any, any, false>>> = {
    [Index in keyof Inputs]:
        Inputs[Index] extends F<any, infer Out, boolean>
            ?   Out
            :   Inputs[Index] extends Context<infer Out>
                    ?   Out
                    :   never
}

function makeF<
    Inputs extends Tuple<Context<unknown> | F<unknown, unknown, true>>,
    Out
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg?: never) => Out
): F<CompatibleArgFor<Inputs>, Out, true>  & { omitted: void };

function makeF<
    Inputs extends Tuple<Context<unknown> | F<unknown, unknown, true>>,
    Arg extends undefined,
    Out
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg: Arg) => Out
): F<Exclude<Arg, undefined> & CompatibleArgFor<Inputs>, Out, true>  & { optional: void };

function makeF<
    Inputs extends Tuple<Context<unknown> | F<any, unknown, true> | F<any, unknown, false>>,
    Arg,
    Out
>(
    inputSources: Inputs,
    converter: (inputs: OutputsOf<Inputs>, arg: Arg) => Out
): F<Exclude<Arg, undefined> & CompatibleArgFor<Inputs>, Out, false>  & { mandatory: void };

function makeF<
    Inputs extends Tuple<Context<unknown> | F<any, unknown, true> | F<any, unknown, false>>,
    Arg,
    Out
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
        });
}

type XXX = ((x?: number) => any) extends ((x: undefined) => any) ? true : false;

const contextValue1 = createContext({ a: 5 });
type TTT = CompatibleArgFor<[typeof contextValue1]>;
const F1 = makeF([contextValue1], ([s], arg: { cArg: number }) => 3);
const F2 = makeF([contextValue1], ([s], arg: { dArg: string } | undefined) => "Sadf");
const FInput = makeF([F1, F2], ([v1, v2], arg: { cArg: number, dArg: string }) => ({ val: "ADf" }));
const GInput = makeF([FInput, F1], ([v1, v2], arg: { cArg: number }) => "ASdf")
F1();       // error: expects arg
GInput();   // error: expects arg
GInput({ cArg: 3, dArg: "ADF" })

// should not allow optional arg: should allow "no arg" or "arg w optional members" or even "arg that can be undefined", but not optional -- otherwise we disguise '{ x?: X }' !== `{ x: X } | undefined`

type AAAAAA = CompatibleArgsFor<[typeof F1, typeof F2]>
type LKJLKJLKJ = ArgFor<typeof F1>
type jjl = typeof F1 extends F<any, any, infer Optional> ? Optional : never;

const F3 = makeF([contextValue1], ([s], arg: { c: number, d?: string }) => 3 + (arg.c ?? 0));
const F4 = makeF([F3], ([s], arg: { c: number } | undefined) => null);
const F5 = makeF([F4], ([s], arg: { blern: string }) => String(s) + arg.blern);
type F5arg = CompatibleArgFor<[typeof F5]>

type ArgOf<TT extends F<any, any, boolean>> = (TT extends F<infer Arg, any, false> ? Arg : never) | (TT extends F<any, any, true> ? undefined : never);
type LJLJ = CompatibleArgFor<[typeof contextValue1]>;

GInput({ cArg: 3, dArg: "sdf" })
F3(); // should be an error: expects { c, d? }
F3({ c: 3 })
F3({ c: 3, d: "Asdf" })
F4({ c: 9 });
F5({ blern: "3", c: 3, d: undefined })

const G0 = createContext({ a: 22 });
const G1 = makeF([G0], ([g0]) => g0.a);
G1();
const G2 = makeF([G0, G1], ([g0, g1]) => g0.a + g1);
G2();
const G3 = makeF([G0, G1], ([g0, g1], factor: number) => g0.a + g1 * factor);
G3(5);
const G4 = makeF([G2, G3], ([g2, g3]) => g2 + g3);
G4(); // should be an error -- wants a number
G4(3);
const G5 = makeF([G2, G3], ([g2, g3], negate: boolean) => negate ? -(g2 + g3) : (g2 + g3));
G5(true); // error
const G6 = makeF([G2, G1], ([g2, g1], negate: number | undefined) => g2 + g1);
G6(3); // this should NOT be an error
const G7 = makeF([G2, G1], ([g2, g1], negate: number) => g2 + g1);
G7(3);

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