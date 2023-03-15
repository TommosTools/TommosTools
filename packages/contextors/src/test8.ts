type Wrapped<T> = { $$value: T; $$wrapped: true; }
const isWrapped = <T>(input: F<any, T> | Wrapped<T>): input is Wrapped<T> => "$$wrapped" in input;
const wrap      = <T>(value: T): Wrapped<T> => ({ $$value: value, $$wrapped: true });
const unwrap    = <T>(wrapped: Wrapped<T>): T => wrapped.$$value;

type F<Arg, Out> = (arg: Arg) => Out;

function makeF<In, Arg, Out>(
    inputSource: F<Arg, In> | Wrapped<In>,
    converter: (input: In, arg: Arg) => Out
): F<Arg, Out>
{
    return isWrapped(inputSource)
        ?   (arg: Arg) => converter(unwrap(inputSource), arg)
        :   (arg: Arg) => converter(inputSource(arg), arg);
}

const wrappedValue1 = wrap({ a: 5 });
const F1 = makeF(wrappedValue1, (s, arg: { c: number }) => 3);
const FInput = makeF(F1, (v1, arg: { c: number, d: string }) => null);