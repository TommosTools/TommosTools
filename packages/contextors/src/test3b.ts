import react from "react";

type Wrapped<T> = { $$value: T; $$wrapped: true; }

function wrap<T>(value: T): Wrapped<T> { return { $$value: value, $$wrapped: true }; }
function unwrap<T>(wrapped: Wrapped<T>) { return wrapped.$$value; }
function isWrapped(value: any): value is Wrapped<any> { return "$$wrapped" in value; }

type Evaluator<Output, Arg> = (arg: Arg) => Output;

type EvaluatorOrWrappedValue<Output, Arg> = Wrapped<Output> | Evaluator<Output, Arg>

type OutputFor<Input> = Input extends EvaluatorOrWrappedValue<infer Output, {}> ? Output : never;
type ArgFor<Input>    = Input extends Evaluator<{}, infer Arg> ? Arg : {}; // if this is `any` then it passes but Arg is discarded

function makeEvaluator<
    Output,
    Input extends EvaluatorOrWrappedValue<{}, Arg>,
    Arg extends {}
>(
	evaluate: (arg: Arg & ArgFor<Input>, values: OutputFor<Input>) => Output,
    input: Input
): Evaluator<Output, Arg & ArgFor<Input>>
{
	return (arg) => {
		const value = (isWrapped(input) ? unwrap(input) : input(arg));
		return evaluate(arg, value as OutputFor<Input>);
	}
}

const wrappedValue1 = wrap({ a: 5 });
const evaluator1 = makeEvaluator((arg: { c: number }, s) => 3, wrappedValue1);
const ctxinput = makeEvaluator((arg, v1) => null, evaluator1);