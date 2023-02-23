import react from "react";

type Wrapped<T> = { $$value: T; $$wrapped: true; }

function wrap<T>(value: T): Wrapped<T> { return { $$value: value, $$wrapped: true }; }
function unwrap<T>(wrapped: Wrapped<T>) { return wrapped.$$value; }
function isWrapped(value: any): value is Wrapped<any> { return "$$wrapped" in value; }

type Evaluator<Output, Arg> = (arg: Arg) => Output;

type EvaluatorOrWrappedValue<Output, Arg> = Wrapped<Output> | Evaluator<Output, Arg>

type OutputFor<Input> = Input extends EvaluatorOrWrappedValue<infer Output, {}> ? Output : never;
type ArgFor<Input>    = Input extends Evaluator<{}, infer Arg> ? Arg : {}; // if this is `any` then it passes but Arg is discarded

type ExtendArgFor<Input, Arg> =
    Input extends Evaluator<{}, infer EvaluatorArg>
        ?   EvaluatorArg & Arg
        :   Arg;

function makeEvaluator<
    EvalFn extends (value: any, arg: any) => any
>(
    input: EvalFn extends (value: infer T, arg: infer Arg) => any ? EvaluatorOrWrappedValue<T, Arg> : never,
	evaluate: EvalFn
)//: EvalFn extends (value: any, arg: infer Arg) => infer Output ? Evaluator<Output, Arg> : never
{
    type Arg    = EvalFn extends (value: any, arg: infer Arg) => any ? Arg : never;
    type Output = EvalFn extends (value: any, arg: any) => infer Output ? Output : never;
	return (arg: Arg): Output => {
		const value = (isWrapped(input) ? unwrap(input) : input(arg));
		return evaluate(value, arg);
	}
}

const wrappedValue1 = wrap({ a: 5 });
const evaluator1 = makeEvaluator(wrappedValue1, (s, arg: { c: number }) => 3);
const ctxinput = makeEvaluator(evaluator1, (v1, arg) => null);