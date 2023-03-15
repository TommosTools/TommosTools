import react from "react";

type Wrapped<T> = { $$value: T; $$wrapped: true; }

function wrap<T>(value: T): Wrapped<T> { return { $$value: value, $$wrapped: true }; }
function unwrap<T>(wrapped: Wrapped<T>) { return wrapped.$$value; }
function isWrapped<T>(value: EvaluatorOrWrappedValue<T, {}>): value is Wrapped<T> { return "$$wrapped" in value; }

type Evaluator<Output, Arg> = (arg: Arg) => Output;

type EvaluatorOrWrappedValue<Output, Arg> = Wrapped<Output> | Evaluator<Output, Arg>

type OutputFor<Input> = Input extends EvaluatorOrWrappedValue<infer Output, {}> ? Output : never;
type ArgFor<Input>    = Input extends Evaluator<{}, infer Arg> ? Arg : {}; // if this is `any` then it passes but Arg is discarded

type ExtendArgFor<Input, Arg> =
    Input extends Evaluator<{}, infer EvaluatorArg> ? EvaluatorArg & Arg : Arg;

function makeEvaluator<
    Output,
    Input extends EvaluatorOrWrappedValue<{}, {}>,
    Arg extends ArgFor<Input> = ArgFor<Input>
>(
    input: Input,
	evaluate: (arg: ArgFor<Input>, value: OutputFor<Input>) => Output
): Evaluator<Output, Arg>
{
	return (arg) => {
		const value = (isWrapped(input) ? unwrap(input) : input(arg));
		return evaluate(arg, value as OutputFor<Input>);
	}
}

const wrappedValue1 = wrap({ a: 5 });
const evaluator1 = makeEvaluator(wrappedValue1, (arg: { c: number }, s) => 3);
const ctxinput = makeEvaluator(evaluator1, (arg, v1) => null);