[contextors](.)
==========

# Formik-like example

```javascript
    const FormContext = createContext({});

    const FormContextProvider = ({ initialValues, initialTouched, children }) =>
    {
      const [values, setValues]   = useState(initialValues || {});
      const [touched, setTouched] = useState(initialTouched || {});

      return <FormContext.Provider value={{ values, setValues, setTouched }} children={children} />;
    }

    const FieldValue = createContextor(
      [FormContext],
      ({ values }, fieldName) => values[fieldName])
    );
    const FieldTouched = createContextor(
      [FormContext],
      ({ touched }, fieldName) => touched[fieldName])
    );

    const FieldGetters = createContextor(
      [FieldValue, FieldTouched],
      (value, touched, fieldName) => ({ value, touched })
    );

    const FieldSetters = createContextor(
      [FormContext],
      ({ setValues, setTouched }, fieldName) => {
        const setFieldTouched = (isTouched) => {
          setTouched(touched => ({ ...touched, [fieldName]: isTouched }));
        };
        const setFieldValue = (value) => {
          setValues(values => ({ ...values, [fieldName]: value }));
          setFieldTouched(true);
        };
        return { setFieldValue, setFieldTouched };
      }
    );

    const FieldUtil = createContextor(
      [FieldGetters, FieldSetters],
      (getters, setters, fieldName) => ({ ...getters, ...setters })
    );

    const TextSource = (fieldName) => {
      const { value, touched, setValue } = useContextor(FieldUtil, fieldName);

      return <>
        <input value={value} onChange={ e => setValue(e.target.value) } />
        { touched && "*" }
      </>
    };
```