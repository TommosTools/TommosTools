# use-context-selector

Hook for simple context slicing in React

## Usage

```javascript
import { createContext } from "contexto";
import { useContextSelector } from "@tommostools/use-context-selector";

const MyContext = createContext({
	outer: 123,
	nestedValue: { inner: "some value" },
	array: ["one", "two", "three"]
});

const Consumer = () =>
	{
		// `value1` subscribes just to the `.nestedValue` in the context
		const value1 = useContextSelector(MyContext, (contextValue) => contextValue.nestedValue);

		// `value2` subscribes just to the current length of the array in the context
		const value2 = useContextSelector(MyContext, (contextValue) => contextValue.array.length);

		return <div><span>{value2}</span><span>{value2}</span></div>
	}

render(<Consumer/>);
```
